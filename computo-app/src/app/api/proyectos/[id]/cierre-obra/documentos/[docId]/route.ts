import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { eliminarArchivosDeBlob } from "@/lib/blob";

// DELETE — borra un documento individual del acta de cierre (no el
// acta en sí). Borra también el archivo real de Vercel Blob.
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { docId } = await context.params;

    const documento = await db.documentoActaCierre.findUnique({ where: { id: docId } });
    if (!documento) {
      return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    }

    await db.documentoActaCierre.delete({ where: { id: docId } });
    await eliminarArchivosDeBlob([documento.urlBlob]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/proyectos/[id]/cierre-obra/documentos/[docId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
