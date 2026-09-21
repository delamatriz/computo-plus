import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { eliminarArchivosDeBlob } from "@/lib/blob";

// DELETE — borra un documento individual del contrato (no el contrato
// en sí, ver route.ts del padre — ese no tiene DELETE a propósito).
// Borra también el archivo real de Vercel Blob para no dejar basura
// pagando storage.
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { docId } = await context.params;

    const documento = await db.documentoContrato.findUnique({ where: { id: docId } });
    if (!documento) {
      return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    }

    await db.documentoContrato.delete({ where: { id: docId } });
    await eliminarArchivosDeBlob([documento.urlBlob]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/proyectos/[id]/contrato/documentos/[docId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
