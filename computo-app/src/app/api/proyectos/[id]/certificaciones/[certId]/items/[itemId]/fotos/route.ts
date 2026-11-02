import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requerirProyecto, hijoNoEncontrado } from "@/lib/sesion";
import { ArchivoInvalidoError, validarArchivoSubido } from "@/lib/archivosSubidos";

// Fotos por pedido: la pantalla sube de a pocas; más que esto es un abuso.
const MAX_FOTOS_POR_PEDIDO = 20;

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; certId: string; itemId: string }> }
) {
  try {
    const { id, certId, itemId } = await context.params;
    const acceso = await requerirProyecto(id);
    if (acceso instanceof NextResponse) return acceso;
    const itemOk = await db.certificacionItem.findFirst({
      where: { id: itemId, certificacionId: certId, certificacion: { proyectoId: id } },
      select: { id: true },
    });
    if (!itemOk) return hijoNoEncontrado("Ítem no encontrado");

    const fotos = await db.fotoCertificacionItem.findMany({
      where: { certificacionItemId: itemId },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ fotos });
  } catch (err) {
    console.error("[GET /api/proyectos/[id]/certificaciones/[certId]/items/[itemId]/fotos]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; certId: string; itemId: string }> }
) {
  try {
    const { id, certId, itemId } = await context.params;
    const acceso = await requerirProyecto(id);
    if (acceso instanceof NextResponse) return acceso;
    const itemOk = await db.certificacionItem.findFirst({
      where: { id: itemId, certificacionId: certId, certificacion: { proyectoId: id } },
      select: { id: true },
    });
    if (!itemOk) return hijoNoEncontrado("Ítem no encontrado");
    const body = await req.json().catch(() => null);

    if (!body || !Array.isArray(body.fotos)) {
      return NextResponse.json({ error: "Se esperaba { fotos: string[] }" }, { status: 400 });
    }

    // Se guardan como data URL. Solo imágenes, por sus primeros bytes (no
    // SVG), hasta 5 MB cada una, y rotuladas con el tipo real
    // (lib/archivosSubidos.ts).
    if (body.fotos.length > MAX_FOTOS_POR_PEDIDO) {
      return NextResponse.json({ error: `Se pueden subir hasta ${MAX_FOTOS_POR_PEDIDO} fotos por vez` }, { status: 400 });
    }
    let fotos: string[];
    try {
      fotos = (body.fotos as unknown[]).map((f) => {
        const { buffer, contentType } = validarArchivoSubido(f, "foto");
        return `data:${contentType};base64,${buffer.toString("base64")}`;
      });
    } catch (err) {
      if (err instanceof ArchivoInvalidoError) return NextResponse.json({ error: err.message }, { status: 400 });
      throw err;
    }

    await db.$transaction(
      fotos.map((url) =>
        db.fotoCertificacionItem.create({
          data: { certificacionItemId: itemId, url },
        })
      )
    );

    const todasLasFotos = await db.fotoCertificacionItem.findMany({
      where: { certificacionItemId: itemId },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ fotos: todasLasFotos });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/certificaciones/[certId]/items/[itemId]/fotos]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; certId: string; itemId: string }> }
) {
  try {
    const { id, certId, itemId } = await context.params;
    const acceso = await requerirProyecto(id);
    if (acceso instanceof NextResponse) return acceso;
    const itemOk = await db.certificacionItem.findFirst({
      where: { id: itemId, certificacionId: certId, certificacion: { proyectoId: id } },
      select: { id: true },
    });
    if (!itemOk) return hijoNoEncontrado("Ítem no encontrado");
    const body = await req.json().catch(() => null);

    if (!body?.fotoId) {
      return NextResponse.json({ error: "Se esperaba { fotoId: string }" }, { status: 400 });
    }

    const borradas = await db.fotoCertificacionItem.deleteMany({ where: { id: body.fotoId, certificacionItemId: itemId } });
    if (borradas.count === 0) return hijoNoEncontrado("Foto no encontrada");

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/proyectos/[id]/certificaciones/[certId]/items/[itemId]/fotos]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
