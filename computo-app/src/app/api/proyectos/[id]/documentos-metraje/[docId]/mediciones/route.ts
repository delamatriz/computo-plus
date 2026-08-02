import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Marcas de medición sobre un plano — Etapa 3 de "Metrajes con plano"
// (UI_UX_REDESIGN.md sección 6, Modo A manual). Dos tipos hoy: "LINEA"
// (dos puntos fijos) y "AREA" (polígono de N vértices, N >= 3). Requiere
// documento categoria=PLANO y ya calibrado (factorEscala != null) —
// mismo principio no negociable que la UI ya hace cumplir (herramienta
// oculta si no hay calibración), acá se valida de nuevo server-side por
// si acaso.

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

// Validación de los campos comunes a cualquier tipo — descripción,
// repeticiones, rubro. Devuelve el mensaje de error o null si está OK.
function validarComun(body: unknown): string | null {
  const b = body as Record<string, unknown> | null;
  if (
    typeof b?.repeticiones !== "number" ||
    !isFinite(b.repeticiones) ||
    b.repeticiones <= 0 ||
    typeof b?.descripcion !== "string" ||
    !b.descripcion.trim() ||
    (b?.rubroId != null && typeof b.rubroId !== "string")
  ) {
    return "descripcion: string, repeticiones: number > 0, rubroId?: string | null";
  }
  return null;
}

function validarPuntoXY(p: unknown): p is { x: number; y: number } {
  if (typeof p !== "object" || p === null) return false;
  const punto = p as Record<string, unknown>;
  return (
    typeof punto.x === "number" && isFinite(punto.x) && punto.x >= 0 && punto.x <= 100 &&
    typeof punto.y === "number" && isFinite(punto.y) && punto.y >= 0 && punto.y <= 100
  );
}

// POST — crea una marca de medición. tipo="LINEA" (dos puntos fijos) o
// tipo="AREA" (polígono de N >= 3 vértices).
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { docId } = await context.params;
    const body = await req.json().catch(() => null);
    const tipo = body?.tipo === "AREA" ? "AREA" : "LINEA";

    const errorComun = validarComun(body);
    if (errorComun) {
      return NextResponse.json({ error: `Se esperaba { ${errorComun} }` }, { status: 400 });
    }

    const datosComunes = {
      documentoId: docId,
      repeticiones: body.repeticiones as number,
      descripcion: (body.descripcion as string).trim(),
      rubroId: (body.rubroId as string | null | undefined) || null,
    };

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

    let medicion;

    if (tipo === "AREA") {
      const puntos = body?.puntos;
      const puntosValidos = Array.isArray(puntos) && puntos.length >= 3 && puntos.every(validarPuntoXY);
      const areaValida = typeof body?.areaReal === "number" && isFinite(body.areaReal) && body.areaReal > 0;
      if (!puntosValidos || !areaValida) {
        return NextResponse.json(
          { error: "Se esperaba { puntos: [{x,y: 0-100}, ...] con mínimo 3, areaReal: number > 0 }" },
          { status: 400 }
        );
      }
      medicion = await db.medicionDocumento.create({
        data: { ...datosComunes, tipo: "AREA", puntos, areaReal: body.areaReal },
      });
    } else {
      const camposNumericos = [body?.xInicio, body?.yInicio, body?.xFin, body?.yFin, body?.longitudReal];
      const numericosValidos = camposNumericos.every((v) => typeof v === "number" && isFinite(v));
      const coordsEnRango = [body?.xInicio, body?.yInicio, body?.xFin, body?.yFin].every(
        (v) => typeof v === "number" && v >= 0 && v <= 100
      );
      if (!numericosValidos || !coordsEnRango || body.longitudReal <= 0) {
        return NextResponse.json(
          { error: "Se esperaba { xInicio, yInicio, xFin, yFin: 0-100, longitudReal: number > 0 }" },
          { status: 400 }
        );
      }
      medicion = await db.medicionDocumento.create({
        data: {
          ...datosComunes,
          tipo: "LINEA",
          xInicio: body.xInicio,
          yInicio: body.yInicio,
          xFin: body.xFin,
          yFin: body.yFin,
          longitudReal: body.longitudReal,
        },
      });
    }

    return NextResponse.json({ medicion });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/documentos-metraje/[docId]/mediciones]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
