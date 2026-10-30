import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { eliminarArchivosDeBlob } from "@/lib/blob";
import { requerirSuperadmin } from "@/lib/sesion";

// Borra un documento de la Biblioteca y su archivo en Blob (solo SUPERADMIN).
// El archivo se borra después del registro: si Blob falla queda huérfano,
// pero el documento ya no aparece (eliminarArchivosDeBlob no lanza).
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await requerirSuperadmin();
  if (sesion instanceof NextResponse) return sesion;
  try {
    const { id } = await params;
    const documento = await db.documentoBiblioteca.findUnique({ where: { id }, select: { archivo: true } });
    if (!documento) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    await db.documentoBiblioteca.delete({ where: { id } });
    await eliminarArchivosDeBlob([documento.archivo]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/biblioteca/[id]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
