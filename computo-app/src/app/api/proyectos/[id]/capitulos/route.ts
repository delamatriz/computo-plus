import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proyectoId } = await params;
    const body = await req.json();

    const ultimo = await db.capitulo.findFirst({
      where: { proyectoId },
      orderBy: { orden: "desc" },
      select: { orden: true },
    });

    const capitulo = await db.capitulo.create({
      data: {
        proyectoId,
        nombre:  body.nombre  ?? "Nuevo capítulo",
        codigo:  body.codigo  ?? `C${Date.now()}`,
        color:   body.color   ?? "#2563EB",
        orden:   (ultimo?.orden ?? -1) + 1,
      },
      include: { rubros: true },
    });

    return NextResponse.json(capitulo, { status: 201 });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/capitulos]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
