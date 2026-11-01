import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calcularCruceCertificacion } from "@/lib/totalCertificadoAgregado";
import { datosCertificadoContratado } from "@/lib/certificadoContratado";
import { INCLUDE_VINCULO_AJUSTE } from "@/lib/vinculoAjusteLiquidacion";
import { requerirProyecto } from "@/lib/sesion";

// Presupuesto Original = presupuesto contratado (lib/presupuestoContratado):
// el monto del contrato firmado o, sin contrato, la suma de rubros. Es la
// misma base que usan Resumen, Certificaciones y Control de Costos. El total
// certificado del cruce se expresa sobre esa misma base (% de avance sobre
// la suma de rubros × presupuesto contratado), y se recalcula en vivo en
// cada GET: Certificaciones puede seguir cargando después de creada la
// liquidación y el cruce tiene que reflejar el estado más reciente.

function calcularTotalLiquidado(presupuestoOriginal: number, ajustes: { monto: number; tipo: string }[]): number {
  const sumaAdicionales = ajustes.filter((a) => a.tipo === "Adicional").reduce((s, a) => s + a.monto, 0);
  const sumaDescuentos = ajustes.filter((a) => a.tipo === "Descuento").reduce((s, a) => s + a.monto, 0);
  return presupuestoOriginal + sumaAdicionales - sumaDescuentos;
}

// GET — obtiene la liquidación final del proyecto (o null si todavía
// no se creó), con ajustes y el Total Liquidado ya resuelto.
//
// Presupuesto Original: si la liquidación YA EXISTE, se lee el
// snapshot congelado en creación (presupuestoOriginalSnapshot) — NO
// se recalcula en vivo, para que una liquidación cerrada no cambie
// sola si el presupuesto se edita después. Si todavía no existe
// liquidación, se sigue mostrando el valor en vivo como preview de lo
// que quedaría congelado al crearla (no hay nada que congelar todavía).
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const acceso = await requerirProyecto(id);
    if (acceso instanceof NextResponse) return acceso;

    const proyecto = await db.proyecto.findUnique({ where: { id }, select: { id: true, moneda: true } });
    if (!proyecto) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const liquidacion = await db.liquidacionFinal.findUnique({
      where: { proyectoId: id },
      include: { ajustes: { orderBy: { createdAt: "asc" }, include: INCLUDE_VINCULO_AJUSTE } },
    });

    const datos = await datosCertificadoContratado(id);
    const presupuestoOriginal = liquidacion ? liquidacion.presupuestoOriginalSnapshot : datos?.contratado.monto ?? null;
    const totalLiquidado =
      presupuestoOriginal != null
        ? calcularTotalLiquidado(presupuestoOriginal, liquidacion?.ajustes ?? [])
        : null;

    // El cruce contra Certificaciones solo tiene sentido una vez que
    // existe una liquidación (hay un Total Liquidado contra el cual
    // comparar) — antes de crearla no se calcula.
    const cruceCertificacion =
      liquidacion && totalLiquidado != null && datos
        ? calcularCruceCertificacion(datos.certificado, totalLiquidado)
        : null;

    return NextResponse.json({
      liquidacion,
      presupuestoOriginal,
      // De dónde sale el presupuesto contratado hoy ("contrato" | "rubros");
      // con la liquidación ya creada, presupuestoOriginal es la foto tomada
      // al crearla y puede diferir de presupuestoContratadoActual.
      presupuestoFuente: datos?.contratado.fuente ?? "rubros",
      presupuestoContratadoActual: datos?.contratado.monto ?? null,
      totalLiquidado,
      cruceCertificacion,
      monedaProyecto: proyecto.moneda,
    });
  } catch (err) {
    console.error("[GET /api/proyectos/[id]/liquidacion-final]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST — crea la liquidación final del proyecto (primera vez).
// Congela el Presupuesto Original acá — se calcula una sola vez con
// lib/certificadoContratado y se guarda en presupuestoOriginalSnapshot; de acá
// en más ese número no se vuelve a tocar en esta liquidación.
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const acceso = await requerirProyecto(id);
    if (acceso instanceof NextResponse) return acceso;
    const body = await req.json().catch(() => ({}));
    const { fechaLiquidacion, observaciones, retencionGarantiaPct } = body as {
      fechaLiquidacion?: string;
      observaciones?: string;
      retencionGarantiaPct?: number | null;
    };

    const proyecto = await db.proyecto.findUnique({ where: { id }, select: { id: true } });
    if (!proyecto) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const existente = await db.liquidacionFinal.findUnique({ where: { proyectoId: id } });
    if (existente) {
      return NextResponse.json({ error: "Este proyecto ya tiene una liquidación final" }, { status: 409 });
    }

    const presupuestoOriginal = (await datosCertificadoContratado(id))?.contratado.monto ?? null;
    if (presupuestoOriginal == null) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const liquidacion = await db.liquidacionFinal.create({
      data: {
        proyectoId: id,
        fechaLiquidacion: fechaLiquidacion ? new Date(fechaLiquidacion) : null,
        observaciones: observaciones?.trim() || null,
        retencionGarantiaPct:
          typeof retencionGarantiaPct === "number" && retencionGarantiaPct > 0 && retencionGarantiaPct <= 100
            ? retencionGarantiaPct
            : null,
        presupuestoOriginalSnapshot: presupuestoOriginal,
      },
      include: { ajustes: true },
    });

    return NextResponse.json(liquidacion, { status: 201 });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/liquidacion-final]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// PATCH — edita los campos generales de la liquidación ya existente.
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const acceso = await requerirProyecto(id);
    if (acceso instanceof NextResponse) return acceso;
    const body = await req.json().catch(() => ({}));
    const { fechaLiquidacion, observaciones, retencionGarantiaPct } = body as {
      fechaLiquidacion?: string;
      observaciones?: string;
      retencionGarantiaPct?: number | null;
    };

    const existente = await db.liquidacionFinal.findUnique({ where: { proyectoId: id } });
    if (!existente) {
      return NextResponse.json({ error: "Este proyecto todavía no tiene liquidación final" }, { status: 404 });
    }

    const liquidacion = await db.liquidacionFinal.update({
      where: { proyectoId: id },
      data: {
        fechaLiquidacion: fechaLiquidacion ? new Date(fechaLiquidacion) : null,
        observaciones: observaciones?.trim() || null,
        retencionGarantiaPct:
          typeof retencionGarantiaPct === "number" && retencionGarantiaPct > 0 && retencionGarantiaPct <= 100
            ? retencionGarantiaPct
            : null,
      },
      include: { ajustes: { orderBy: { createdAt: "asc" }, include: INCLUDE_VINCULO_AJUSTE } },
    });

    return NextResponse.json(liquidacion);
  } catch (err) {
    console.error("[PATCH /api/proyectos/[id]/liquidacion-final]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
