import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Único campo editable hoy: resuelta (el checkbox de la lista). El
// mensaje en sí no tiene edición — es un buzón, no un documento.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    if (typeof body.resuelta !== "boolean") {
      return NextResponse.json({ error: "resuelta debe ser boolean" }, { status: 400 });
    }

    const sugerencia = await db.sugerencia.update({
      where: { id },
      data: { resuelta: body.resuelta },
    });

    return NextResponse.json(sugerencia);
  } catch (err) {
    console.error("[PATCH /api/sugerencias/[id]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
