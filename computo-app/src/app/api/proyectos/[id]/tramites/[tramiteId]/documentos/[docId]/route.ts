import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { eliminarArchivosDeBlob } from "@/lib/blob";
import { requerirProyecto } from "@/lib/sesion";

// DELETE — borra un documento del trámite (no el trámite: ese no se borra,
// ver ../../route.ts) y su archivo en Vercel Blob.
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; tramiteId: string; docId: string }> }
) {
  try {
    const { id, tramiteId, docId } = await context.params;
    const acceso = await requerirProyecto(id);
    if (acceso instanceof NextResponse) return acceso;

    const documento = await db.documentoTramite.findFirst({
      where: { id: docId, tramiteLegalId: tramiteId, tramiteLegal: { proyectoId: id } },
    });
    if (!documento) {
      return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    }

    await db.documentoTramite.delete({ where: { id: docId } });
    await eliminarArchivosDeBlob([documento.urlBlob]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/proyectos/[id]/tramites/[tramiteId]/documentos/[docId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
