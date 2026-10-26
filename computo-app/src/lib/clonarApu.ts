import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { NOTA_PRECIO_FIJO_BIBLIOTECA, precioConRespaldo, resolverPrecioMaterial, resolverPrecioEquipo } from "@/lib/resolverPrecioInsumo";
import { calcularPrecioUnitario, redondearPrecio, sumarAportesPatronalesPct } from "@/lib/apu-calc";
import { costoDirectoUnitario } from "@/lib/costoAgregado";

// Mismo guard que PUT /api/rubros/[id]/apu y
// /api/rubros/[id]/actualizar-precio-vigente — un presupuesto FINALIZADO
// es de solo lectura hasta "Habilitar edición". Se tira acá adentro (no
// en cada endpoint que llama a clonarApuAlRubro) para proteger ambos
// llamadores — POST /api/subrubros-estandar/[id]/clonar-apu y
// generarRubrosAutomaticos()/rubrosAutomaticos.ts — con un solo chequeo.
export class ProyectoFinalizadoError extends Error {
  constructor() {
    super(
      "Este presupuesto fue entregado y los precios están congelados. Habilitá la edición desde el proyecto para poder modificarlo."
    );
    this.name = "ProyectoFinalizadoError";
  }
}

/* Clona el APUEstandar de un subrubro de biblioteca al APU real de un rubro
   ya existente — misma lógica que usaba únicamente
   /api/subrubros-estandar/[id]/clonar-apu (extraída acá para que
   rubrosAutomaticos.ts la use directo, sin un fetch interno del servidor
   a sí mismo). Requiere que `rubroId` ya exista; no crea el Rubro.

   Atómico frente a pedidos simultáneos (oct-2026: dos clonados del mismo
   rubro intercalados dejaron cada material duplicado). El borrado y la
   inserción van en una transacción que primero bloquea la fila del Rubro
   (SELECT … FOR UPDATE, mismo lock que PUT /api/rubros/[id]/apu): un
   segundo clonado espera a que termine el primero y recién entonces borra
   lo que ese dejó. La transacción sola no alcanza — en READ COMMITTED los
   dos borrarían "nada" (no ven lo que el otro insertó sin confirmar) y los
   dos insertarían. Las lecturas lentas (precios de catálogo, jornales) se
   resuelven ANTES, para que la transacción sea corta y no pase el timeout. */
export async function clonarApuAlRubro(subrubroId: string, rubroId: string) {
  const rubroConEstado = await db.rubro.findUnique({
    where: { id: rubroId },
    select: { capitulo: { select: { proyecto: { select: { estado: true } } } } },
  });
  if (rubroConEstado?.capitulo.proyecto.estado === "FINALIZADO") {
    throw new ProyectoFinalizadoError();
  }

  const apuEstandar = await db.aPUEstandar.findUnique({
    where: { subrubroId },
    include: { materiales: true, manoObra: true, equipos: true },
  });

  if (!apuEstandar) {
    throw new Error(`El subrubro ${subrubroId} no tiene APU estándar`);
  }

  const categoriasLaborales = await db.categoriaLaboral.findMany();
  const jornalPorNombre = (nombre: string) =>
    categoriasLaborales.find(
      (c) => c.nombre.trim().toLowerCase() === nombre.trim().toLowerCase()
    )?.jornal ?? 0;

  // Aportes patronales y Utilidad por defecto (si el rubro todavía no tiene
  // APU): los del proyecto — la Utilidad del catálogo solo si el proyecto no
  // tiene una propia. Se leen afuera de la transacción; adentro solo se usan
  // si al bloquear el rubro sigue sin haber APU.
  const rubroConProyecto = await db.rubro.findUnique({
    where: { id: rubroId },
    select: {
      capitulo: {
        select: {
          proyecto: {
            select: {
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
  const aportesPatronalesDelProyecto = sumarAportesPatronalesPct(rubroConProyecto?.capitulo?.proyecto?.leyesSociales);
  const utilidadDelProyecto = rubroConProyecto?.capitulo?.proyecto?.utilidadPctDefault ?? apuEstandar.utilidadPct;

  // Filas a insertar, ya resueltas contra el catálogo (fuera de la transacción).
  const materialesData: Omit<Prisma.MaterialAPUCreateManyInput, "apuId">[] = [];
  for (let i = 0; i < apuEstandar.materiales.length; i++) {
    const m = apuEstandar.materiales[i];
    const precioMTOP = await resolverPrecioMaterial(m.descripcion);
    // Catálogo primero; si no resuelve, el precio fijo con que se guardó la
    // línea en la biblioteca (ver precioConRespaldo).
    const { precio: precioUnit, esFijo } = precioConRespaldo(precioMTOP?.precioUnitario, m.precioReferencia);
    materialesData.push({
      descripcion: m.descripcion,
      unidad: m.unidad,
      rendimiento: m.rendimiento,
      precioUnit: redondearPrecio(precioUnit),
      orden: i,
      ...(esFijo
        ? { notaProcedencia: NOTA_PRECIO_FIJO_BIBLIOTECA }
        : {
            motivoVerificacion: precioMTOP?.motivoVerificacion ?? null,
            proveedor: precioMTOP?.proveedor ?? null,
            notaProcedencia: precioMTOP?.notaProcedencia ?? null,
            fechaUltimaVerificacion: precioMTOP?.fechaUltimaVerificacion ?? null,
            precioMTOPId: precioMTOP?.id ?? null,
          }),
    });
  }

  // Los ids de equipo se generan acá (createMany no los devuelve) para poder
  // colgar de ellos la mano de obra de armado/desarme.
  const equipoIdMap = new Map<string, string>();
  const equiposData: Omit<Prisma.EquipoAPUCreateManyInput, "apuId">[] = [];
  for (let i = 0; i < apuEstandar.equipos.length; i++) {
    const eq = apuEstandar.equipos[i];
    const precioEquipo = await resolverPrecioEquipo(eq.descripcion);
    const { precio: costoUnit, esFijo } = precioConRespaldo(precioEquipo?.precioHora, eq.costoReferencia);
    const id = randomUUID();
    equipoIdMap.set(eq.id, id);
    equiposData.push({
      id,
      descripcion: eq.descripcion,
      unidad: eq.unidad,
      rendimiento: eq.rendimiento,
      costoUnit: redondearPrecio(costoUnit),
      orden: i,
      motivoVerificacion: precioEquipo || esFijo ? null : "sin_costo_referencia",
    });
  }

  const manoObraData = apuEstandar.manoObra.map((mo, i) => ({
    categoria: mo.categoria,
    jornadaHs: mo.jornadaHs,
    rendimiento: mo.rendimiento,
    jornalRef: precioConRespaldo(jornalPorNombre(mo.categoria), mo.jornalReferencia).precio,
    orden: i,
    equipoRelacionadoId: mo.equipoRelacionadoId
      ? equipoIdMap.get(mo.equipoRelacionadoId) ?? null
      : null,
  }));

  const apuId = await db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Rubro" WHERE id = ${rubroId} FOR UPDATE`;

      // Con el rubro bloqueado: si otro clonado terminó mientras esperábamos,
      // acá ya se ve su APU (y sus materiales, que se borran abajo).
      const apuExistente = await tx.aPU.findUnique({ where: { rubroId } });
      const apu = apuExistente
        ? await tx.aPU.update({
            where: { rubroId },
            data: {
              gastosGeneralesPct: 0,
              // Reemplazar el rubro por otro del catálogo no pisa su Utilidad
              // (igual que los aportes patronales).
              utilidadPct: apuExistente.utilidadPct,
              aportesPatronalesPct: apuExistente.aportesPatronalesPct ?? aportesPatronalesDelProyecto,
              porcentajePiedra: apuEstandar.porcentajePiedra,
            },
          })
        : await tx.aPU.create({
            data: {
              rubroId,
              gastosGeneralesPct: 0,
              utilidadPct: utilidadDelProyecto,
              aportesPatronalesPct: aportesPatronalesDelProyecto,
              porcentajePiedra: apuEstandar.porcentajePiedra,
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
        await tx.equipoAPU.createMany({ data: equiposData.map((eq) => ({ ...eq, apuId: apu.id })) });
      }
      if (manoObraData.length > 0) {
        await tx.manoObraAPU.createMany({ data: manoObraData.map((mo) => ({ ...mo, apuId: apu.id })) });
      }
      return apu.id;
    },
    // La base es remota (el default de 5 s quedaba justo, P2028) y el timeout
    // cuenta desde el arranque, INCLUIDA la espera del lock FOR UPDATE: un
    // segundo clonado del mismo rubro espera a que termine el primero entero.
    // Probado contra la base real desde el dev local (oct-2026): con 15 s el
    // segundo de dos clonados simultáneos vencía; con 30 s terminan los dos.
    { timeout: 30_000, maxWait: 10_000 }
  );

  const apuCompleto = await db.aPU.findUnique({
    where: { id: apuId },
    include: { materiales: true, manoObra: true, equipos: true },
  });

  // Fórmula canónica única — ver costoDirectoUnitario en lib/costoAgregado.ts.
  const costoDirecto = costoDirectoUnitario(apuCompleto!);
  const precioUnit = redondearPrecio(calcularPrecioUnitario(costoDirecto, apuCompleto!.utilidadPct));

  const rubro = await db.rubro.update({
    where: { id: rubroId },
    data: { precioUnit },
  });

  // costoDirecto (sin Utilidad%) se devuelve además de precioUnit (con
  // Utilidad% ya aplicada) porque rubrosAutomaticos.ts necesita despejar
  // cantidad contra el costo directo puro — ver comentario en ese archivo.
  return { apu: apuCompleto, rubro, costoDirecto };
}
