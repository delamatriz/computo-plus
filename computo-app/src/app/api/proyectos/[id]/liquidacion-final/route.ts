import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  calcularCostoDirectoAgregado,
  calcularCostosIndirectosAgregados,
  calcularUtilidadAgregada,
  type ApuParaCosto,
} from "@/lib/costoAgregado";

// Presupuesto Original = Costo Total del presupuesto (Costo Directo +
// Costos Indirectos + Utilidad, SIN IVA) — mismo "Costo Total" que ya
// muestra la tabla principal del presupuesto (proyectos/[id]/page.tsx,
// costoTotalAgregado) y que usa /api/proyectos/[id]/pdf. Reutiliza
// costoAgregado.ts tal cual, sin reimplementar la fórmula. Se calcula
// en vivo (no se guarda) para no quedar desincronizado si el
// presupuesto cambia después de creada la liquidación.
async function calcularPresupuestoOriginal(proyectoId: string): Promise<number | null> {
  const proyecto = await db.proyecto.findUnique({
    where: { id: proyectoId },
    include: {
      capitulos: {
        include: {
          rubros: {
            include: { apu: { include: { materiales: true, manoObra: true, equipos: true } } },
          },
        },
      },
    },
  });
  if (!proyecto) return null;

  const capitulosParaCosto = proyecto.capitulos.map((cap) => ({
    rubros: cap.rubros.map((r) => ({ id: r.id, cantidad: r.cantidad, precioUnit: r.precioUnit })),
  }));
  const apuDataParaCosto: Record<string, ApuParaCosto> = {};
  for (const cap of proyecto.capitulos) {
    for (const r of cap.rubros) {
      if (r.apu) {
        apuDataParaCosto[r.id] = {
          materiales: r.apu.materiales,
          manoObra: r.apu.manoObra,
          equipos: r.apu.equipos,
          aportesPatronalesPct: r.apu.aportesPatronalesPct,
          utilidadPct: r.apu.utilidadPct,
        };
      }
    }
  }

  const costoDirectoAgregado = calcularCostoDirectoAgregado(capitulosParaCosto, apuDataParaCosto);
  const utilidadAgregada = calcularUtilidadAgregada(capitulosParaCosto, apuDataParaCosto);
  const costosIndirectosAgregados = calcularCostosIndirectosAgregados(
    proyecto.modoGastosGenerales,
    proyecto.gastosGeneralesDetallado,
    proyecto.gastosGeneralesPctDefault,
    costoDirectoAgregado.total
  );
  return costoDirectoAgregado.total + costosIndirectosAgregados + utilidadAgregada;
}

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

    const proyecto = await db.proyecto.findUnique({ where: { id }, select: { id: true, moneda: true } });
    if (!proyecto) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const liquidacion = await db.liquidacionFinal.findUnique({
      where: { proyectoId: id },
      include: { ajustes: { orderBy: { createdAt: "asc" } } },
    });

    const presupuestoOriginal = liquidacion
      ? liquidacion.presupuestoOriginalSnapshot
      : await calcularPresupuestoOriginal(id);
    const totalLiquidado =
      presupuestoOriginal != null
        ? calcularTotalLiquidado(presupuestoOriginal, liquidacion?.ajustes ?? [])
        : null;

    return NextResponse.json({
      liquidacion,
      presupuestoOriginal,
      totalLiquidado,
      monedaProyecto: proyecto.moneda,
    });
  } catch (err) {
    console.error("[GET /api/proyectos/[id]/liquidacion-final]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST — crea la liquidación final del proyecto (primera vez).
// Congela el Presupuesto Original acá — se calcula una sola vez con
// costoAgregado.ts y se guarda en presupuestoOriginalSnapshot; de acá
// en más ese número no se vuelve a tocar en esta liquidación.
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const { fechaLiquidacion, observaciones } = body as { fechaLiquidacion?: string; observaciones?: string };

    const proyecto = await db.proyecto.findUnique({ where: { id }, select: { id: true } });
    if (!proyecto) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const existente = await db.liquidacionFinal.findUnique({ where: { proyectoId: id } });
    if (existente) {
      return NextResponse.json({ error: "Este proyecto ya tiene una liquidación final" }, { status: 409 });
    }

    const presupuestoOriginal = await calcularPresupuestoOriginal(id);
    if (presupuestoOriginal == null) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const liquidacion = await db.liquidacionFinal.create({
      data: {
        proyectoId: id,
        fechaLiquidacion: fechaLiquidacion ? new Date(fechaLiquidacion) : null,
        observaciones: observaciones?.trim() || null,
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
    const body = await req.json().catch(() => ({}));
    const { fechaLiquidacion, observaciones } = body as { fechaLiquidacion?: string; observaciones?: string };

    const existente = await db.liquidacionFinal.findUnique({ where: { proyectoId: id } });
    if (!existente) {
      return NextResponse.json({ error: "Este proyecto todavía no tiene liquidación final" }, { status: 404 });
    }

    const liquidacion = await db.liquidacionFinal.update({
      where: { proyectoId: id },
      data: {
        fechaLiquidacion: fechaLiquidacion ? new Date(fechaLiquidacion) : null,
        observaciones: observaciones?.trim() || null,
      },
      include: { ajustes: { orderBy: { createdAt: "asc" } } },
    });

    return NextResponse.json(liquidacion);
  } catch (err) {
    console.error("[PATCH /api/proyectos/[id]/liquidacion-final]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
