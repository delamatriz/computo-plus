import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

async function seccionDelProyecto(proyectoId: string, seccionId: string) {
  const seccion = await db.seccionPlanilla.findUnique({ where: { id: seccionId }, select: { proyectoId: true } });
  return seccion && seccion.proyectoId === proyectoId;
}

// PATCH — renombra la sección (edición inline en la Planilla). Puede llegar
// vacío mientras el usuario edita el campo: no se rechaza, igual que la
// descripción de una fila.
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; seccionId: string }> }
) {
  try {
    const { id, seccionId } = await context.params;
    const body = await req.json().catch(() => null);
    if (typeof body?.nombre !== "string") {
      return NextResponse.json({ error: "Se esperaba { nombre: string }" }, { status: 400 });
    }
    if (!(await seccionDelProyecto(id, seccionId))) {
      return NextResponse.json({ error: "Sección no encontrada" }, { status: 404 });
    }
    const seccion = await db.seccionPlanilla.update({ where: { id: seccionId }, data: { nombre: body.nombre } });
    return NextResponse.json({ seccion });
  } catch (err) {
    console.error("[PATCH /api/proyectos/[id]/secciones-planilla/[seccionId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE — borra la sección. Sus filas NO se borran: pasan a sueltas
// (FilaMetraje.seccionId tiene onDelete: SetNull en el schema).
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string; seccionId: string }> }
) {
  try {
    const { id, seccionId } = await context.params;
    if (!(await seccionDelProyecto(id, seccionId))) {
      return NextResponse.json({ error: "Sección no encontrada" }, { status: 404 });
    }
    await db.seccionPlanilla.delete({ where: { id: seccionId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/proyectos/[id]/secciones-planilla/[seccionId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
