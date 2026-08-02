import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { eliminarArchivosDeBlob, urlProxyDocumentoMetraje } from "@/lib/blob";

// El campo `archivo` en la base guarda la URL real (privada) de Vercel
// Blob — no servible directo por el browser. Antes de responder al cliente
// se reemplaza por la ruta proxy de nuestro servidor (ver
// urlProxyDocumentoMetraje en @/lib/blob), que sí puede ir directo en
// <img src>/<Document file>.
function conUrlProxy<T extends { id: string; archivo: string }>(proyectoId: string, doc: T) {
  return { ...doc, archivo: urlProxyDocumentoMetraje(proyectoId, doc.id) };
}

// GET — detalle completo de un documento (incluye `archivo`, para el visor).
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id: proyectoId, docId } = await context.params;

    const documento = await db.documentoMetraje.findUnique({ where: { id: docId } });
    if (!documento) {
      return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ documento: conUrlProxy(proyectoId, documento) });
  } catch (err) {
    console.error("[GET /api/proyectos/[id]/documentos-metraje/[docId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// PATCH — guarda la calibración de escala de un plano (Etapa 2 de
// "Metrajes con plano", UI_UX_REDESIGN.md sección 6, Método B: escala
// declarada). Solo tiene sentido para categoria=PLANO — se valida acá
// porque el modelo unificado no lo restringe a nivel de schema.
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id: proyectoId, docId } = await context.params;
    const body = await req.json().catch(() => null);

    if (
      typeof body?.escalaDeclarada !== "string" ||
      !body.escalaDeclarada.trim() ||
      typeof body?.factorEscala !== "number" ||
      !isFinite(body.factorEscala) ||
      body.factorEscala <= 0 ||
      body?.metodoCalibracion !== "DECLARADA"
    ) {
      return NextResponse.json(
        { error: "Se esperaba { escalaDeclarada: string, factorEscala: number > 0, metodoCalibracion: 'DECLARADA' }" },
        { status: 400 }
      );
    }

    const existente = await db.documentoMetraje.findUnique({
      where: { id: docId },
      select: { categoria: true },
    });
    if (!existente) {
      return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    }
    if (existente.categoria !== "PLANO") {
      return NextResponse.json({ error: "Solo se puede calibrar un documento de categoría PLANO" }, { status: 400 });
    }

    const documento = await db.documentoMetraje.update({
      where: { id: docId },
      data: {
        escalaDeclarada: body.escalaDeclarada.trim(),
        factorEscala: body.factorEscala,
        metodoCalibracion: body.metodoCalibracion,
      },
    });

    return NextResponse.json({ documento: conUrlProxy(proyectoId, documento) });
  } catch (err) {
    console.error("[PATCH /api/proyectos/[id]/documentos-metraje/[docId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE — elimina el documento. El archivo en Vercel Blob no se borra solo
// al borrar la fila de Postgres, así que se busca antes y se elimina aparte
// para no dejar huérfanos.
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { docId } = await context.params;

    const documento = await db.documentoMetraje.findUnique({
      where: { id: docId },
      select: { archivo: true },
    });
    if (!documento) {
      return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    }

    await db.documentoMetraje.delete({ where: { id: docId } });

    await eliminarArchivosDeBlob([documento.archivo]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/proyectos/[id]/documentos-metraje/[docId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
