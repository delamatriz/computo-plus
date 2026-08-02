import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// DELETE — borra una marca de medición (corrección de un trazo mal hecho,
// ver /mediciones/route.ts para GET+POST). Valida que la medición
// pertenezca al documento de la URL antes de borrar, para no depender
// únicamente del id.
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string; docId: string; medicionId: string }> }
) {
  try {
    const { docId, medicionId } = await context.params;

    const medicion = await db.medicionDocumento.findUnique({
      where: { id: medicionId },
      select: { documentoId: true },
    });
    if (!medicion || medicion.documentoId !== docId) {
      return NextResponse.json({ error: "Medición no encontrada" }, { status: 404 });
    }

    await db.medicionDocumento.delete({ where: { id: medicionId } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/proyectos/[id]/documentos-metraje/[docId]/mediciones/[medicionId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
