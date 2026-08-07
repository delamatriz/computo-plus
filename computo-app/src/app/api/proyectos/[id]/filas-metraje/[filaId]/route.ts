import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { unidadesCoinciden } from "@/components/metrajes/metrajeFila";

const CAMPOS_NUMERICOS = ["largo", "ancho", "alto", "cantidad"] as const;

// PATCH — actualiza una o varias columnas de una fila (edición inline
// desde la Planilla). Si el patch toca rubroId o unidad, valida que la
// unidad de la fila coincida con la del Rubro antes de guardar — no se
// puede vincular una fila a un Rubro de unidad distinta (m² vs m³, etc).
// Si la fila todavía no tenía unidad propia, se autocompleta con la del
// Rubro en el mismo update (ver diseño confirmado — sección 4).
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; filaId: string }> }
) {
  try {
    const { id, filaId } = await context.params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Body inválido" }, { status: 400 });
    }

    const fila = await db.filaMetraje.findUnique({
      where: { id: filaId },
      select: { id: true, unidad: true, rubroId: true, documento: { select: { proyectoId: true } } },
    });
    if (!fila || fila.documento.proyectoId !== id) {
      return NextResponse.json({ error: "Fila no encontrada" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};

    if ("descripcion" in body) {
      // Puede llegar vacía mientras el usuario está editando el campo
      // (seleccionar todo + retipear pasa por un estado intermedio en
      // blanco) — no se rechaza, igual que el resto de los campos.
      if (typeof body.descripcion !== "string") {
        return NextResponse.json({ error: "descripcion tiene que ser string" }, { status: 400 });
      }
      data.descripcion = body.descripcion;
    }

    for (const campo of CAMPOS_NUMERICOS) {
      if (campo in body) {
        const v = body[campo];
        if (v !== null && (typeof v !== "number" || !isFinite(v))) {
          return NextResponse.json({ error: `${campo} tiene que ser number o null` }, { status: 400 });
        }
        data[campo] = v;
      }
    }

    // Unidad/rubro efectivos tras este patch (lo que viene en el body,
    // o si no viene, lo que la fila ya tenía guardado).
    const unidadEfectiva: string | null = "unidad" in body ? (body.unidad || null) : fila.unidad;
    const rubroIdEfectivo: string | null = "rubroId" in body ? (body.rubroId || null) : fila.rubroId;

    if ("unidad" in body) {
      if (body.unidad !== null && typeof body.unidad !== "string") {
        return NextResponse.json({ error: "unidad tiene que ser string o null" }, { status: 400 });
      }
      data.unidad = body.unidad || null;
    }
    if ("rubroId" in body) {
      if (body.rubroId !== null && typeof body.rubroId !== "string") {
        return NextResponse.json({ error: "rubroId tiene que ser string o null" }, { status: 400 });
      }
      data.rubroId = body.rubroId || null;
    }

    if (rubroIdEfectivo) {
      const rubro = await db.rubro.findUnique({ where: { id: rubroIdEfectivo }, select: { unidad: true } });
      if (!rubro) {
        return NextResponse.json({ error: "Rubro no encontrado" }, { status: 404 });
      }
      if (unidadEfectiva) {
        if (!unidadesCoinciden(unidadEfectiva, rubro.unidad)) {
          return NextResponse.json(
            { error: `La unidad de la fila (${unidadEfectiva}) no coincide con la del rubro (${rubro.unidad})` },
            { status: 400 }
          );
        }
      } else {
        // Fila sin unidad propia todavía — la hereda del rubro al vincularse.
        data.unidad = rubro.unidad;
      }
    }

    const actualizada = await db.filaMetraje.update({ where: { id: filaId }, data });
    return NextResponse.json({ fila: actualizada });
  } catch (err) {
    console.error("[PATCH /api/proyectos/[id]/filas-metraje/[filaId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE — borra una fila de la Planilla (manual, IA, o vinculada a una
// medición que ya se borró por su cuenta).
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string; filaId: string }> }
) {
  try {
    const { id, filaId } = await context.params;

    const fila = await db.filaMetraje.findUnique({
      where: { id: filaId },
      select: { documento: { select: { proyectoId: true } } },
    });
    if (!fila || fila.documento.proyectoId !== id) {
      return NextResponse.json({ error: "Fila no encontrada" }, { status: 404 });
    }

    await db.filaMetraje.delete({ where: { id: filaId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/proyectos/[id]/filas-metraje/[filaId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
