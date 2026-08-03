import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// DELETE — borra una marca de referencia (corrección de una marca mal
// puesta, mismo criterio que .../mediciones/[medicionId]).
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string; docId: string; marcaId: string }> }
) {
  try {
    const { docId, marcaId } = await context.params;

    const marca = await db.marcaReferencia.findUnique({
      where: { id: marcaId },
      select: { documentoId: true },
    });
    if (!marca || marca.documentoId !== docId) {
      return NextResponse.json({ error: "Marca no encontrada" }, { status: 404 });
    }

    await db.marcaReferencia.delete({ where: { id: marcaId } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/proyectos/[id]/documentos-metraje/[docId]/marcas/[marcaId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
