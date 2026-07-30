import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id: proyectoId, docId } = await context.params;

    const doc = await db.documentoLlamado.findUnique({ where: { id: docId } });
    if (!doc || doc.proyectoId !== proyectoId) {
      return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    }

    await db.documentoLlamado.delete({ where: { id: docId } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/proyectos/[id]/documentos/[docId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
