import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolverCapituloCatalogoId } from "@/lib/capituloCatalogoResolver";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proyectoId } = await params;
    const body = await req.json();
    const nombre = body.nombre ?? "Nuevo capítulo";

    const [ultimo, capituloCatalogoId] = await Promise.all([
      db.capitulo.findFirst({
        where: { proyectoId },
        orderBy: { orden: "desc" },
        select: { orden: true },
      }),
      resolverCapituloCatalogoId(db, nombre),
    ]);

    const capitulo = await db.capitulo.create({
      data: {
        proyectoId,
        nombre,
        codigo:  body.codigo  ?? `C${Date.now()}`,
        color:   body.color   ?? "#2563EB",
        orden:   (ultimo?.orden ?? -1) + 1,
        capituloCatalogoId,
      },
      include: { rubros: true },
    });

    return NextResponse.json(capitulo, { status: 201 });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/capitulos]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
