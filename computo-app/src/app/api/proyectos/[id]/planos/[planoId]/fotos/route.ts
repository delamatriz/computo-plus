import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { subirArchivoABlob, urlProxyPlano, urlProxyFoto } from "@/lib/blob";

// POST — sube una foto complementaria a un plano ya existente. No reemplaza
// al plano calibrado, es apoyo visual adicional (ver UI_UX_REDESIGN.md
// sección 6, Etapa 1).
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; planoId: string }> }
) {
  try {
    const { id: proyectoId, planoId } = await context.params;
    const body = await req.json().catch(() => null);

    if (!body?.archivo || !body?.nombreArchivoOriginal) {
      return NextResponse.json(
        { error: "Se esperaba { archivo, nombreArchivoOriginal, descripcion? }" },
        { status: 400 }
      );
    }

    let url: string;
    try {
      url = await subirArchivoABlob(`planos/${planoId}/fotos/${body.nombreArchivoOriginal}`, body.archivo);
    } catch (err) {
      console.error("[POST /api/proyectos/[id]/planos/[planoId]/fotos] subida a blob", err);
      return NextResponse.json({ error: "No se pudo subir el archivo" }, { status: 400 });
    }

    await db.fotoComplementaria.create({
      data: {
        planoId,
        archivo: url,
        nombreArchivoOriginal: body.nombreArchivoOriginal,
        descripcion: body.descripcion?.trim() || null,
      },
    });

    const plano = await db.planoProyecto.findUnique({
      where: { id: planoId },
      include: { fotos: { orderBy: { createdAt: "asc" } } },
    });
    if (!plano) {
      return NextResponse.json({ error: "Plano no encontrado" }, { status: 404 });
    }

    return NextResponse.json({
      plano: {
        ...plano,
        archivo: urlProxyPlano(proyectoId, plano.id),
        fotos: plano.fotos.map((f) => ({ ...f, archivo: urlProxyFoto(proyectoId, plano.id, f.id) })),
      },
    });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/planos/[planoId]/fotos]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
