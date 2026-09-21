import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const TIPOS_VALIDOS = ["Ingreso", "Egreso"];

// GET — lista los movimientos de caja del proyecto, orden fecha
// ascendente (y createdAt como desempate estable en la misma fecha) —
// para que el saldo acumulado se lea de arriba a abajo como un
// extracto real, no al revés.
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const movimientos = await db.movimientoCaja.findMany({
      where: { proyectoId: id },
      orderBy: [{ fecha: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json(movimientos);
  } catch (err) {
    console.error("[GET /api/proyectos/[id]/flujo-caja]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST — crea un movimiento de caja.
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
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

    const proyecto = await db.proyecto.findUnique({ where: { id }, select: { id: true } });
    if (!proyecto) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const movimiento = await db.movimientoCaja.create({
      data: {
        proyectoId: id,
        tipo,
        fecha: new Date(fecha),
        concepto: concepto.trim(),
        monto,
        moneda: moneda === "USD" ? "USD" : "UYU",
      },
    });

    return NextResponse.json(movimiento, { status: 201 });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/flujo-caja]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
