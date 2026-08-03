import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Marcas de referencia sobre un plano — herramienta de ANOTACIÓN (no de
// medición), ver comentario en prisma/schema.prisma. A diferencia de
// /mediciones, NO requiere calibración (no mide nada) — solo que el
// documento sea categoria=PLANO.

// GET — lista las marcas de un documento (para dibujarlas al abrir el
// plano en el Visor).
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { docId } = await context.params;

    const documento = await db.documentoMetraje.findUnique({ where: { id: docId }, select: { id: true } });
    if (!documento) {
      return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    }

    const marcas = await db.marcaReferencia.findMany({
      where: { documentoId: docId },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ marcas });
  } catch (err) {
    console.error("[GET /api/proyectos/[id]/documentos-metraje/[docId]/marcas]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST — crea una marca de referencia.
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { docId } = await context.params;
    const body = await req.json().catch(() => null);

    const letra = typeof body?.letra === "string" ? body.letra.trim() : "";
    const coordsValidas =
      typeof body?.x === "number" && isFinite(body.x) && body.x >= 0 && body.x <= 100 &&
      typeof body?.y === "number" && isFinite(body.y) && body.y >= 0 && body.y <= 100;

    if (!letra || letra.length > 4 || !coordsValidas) {
      return NextResponse.json(
        { error: "Se esperaba { letra: string (1-4 caracteres), x, y: 0-100 }" },
        { status: 400 }
      );
    }

    const documento = await db.documentoMetraje.findUnique({
      where: { id: docId },
      select: { categoria: true },
    });
    if (!documento) {
      return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    }
    if (documento.categoria !== "PLANO") {
      return NextResponse.json({ error: "Solo se puede marcar sobre un documento de categoría PLANO" }, { status: 400 });
    }

    const marca = await db.marcaReferencia.create({
      data: { documentoId: docId, letra, x: body.x, y: body.y },
    });

    return NextResponse.json({ marca });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/documentos-metraje/[docId]/marcas]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
