import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Buzón de Sugerencias (/sugerencias) — texto libre, sin categorías.
// Orden por más reciente primero: es un buzón, no un historial cronológico.
export async function GET() {
  try {
    const sugerencias = await db.sugerencia.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(sugerencias);
  } catch (err) {
    console.error("[GET /api/sugerencias]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { mensaje } = await req.json();

    if (!mensaje || !String(mensaje).trim()) {
      return NextResponse.json({ error: "El mensaje es obligatorio" }, { status: 400 });
    }

    const sugerencia = await db.sugerencia.create({
      data: { mensaje: String(mensaje).trim() },
    });

    return NextResponse.json(sugerencia, { status: 201 });
  } catch (err) {
    console.error("[POST /api/sugerencias]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
