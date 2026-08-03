import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// DELETE — borra una anotación (corrección de un trazo/texto mal
// puesto), mismo criterio que .../mediciones/[medicionId].
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string; docId: string; anotacionId: string }> }
) {
  try {
    const { docId, anotacionId } = await context.params;

    const anotacion = await db.anotacion.findUnique({
      where: { id: anotacionId },
      select: { documentoId: true },
    });
    if (!anotacion || anotacion.documentoId !== docId) {
      return NextResponse.json({ error: "Anotación no encontrada" }, { status: 404 });
    }

    await db.anotacion.delete({ where: { id: anotacionId } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/proyectos/[id]/documentos-metraje/[docId]/anotaciones/[anotacionId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
