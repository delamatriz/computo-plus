import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST — sube una foto complementaria a un plano ya existente. No reemplaza
// al plano calibrado, es apoyo visual adicional (ver UI_UX_REDESIGN.md
// sección 6, Etapa 1).
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; planoId: string }> }
) {
  try {
    const { planoId } = await context.params;
    const body = await req.json().catch(() => null);

    if (!body?.archivo || !body?.nombreArchivoOriginal) {
      return NextResponse.json(
        { error: "Se esperaba { archivo, nombreArchivoOriginal, descripcion? }" },
        { status: 400 }
      );
    }

    await db.fotoComplementaria.create({
      data: {
        planoId,
        archivo: body.archivo,
        nombreArchivoOriginal: body.nombreArchivoOriginal,
        descripcion: body.descripcion?.trim() || null,
      },
    });

    const plano = await db.planoProyecto.findUnique({
      where: { id: planoId },
      include: { fotos: { orderBy: { createdAt: "asc" } } },
    });

    return NextResponse.json({ plano });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/planos/[planoId]/fotos]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
