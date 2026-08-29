import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sumEquipos, sumManoObra, calcularPrecioUnitario, sumarAportesPatronalesPct, montoAportesPatronales } from "@/lib/apu-calc";

// POST — clona el APUEstandar de un subrubro de biblioteca al APU real de un rubro
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: subrubroId } = await params;
    const { rubroId } = await req.json();

    if (!rubroId) {
      return NextResponse.json({ error: "Falta rubroId" }, { status: 400 });
    }

    const apuEstandar = await db.aPUEstandar.findUnique({
      where: { subrubroId },
      include: { materiales: true, manoObra: true, equipos: true },
    });

    if (!apuEstandar) {
      return NextResponse.json({ error: "El subrubro no tiene APU estándar" }, { status: 404 });
    }

    const categoriasLaborales = await db.categoriaLaboral.findMany();
    const jornalPorNombre = (nombre: string) =>
      categoriasLaborales.find(
        (c) => c.nombre.trim().toLowerCase() === nombre.trim().toLowerCase()
      )?.jornal ?? 0;

    // 1 — Crear (o reusar) el APU del rubro real
    const apuExistente = await db.aPU.findUnique({ where: { rubroId } });

    // Aportes Patronales: congelado si el rubro ya tenía APU — se lee en
    // vivo de LeyesSociales del proyecto (fallback al default legal si el
    // registro no existe todavía) solo la primera vez, igual que
    // generarApuParaRubro (ver lib/apu.ts).
    let aportesPatronalesPct = apuExistente?.aportesPatronalesPct;
    if (aportesPatronalesPct == null) {
      const rubroConProyecto = await db.rubro.findUnique({
        where: { id: rubroId },
        select: {
          capitulo: {
            select: {
              proyecto: {
                select: {
                  leyesSociales: {
                    select: {
                      focerPatronalPct: true, fscFocapPct: true, fosvocPct: true,
                      frlPct: true, fondoGarantiaPct: true, snisAdicionalPct: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
      aportesPatronalesPct = sumarAportesPatronalesPct(rubroConProyecto?.capitulo?.proyecto?.leyesSociales);
    }

    // gastosGeneralesPct se fuerza a 0 siempre — Gastos Generales dejó de
    // prorratearse por rubro (biblioteca incluida), pasó a ser un monto
    // agregado a nivel proyecto (ver costoAgregado.ts). No se copia de
    // apuEstandar.gastosGeneralesPct: ese campo queda inerte en la
    // biblioteca también.
    const apu = apuExistente
      ? await db.aPU.update({
          where: { rubroId },
          data: {
            gastosGeneralesPct: 0,
            utilidadPct: apuEstandar.utilidadPct,
            aportesPatronalesPct,
            porcentajePiedra: apuEstandar.porcentajePiedra,
          },
        })
      : await db.aPU.create({
          data: {
            rubroId,
            gastosGeneralesPct: 0,
            utilidadPct: apuEstandar.utilidadPct,
            aportesPatronalesPct,
            porcentajePiedra: apuEstandar.porcentajePiedra,
          },
        });

    const apuId = apu.id;

    // Reemplazar contenido existente del APU del rubro antes de clonar
    await db.materialAPU.deleteMany({ where: { apuId } });
    await db.manoObraAPU.deleteMany({ where: { apuId } });
    await db.equipoAPU.deleteMany({ where: { apuId } });

    // 2 — Materiales (precio desde la Lista MTOP N°599 por descripción, si hay match)
    for (let i = 0; i < apuEstandar.materiales.length; i++) {
      const m = apuEstandar.materiales[i];
      const precioMTOP = await db.precioMTOP.findFirst({
        where: {
          descripcion: { contains: m.descripcion, mode: "insensitive" },
        },
        orderBy: { id: "asc" },
      });
      const precioUnit = precioMTOP?.precioUnitario ?? 0;

      await db.materialAPU.create({
        data: {
          apuId,
          descripcion: m.descripcion,
          unidad: m.unidad,
          rendimiento: m.rendimiento,
          precioUnit,
          orden: i,
          // Propagado del match, si lo hay — para que DrawerAPU pueda
          // mostrar el motivo real en vez de un $0 mudo (ver BadgeVerificacion).
          motivoVerificacion: precioMTOP?.motivoVerificacion ?? null,
        },
      });
    }

    // 3 — Equipos (precio desde el catálogo de alquiler por descripción, si
    // hay match). Se clonan antes que la mano de obra para poder mapear el
    // id de equipo estándar al id real recién creado, y así propagar
    // equipoRelacionadoId (ver paso 4).
    const equipoIdMap = new Map<string, string>();
    for (let i = 0; i < apuEstandar.equipos.length; i++) {
      const eq = apuEstandar.equipos[i];
      const precioEquipo = await db.precioEquipo.findFirst({
        where: {
          descripcion: { contains: eq.descripcion, mode: "insensitive" },
        },
      });
      const costoUnit = precioEquipo?.precioHora ?? 0;

      const creado = await db.equipoAPU.create({
        data: {
          apuId,
          descripcion: eq.descripcion,
          unidad: eq.unidad,
          rendimiento: eq.rendimiento,
          costoUnit,
          orden: i,
          // EquipoAPUEstandar no tiene motivo propio — se sintetiza acá,
          // en el momento del clonado, si no hubo match (ver BadgeVerificacion).
          motivoVerificacion: precioEquipo ? null : "sin_costo_referencia",
        },
      });
      equipoIdMap.set(eq.id, creado.id);
    }

    // 4 — Mano de obra (jornalRef desde CategoriaLaboral por nombre)
    for (let i = 0; i < apuEstandar.manoObra.length; i++) {
      const mo = apuEstandar.manoObra[i];
      await db.manoObraAPU.create({
        data: {
          apuId,
          categoria: mo.categoria,
          jornadaHs: mo.jornadaHs,
          rendimiento: mo.rendimiento,
          jornalRef: jornalPorNombre(mo.categoria),
          orden: i,
          equipoRelacionadoId: mo.equipoRelacionadoId
            ? equipoIdMap.get(mo.equipoRelacionadoId) ?? null
            : null,
        },
      });
    }

    // 5 — Calcular precioUnit y actualizar el Rubro
    const apuCompleto = await db.aPU.findUnique({
      where: { id: apuId },
      include: { materiales: true, manoObra: true, equipos: true },
    });

    const sumMat = apuCompleto!.materiales.reduce((s, m) => s + m.rendimiento * m.precioUnit, 0);
    const sumMO = sumManoObra(apuCompleto!.manoObra, apuCompleto!.equipos);
    const sumEq = sumEquipos(apuCompleto!.equipos);
    const costoDirecto = sumMat + sumMO + sumEq + montoAportesPatronales(sumMO, apuCompleto!.aportesPatronalesPct);
    const precioUnit = calcularPrecioUnitario(costoDirecto, apuCompleto!.utilidadPct);

    const rubro = await db.rubro.update({
      where: { id: rubroId },
      data: { precioUnit },
    });

    return NextResponse.json({
      apu: apuCompleto,
      rubro,
    });
  } catch (err) {
    console.error("[POST /api/subrubros-estandar/[id]/clonar-apu]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
