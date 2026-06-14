import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const capitulo = await db.capitulo.update({
      where: { id },
      data: {
        ...("fechaInicio" in body && { fechaInicio: body.fechaInicio ? new Date(body.fechaInicio) : null }),
        ...("fechaFin" in body && { fechaFin: body.fechaFin ? new Date(body.fechaFin) : null }),
      },
    });

    return NextResponse.json(capitulo);
  } catch (err) {
    console.error("[PATCH /api/capitulos/[id]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
