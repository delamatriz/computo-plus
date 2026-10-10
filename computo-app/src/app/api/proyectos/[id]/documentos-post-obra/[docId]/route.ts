import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { eliminarArchivosDeBlob } from "@/lib/blob";
import { requerirProyecto } from "@/lib/sesion";

// DELETE — borra un documento individual. Borra también el archivo
// real de Vercel Blob para no dejar basura pagando storage.
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id, docId } = await context.params;
    const acceso = await requerirProyecto(id);
    if (acceso instanceof NextResponse) return acceso;

    const documento = await db.documentoPostObra.findFirst({ where: { id: docId, proyectoId: id } });
    if (!documento) {
      return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    }

    await db.documentoPostObra.delete({ where: { id: docId } });
    await eliminarArchivosDeBlob([documento.urlBlob]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/proyectos/[id]/documentos-post-obra/[docId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
