import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proyectoId } = await params;
    const { texto } = await req.json();

    if (typeof texto !== "string") {
      return NextResponse.json({ error: "Falta el texto" }, { status: 400 });
    }

    await db.proyecto.update({
      where: { id: proyectoId },
      data: { notasPresupuesto: texto },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[notas-presupuesto PUT]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
