import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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
    const apu = apuExistente
      ? await db.aPU.update({
          where: { rubroId },
          data: {
            gastosGeneralesPct: apuEstandar.gastosGeneralesPct,
            utilidadPct: apuEstandar.utilidadPct,
          },
        })
      : await db.aPU.create({
          data: {
            rubroId,
            gastosGeneralesPct: apuEstandar.gastosGeneralesPct,
            utilidadPct: apuEstandar.utilidadPct,
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
        },
      });
    }

    // 3 — Mano de obra (jornalRef desde CategoriaLaboral por nombre)
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
        },
      });
    }

    // 4 — Equipos
    for (let i = 0; i < apuEstandar.equipos.length; i++) {
      const eq = apuEstandar.equipos[i];
      await db.equipoAPU.create({
        data: {
          apuId,
          descripcion: eq.descripcion,
          unidad: eq.unidad,
          rendimiento: eq.rendimiento,
          costoUnit: 0,
          orden: i,
        },
      });
    }

    // 5 — Calcular precioUnit y actualizar el Rubro
    const apuCompleto = await db.aPU.findUnique({
      where: { id: apuId },
      include: { materiales: true, manoObra: true, equipos: true },
    });

    const sumMat = apuCompleto!.materiales.reduce((s, m) => s + m.rendimiento * m.precioUnit, 0);
    const sumMO = apuCompleto!.manoObra.reduce(
      (s, mo) => s + (mo.jornadaHs / mo.rendimiento) * mo.jornalRef,
      0
    );
    const sumEq = apuCompleto!.equipos.reduce((s, e) => s + e.rendimiento * e.costoUnit, 0);
    const costoDirecto = sumMat + (Number.isFinite(sumMO) ? sumMO : 0) + sumEq;
    const precioUnit =
      costoDirecto * (1 + apuCompleto!.gastosGeneralesPct / 100) * (1 + apuCompleto!.utilidadPct / 100);

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
