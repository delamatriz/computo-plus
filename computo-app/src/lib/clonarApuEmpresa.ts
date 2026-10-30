import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { ProyectoFinalizadoError } from "@/lib/clonarApu";
import { NOTA_PRECIO_FIJO_BIBLIOTECA } from "@/lib/resolverPrecioInsumo";
import { calcularPrecioUnitario, redondearPrecio, sumarAportesPatronalesPct } from "@/lib/apu-calc";
import { costoDirectoUnitario } from "@/lib/costoAgregado";

/* Copia el APU de un rubro de Mis rubros (SubrubroEmpresa → APUEmpresa) al
   APU real de un rubro de proyecto ya existente — lo inverso de
   POST /api/rubros/[id]/guardar-en-mi-biblioteca:
     cantidad → rendimiento, jornal → jornalRef, jornadasHoras → jornadaHs,
     equipoId → equipoRelacionadoId.
   Lo usan "+ Mis rubros" en el presupuesto (POST /api/mi-biblioteca/[id]/
   clonar-apu) y la conversión de anteproyecto (rubrosAutomaticos.ts).

   Precios: los fijos de Mis rubros, tal cual se guardaron (no se resuelven
   contra el catálogo: es el precio propio de la empresa). Un material sin
   vínculo al catálogo queda marcado con la nota de precio fijo, igual que
   en el clonado del catálogo global.
   Utilidad y aportes patronales: los del proyecto (la utilidad de Mis rubros
   solo si el proyecto no tiene una propia). Si el rubro ya tenía APU, se
   conservan los suyos — mismo criterio que clonarApuAlRubro.

   Mismos resguardos que clonarApuAlRubro: proyecto FINALIZADO no se toca, y
   el reemplazo de líneas va en una transacción con el Rubro bloqueado (FOR
   UPDATE) para que dos copias simultáneas no dupliquen líneas.

   `empresaId`: la del proyecto — un rubro de Mis rubros de otra empresa se
   trata como inexistente (devuelve null). */
export async function clonarApuEmpresaAlRubro(subrubroEmpresaId: string, rubroId: string, empresaId: string) {
  const rubroConProyecto = await db.rubro.findUnique({
    where: { id: rubroId },
    select: {
      capitulo: {
        select: {
          proyecto: {
            select: {
              estado: true,
              utilidadPctDefault: true,
              leyesSociales: {
                select: {
                  focerPatronalPct: true, fscFocapPct: true, fosvocPct: true,
                  frlPct: true, fondoGarantiaPct: true,
                },
              },
            },
          },
        },
      },
    },
  });
  const proyecto = rubroConProyecto?.capitulo.proyecto;
  if (proyecto?.estado === "FINALIZADO") throw new ProyectoFinalizadoError();

  const subrubro = await db.subrubroEmpresa.findFirst({
    where: { id: subrubroEmpresaId, empresaId },
    include: {
      apus: {
        orderBy: { createdAt: "asc" },
        take: 1,
        include: { materiales: true, manoObra: true, equipos: true },
      },
    },
  });
  const apuEmpresa = subrubro?.apus[0];
  if (!subrubro || !apuEmpresa) return null;

  const aportesPatronalesDelProyecto = sumarAportesPatronalesPct(proyecto?.leyesSociales);
  const utilidadDelProyecto = proyecto?.utilidadPctDefault ?? apuEmpresa.utilidadPct;

  const materialesData: Omit<Prisma.MaterialAPUCreateManyInput, "apuId">[] = apuEmpresa.materiales.map((m, i) => ({
    descripcion: m.descripcion,
    unidad: m.unidad,
    rendimiento: m.cantidad,
    precioUnit: redondearPrecio(m.precioUnit),
    orden: i,
    precioMTOPId: m.precioMTOPId,
    ...(m.precioMTOPId ? {} : { notaProcedencia: NOTA_PRECIO_FIJO_BIBLIOTECA }),
  }));

  // Ids de equipo generados acá (createMany no los devuelve) para colgar de
  // ellos la mano de obra de armado/desarme.
  const equipoIdMap = new Map(apuEmpresa.equipos.map((e) => [e.id, randomUUID()]));
  const equiposData: Omit<Prisma.EquipoAPUCreateManyInput, "apuId">[] = apuEmpresa.equipos.map((e, i) => ({
    id: equipoIdMap.get(e.id),
    descripcion: e.descripcion,
    unidad: e.unidad,
    rendimiento: e.cantidad,
    costoUnit: redondearPrecio(e.costoUnit),
    orden: i,
  }));

  const manoObraData = apuEmpresa.manoObra.map((mo, i) => ({
    categoria: mo.categoria,
    jornadaHs: mo.jornadasHoras ?? 8,
    rendimiento: mo.cantidad,
    jornalRef: mo.jornal,
    orden: i,
    equipoRelacionadoId: mo.equipoId ? equipoIdMap.get(mo.equipoId) ?? null : null,
  }));

  const apuId = await db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Rubro" WHERE id = ${rubroId} FOR UPDATE`;

      const apuExistente = await tx.aPU.findUnique({ where: { rubroId } });
      const apu = apuExistente
        ? await tx.aPU.update({
            where: { rubroId },
            data: {
              gastosGeneralesPct: 0,
              utilidadPct: apuExistente.utilidadPct,
              aportesPatronalesPct: apuExistente.aportesPatronalesPct ?? aportesPatronalesDelProyecto,
            },
          })
        : await tx.aPU.create({
            data: {
              rubroId,
              gastosGeneralesPct: 0,
              utilidadPct: utilidadDelProyecto,
              aportesPatronalesPct: aportesPatronalesDelProyecto,
            },
          });

      await tx.materialAPU.deleteMany({ where: { apuId: apu.id } });
      await tx.manoObraAPU.deleteMany({ where: { apuId: apu.id } });
      await tx.equipoAPU.deleteMany({ where: { apuId: apu.id } });

      if (materialesData.length > 0) {
        await tx.materialAPU.createMany({ data: materialesData.map((m) => ({ ...m, apuId: apu.id })) });
      }
      // Equipos antes que la mano de obra: equipoRelacionadoId apunta a ellos.
      if (equiposData.length > 0) {
        await tx.equipoAPU.createMany({ data: equiposData.map((e) => ({ ...e, apuId: apu.id })) });
      }
      if (manoObraData.length > 0) {
        await tx.manoObraAPU.createMany({ data: manoObraData.map((mo) => ({ ...mo, apuId: apu.id })) });
      }
      return apu.id;
    },
    // Mismo margen que clonarApuAlRubro (base remota + espera del lock).
    { timeout: 30_000, maxWait: 10_000 }
  );

  const apuCompleto = await db.aPU.findUniqueOrThrow({
    where: { id: apuId },
    include: { materiales: true, manoObra: true, equipos: true },
  });
  const costoDirecto = costoDirectoUnitario(apuCompleto);
  const precioUnit = redondearPrecio(calcularPrecioUnitario(costoDirecto, apuCompleto.utilidadPct));

  const rubro = await db.rubro.update({
    where: { id: rubroId },
    data: { descripcion: subrubro.nombre.trim(), unidad: subrubro.unidad, precioUnit },
  });

  // costoDirecto (sin Utilidad%) además de precioUnit: rubrosAutomaticos.ts
  // despeja la cantidad contra el costo directo puro.
  return { apu: apuCompleto, rubro, costoDirecto };
}
