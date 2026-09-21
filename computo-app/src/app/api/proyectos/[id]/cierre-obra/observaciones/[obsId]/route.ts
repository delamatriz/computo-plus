import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const ESTADOS_VALIDOS = ["Aprobado sin observaciones", "Con observaciones pendientes"];

// PATCH — edita una observación de cierre individual.
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; obsId: string }> }
) {
  try {
    const { obsId } = await context.params;
    const body = await req.json().catch(() => ({}));
    const { rubroId, observacion, estado } = body as {
      rubroId?: string;
      observacion?: string;
      estado?: string;
    };

    if (!rubroId) {
      return NextResponse.json({ error: "Falta rubroId" }, { status: 400 });
    }
    if (!observacion?.trim()) {
      return NextResponse.json({ error: "Falta observación" }, { status: 400 });
    }
    if (estado && !ESTADOS_VALIDOS.includes(estado)) {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    }

    const existente = await db.observacionCierreRubro.findUnique({ where: { id: obsId } });
    if (!existente) {
      return NextResponse.json({ error: "Observación no encontrada" }, { status: 404 });
    }

    const actualizada = await db.observacionCierreRubro.update({
      where: { id: obsId },
      data: {
        rubroId,
        observacion: observacion.trim(),
        estado: estado ?? existente.estado,
      },
      include: { rubro: { select: { id: true, codigo: true, descripcion: true, capitulo: { select: { nombre: true } } } } },
    });

    return NextResponse.json(actualizada);
  } catch (err) {
    console.error("[PATCH /api/proyectos/[id]/cierre-obra/observaciones/[obsId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE — borra una observación individual (no el acta en sí).
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; obsId: string }> }
) {
  try {
    const { obsId } = await context.params;
    const existente = await db.observacionCierreRubro.findUnique({ where: { id: obsId } });
    if (!existente) {
      return NextResponse.json({ error: "Observación no encontrada" }, { status: 404 });
    }
    await db.observacionCierreRubro.delete({ where: { id: obsId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/proyectos/[id]/cierre-obra/observaciones/[obsId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
