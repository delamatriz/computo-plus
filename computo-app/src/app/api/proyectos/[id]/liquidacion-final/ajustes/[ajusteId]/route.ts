import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const TIPOS_VALIDOS = ["Adicional", "Descuento"];

// PATCH — edita un ajuste individual.
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; ajusteId: string }> }
) {
  try {
    const { ajusteId } = await context.params;
    const body = await req.json().catch(() => ({}));
    const { concepto, monto, tipo } = body as { concepto?: string; monto?: number; tipo?: string };

    if (!concepto?.trim()) {
      return NextResponse.json({ error: "Falta concepto" }, { status: 400 });
    }
    if (monto == null || monto <= 0) {
      return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
    }
    if (!tipo || !TIPOS_VALIDOS.includes(tipo)) {
      return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
    }

    const existente = await db.ajusteLiquidacion.findUnique({ where: { id: ajusteId } });
    if (!existente) {
      return NextResponse.json({ error: "Ajuste no encontrado" }, { status: 404 });
    }

    const ajuste = await db.ajusteLiquidacion.update({
      where: { id: ajusteId },
      data: { concepto: concepto.trim(), monto, tipo },
    });

    return NextResponse.json(ajuste);
  } catch (err) {
    console.error("[PATCH /api/proyectos/[id]/liquidacion-final/ajustes/[ajusteId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE — borra un ajuste individual (no la liquidación en sí).
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; ajusteId: string }> }
) {
  try {
    const { ajusteId } = await context.params;
    const existente = await db.ajusteLiquidacion.findUnique({ where: { id: ajusteId } });
    if (!existente) {
      return NextResponse.json({ error: "Ajuste no encontrado" }, { status: 404 });
    }
    await db.ajusteLiquidacion.delete({ where: { id: ajusteId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/proyectos/[id]/liquidacion-final/ajustes/[ajusteId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
