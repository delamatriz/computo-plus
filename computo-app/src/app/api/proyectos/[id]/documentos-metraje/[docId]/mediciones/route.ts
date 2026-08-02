import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Marcas de medición sobre un plano — Etapa 3 de "Metrajes con plano"
// (UI_UX_REDESIGN.md sección 6, Modo A manual), primera ronda: solo
// tipo="LINEA". Requiere documento categoria=PLANO y ya calibrado
// (factorEscala != null) — mismo principio no negociable que la UI ya
// hace cumplir (herramienta oculta si no hay calibración), acá se
// valida de nuevo server-side por si acaso.

// GET — lista las marcas de medición de un documento (para dibujarlas
// al abrir el plano en el Visor).
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

    const mediciones = await db.medicionDocumento.findMany({
      where: { documentoId: docId },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ mediciones });
  } catch (err) {
    console.error("[GET /api/proyectos/[id]/documentos-metraje/[docId]/mediciones]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST — crea una marca de medición (por ahora solo tipo="LINEA").
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { docId } = await context.params;
    const body = await req.json().catch(() => null);

    const camposNumericos = [body?.xInicio, body?.yInicio, body?.xFin, body?.yFin, body?.longitudReal, body?.repeticiones];
    const numericosValidos = camposNumericos.every((v) => typeof v === "number" && isFinite(v));
    const coordsEnRango = [body?.xInicio, body?.yInicio, body?.xFin, body?.yFin].every(
      (v) => typeof v === "number" && v >= 0 && v <= 100
    );

    if (
      !numericosValidos ||
      !coordsEnRango ||
      body.longitudReal <= 0 ||
      body.repeticiones <= 0 ||
      typeof body?.descripcion !== "string" ||
      !body.descripcion.trim() ||
      (body.rubroId != null && typeof body.rubroId !== "string")
    ) {
      return NextResponse.json(
        {
          error:
            "Se esperaba { xInicio, yInicio, xFin, yFin: 0-100, longitudReal: number > 0, repeticiones: number > 0, descripcion: string, rubroId?: string | null }",
        },
        { status: 400 }
      );
    }

    const documento = await db.documentoMetraje.findUnique({
      where: { id: docId },
      select: { categoria: true, factorEscala: true },
    });
    if (!documento) {
      return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    }
    if (documento.categoria !== "PLANO") {
      return NextResponse.json({ error: "Solo se puede medir sobre un documento de categoría PLANO" }, { status: 400 });
    }
    if (documento.factorEscala == null) {
      return NextResponse.json({ error: "El plano no está calibrado — no se puede medir" }, { status: 400 });
    }

    const medicion = await db.medicionDocumento.create({
      data: {
        documentoId: docId,
        tipo: "LINEA",
        xInicio: body.xInicio,
        yInicio: body.yInicio,
        xFin: body.xFin,
        yFin: body.yFin,
        longitudReal: body.longitudReal,
        repeticiones: body.repeticiones,
        descripcion: body.descripcion.trim(),
        rubroId: body.rubroId || null,
      },
    });

    return NextResponse.json({ medicion });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/documentos-metraje/[docId]/mediciones]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
