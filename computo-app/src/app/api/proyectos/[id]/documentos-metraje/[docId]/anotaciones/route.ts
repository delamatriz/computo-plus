import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Anotaciones libres sobre un plano — herramientas de ANOTACIÓN (no de
// medición), ver comentario en prisma/schema.prisma. Igual que
// /mediciones para el gate de categoría, pero sin exigir calibración
// (no miden nada): solo que el documento sea categoria=PLANO.

function validarPuntoXY(x: unknown, y: unknown): boolean {
  return (
    typeof x === "number" && isFinite(x) && x >= 0 && x <= 100 &&
    typeof y === "number" && isFinite(y) && y >= 0 && y <= 100
  );
}

function validarPuntos(puntos: unknown): puntos is { x: number; y: number }[] {
  if (!Array.isArray(puntos) || puntos.length < 2) return false;
  return puntos.every((p) => p && typeof p === "object" && validarPuntoXY((p as Record<string, unknown>).x, (p as Record<string, unknown>).y));
}

// GET — lista las anotaciones de un documento (para dibujarlas al abrir
// el plano en el Visor).
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

    const anotaciones = await db.anotacion.findMany({
      where: { documentoId: docId },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ anotaciones });
  } catch (err) {
    console.error("[GET /api/proyectos/[id]/documentos-metraje/[docId]/anotaciones]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST — crea una anotación (TRAZO o TEXTO).
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { docId } = await context.params;
    const body = await req.json().catch(() => null);

    if (body?.tipo !== "TRAZO" && body?.tipo !== "TEXTO") {
      return NextResponse.json({ error: "tipo tiene que ser 'TRAZO' o 'TEXTO'" }, { status: 400 });
    }

    const documento = await db.documentoMetraje.findUnique({
      where: { id: docId },
      select: { categoria: true },
    });
    if (!documento) {
      return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    }
    if (documento.categoria !== "PLANO") {
      return NextResponse.json({ error: "Solo se puede anotar sobre un documento de categoría PLANO" }, { status: 400 });
    }

    if (body.tipo === "TRAZO") {
      if (!validarPuntos(body.puntos)) {
        return NextResponse.json({ error: "Se esperaba { tipo: 'TRAZO', puntos: [{x,y: 0-100}, ...] (mínimo 2) }" }, { status: 400 });
      }
      const anotacion = await db.anotacion.create({
        data: { documentoId: docId, tipo: "TRAZO", puntos: body.puntos },
      });
      return NextResponse.json({ anotacion });
    }

    // TEXTO
    const texto = typeof body.texto === "string" ? body.texto.trim() : "";
    const tamano = typeof body.tamano === "number" && isFinite(body.tamano) ? body.tamano : NaN;
    if (!texto || texto.length > 200 || !validarPuntoXY(body.x, body.y) || !isFinite(tamano) || tamano < 8 || tamano > 72) {
      return NextResponse.json(
        { error: "Se esperaba { tipo: 'TEXTO', x, y: 0-100, texto: string (1-200 caracteres), tamano: 8-72 }" },
        { status: 400 }
      );
    }
    const anotacion = await db.anotacion.create({
      data: { documentoId: docId, tipo: "TEXTO", x: body.x, y: body.y, texto, tamano },
    });
    return NextResponse.json({ anotacion });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/documentos-metraje/[docId]/anotaciones]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
