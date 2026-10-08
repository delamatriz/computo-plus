import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST { ids: string[] } — nuevo orden de las secciones (flechas subir/bajar
// en la Planilla). Tiene que traer exactamente las secciones del proyecto:
// así un pedido viejo o parcial no deja dos secciones con el mismo orden.
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => null);
    const ids: unknown = body?.ids;
    if (!Array.isArray(ids) || !ids.every((x) => typeof x === "string")) {
      return NextResponse.json({ error: "Se esperaba { ids: string[] }" }, { status: 400 });
    }

    const actuales = await db.seccionPlanilla.findMany({ where: { proyectoId: id }, select: { id: true } });
    const setActuales = new Set(actuales.map((s) => s.id));
    if (ids.length !== setActuales.size || new Set(ids).size !== ids.length || !ids.every((x) => setActuales.has(x))) {
      return NextResponse.json({ error: "La lista no coincide con las secciones del proyecto" }, { status: 400 });
    }

    await db.$transaction(ids.map((seccionId, orden) => db.seccionPlanilla.update({ where: { id: seccionId }, data: { orden } })));
    const secciones = await db.seccionPlanilla.findMany({ where: { proyectoId: id }, orderBy: { orden: "asc" } });
    return NextResponse.json({ secciones });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/secciones-planilla/reordenar]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
