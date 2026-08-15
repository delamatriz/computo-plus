import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rubroCompatibleConFila } from "@/components/metrajes/metrajeFila";

// POST — crea una fila de la Planilla de cómputo para este documento
// (manual, generada por IA, o puente de una medición recién dibujada —
// ver medicionId). Listado/edición/borrado son a nivel de proyecto, ver
// /api/proyectos/[id]/filas-metraje — la creación sí necesita saber a
// qué documento pertenece la fila nueva. descripcion puede venir vacía
// ("Agregar fila" persiste una fila en blanco de entrada, igual que
// antes vivía en memoria vacía hasta que el usuario tipeaba).
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { docId } = await context.params;
    const body = await req.json().catch(() => null);

    if (typeof body?.descripcion !== "string") {
      return NextResponse.json({ error: "Se esperaba { descripcion: string }" }, { status: 400 });
    }

    const documento = await db.documentoMetraje.findUnique({ where: { id: docId }, select: { id: true } });
    if (!documento) {
      return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    }

    const numOrNull = (v: unknown): number | null =>
      typeof v === "number" && isFinite(v) ? v : null;

    let unidad: string | null = typeof body.unidad === "string" ? body.unidad : null;
    const rubroId: string | null = typeof body.rubroId === "string" ? body.rubroId : null;

    if (rubroId) {
      const rubro = await db.rubro.findUnique({ where: { id: rubroId }, select: { unidad: true } });
      if (!rubro) {
        return NextResponse.json({ error: "Rubro no encontrado" }, { status: 404 });
      }
      if (unidad && !rubroCompatibleConFila(unidad, rubro.unidad)) {
        return NextResponse.json(
          { error: `La unidad de la fila (${unidad}) no coincide con la del rubro (${rubro.unidad})` },
          { status: 400 }
        );
      }
      if (!unidad) unidad = rubro.unidad;
    }

    const medicionId = typeof body.medicionId === "string" ? body.medicionId : null;
    if (medicionId) {
      const medicion = await db.medicionDocumento.findUnique({ where: { id: medicionId }, select: { documentoId: true } });
      if (!medicion || medicion.documentoId !== docId) {
        return NextResponse.json({ error: "Medición no encontrada" }, { status: 404 });
      }
    }

    const fila = await db.filaMetraje.create({
      data: {
        documentoId: docId,
        descripcion: body.descripcion.trim(),
        largo: numOrNull(body.largo),
        ancho: numOrNull(body.ancho),
        alto: numOrNull(body.alto),
        cantidad: numOrNull(body.cantidad),
        unidad,
        rubroId,
        medicionId,
      },
    });

    return NextResponse.json({ fila });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/documentos-metraje/[docId]/filas-metraje]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
