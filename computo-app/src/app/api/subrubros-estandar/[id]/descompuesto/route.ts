import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sumEquipos, sumManoObra, calcularPrecioUnitario } from "@/lib/apu-calc";

// GET — descompuesto (APU) completo de un rubro del catálogo maestro, para
// consulta de solo lectura en la Biblioteca (/rubros).
//
// MaterialAPUEstandar/EquipoAPUEstandar no guardan precio propio — igual que
// en /api/subrubros-estandar/[id]/clonar-apu, se resuelve en vivo por
// descripción contra PrecioMTOP/PrecioEquipo (y la mano de obra contra
// CategoriaLaboral por nombre). Acá además se exponen los campos de
// gobernanza FEAT-AI-006 del match de PrecioMTOP encontrado.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const subrubro = await db.subrubroEstandar.findUnique({
      where: { id },
      include: {
        capituloCatalogo: { select: { nombre: true } },
        subcapituloCatalogo: { select: { nombre: true } },
        apuEstandar: {
          include: {
            materiales: { orderBy: { id: "asc" } },
            manoObra: { orderBy: { id: "asc" } },
            equipos: { orderBy: { id: "asc" } },
          },
        },
      },
    });

    if (!subrubro) {
      return NextResponse.json({ error: "Rubro no encontrado" }, { status: 404 });
    }

    const base = {
      id: subrubro.id,
      codigo: subrubro.codigo,
      descripcion: subrubro.descripcion,
      unidad: subrubro.unidad,
      precioUY: subrubro.precioUY,
      fechaBase: subrubro.fechaBase,
      capitulo: subrubro.capituloCatalogo?.nombre ?? null,
      subcapitulo: subrubro.subcapituloCatalogo?.nombre ?? null,
    };

    if (!subrubro.apuEstandar) {
      return NextResponse.json({ ...base, apu: null });
    }

    const apuEstandar = subrubro.apuEstandar;

    // Materiales — precio + gobernanza resuelta contra PrecioMTOP
    const materiales = await Promise.all(
      apuEstandar.materiales.map(async (m) => {
        const precioMTOP = await db.precioMTOP.findFirst({
          where: { descripcion: { contains: m.descripcion, mode: "insensitive" } },
          orderBy: { id: "asc" },
        });
        const precioUnit = precioMTOP?.precioUnitario ?? 0;
        return {
          id: m.id,
          descripcion: m.descripcion,
          unidad: m.unidad,
          rendimiento: m.rendimiento,
          precioUnit,
          subtotal: m.rendimiento * precioUnit,
          fuente: precioMTOP
            ? {
                proveedor: precioMTOP.proveedor,
                notaProcedencia: precioMTOP.notaProcedencia,
                nombreProducto: precioMTOP.nombreProducto,
                urlReferencia: precioMTOP.urlReferencia,
                fechaUltimaVerificacion: precioMTOP.fechaUltimaVerificacion,
                requiereVerificacion: precioMTOP.requiereVerificacion,
                motivoVerificacion: precioMTOP.motivoVerificacion,
              }
            : null,
        };
      })
    );

    // Mano de obra — jornal resuelto contra CategoriaLaboral por nombre
    const categoriasLaborales = await db.categoriaLaboral.findMany();
    const jornalPorNombre = (nombre: string) =>
      categoriasLaborales.find(
        (c) => c.nombre.trim().toLowerCase() === nombre.trim().toLowerCase()
      )?.jornal ?? 0;

    const manoObra = apuEstandar.manoObra.map((mo) => {
      const jornalRef = jornalPorNombre(mo.categoria);
      return {
        id: mo.id,
        categoria: mo.categoria,
        jornadaHs: mo.jornadaHs,
        rendimiento: mo.rendimiento,
        jornalRef,
        equipoRelacionadoId: mo.equipoRelacionadoId,
        aporte: Number.isFinite(jornalRef / mo.rendimiento) ? jornalRef / mo.rendimiento : 0,
      };
    });

    // Equipos — costo/hora resuelto contra PrecioEquipo por descripción
    const equipos = await Promise.all(
      apuEstandar.equipos.map(async (eq) => {
        const precioEquipo = await db.precioEquipo.findFirst({
          where: { descripcion: { contains: eq.descripcion, mode: "insensitive" } },
        });
        const costoUnit = precioEquipo?.precioHora ?? 0;
        return {
          id: eq.id,
          descripcion: eq.descripcion,
          unidad: eq.unidad,
          rendimiento: eq.rendimiento,
          costoUnit,
          subtotal: eq.rendimiento * costoUnit,
        };
      })
    );

    const sumMat = materiales.reduce((s, m) => s + m.subtotal, 0);
    const sumMO = sumManoObra(manoObra, equipos);
    const sumEq = sumEquipos(equipos);
    // Gastos Generales ya no compone el precio de referencia de biblioteca —
    // dejó de prorratearse por rubro/subrubro, pasó a ser un monto agregado
    // a nivel proyecto (ver costoAgregado.ts). Usa la fórmula canónica
    // compartida en vez de una copia inline (como tenía antes).
    const costoDirecto = sumMat + sumMO + sumEq;
    const precioUnitFinal = calcularPrecioUnitario(costoDirecto, apuEstandar.utilidadPct);

    return NextResponse.json({
      ...base,
      apu: {
        utilidadPct: apuEstandar.utilidadPct,
        materiales,
        manoObra,
        equipos,
        costoDirecto,
        precioUnitFinal,
      },
    });
  } catch (err) {
    console.error("[GET /api/subrubros-estandar/[id]/descompuesto]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
