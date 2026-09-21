import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const TIPOS_VALIDOS = ["Ingreso", "Egreso"];

// PATCH — edita un movimiento de caja. Sin DELETE a propósito — mismo
// criterio que los demás módulos de registro de Gestión de Obra.
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; movId: string }> }
) {
  try {
    const { movId } = await context.params;
    const body = await req.json().catch(() => ({}));
    const { tipo, fecha, concepto, monto, moneda } = body as {
      tipo?: string;
      fecha?: string;
      concepto?: string;
      monto?: number;
      moneda?: string;
    };

    if (!tipo || !TIPOS_VALIDOS.includes(tipo)) {
      return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
    }
    if (!fecha) {
      return NextResponse.json({ error: "Falta fecha" }, { status: 400 });
    }
    if (!concepto?.trim()) {
      return NextResponse.json({ error: "Falta concepto" }, { status: 400 });
    }
    if (monto == null || monto <= 0) {
      return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
    }

    const existente = await db.movimientoCaja.findUnique({ where: { id: movId } });
    if (!existente) {
      return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 });
    }

    const movimiento = await db.movimientoCaja.update({
      where: { id: movId },
      data: {
        tipo,
        fecha: new Date(fecha),
        concepto: concepto.trim(),
        monto,
        moneda: moneda === "USD" ? "USD" : "UYU",
      },
    });

    return NextResponse.json(movimiento);
  } catch (err) {
    console.error("[PATCH /api/proyectos/[id]/flujo-caja/[movId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
