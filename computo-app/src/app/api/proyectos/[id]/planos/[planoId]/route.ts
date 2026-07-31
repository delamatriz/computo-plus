import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET — detalle completo de un plano (incluye `archivo` en base64, para el
// visor) más sus fotos complementarias.
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string; planoId: string }> }
) {
  try {
    const { planoId } = await context.params;

    const plano = await db.planoProyecto.findUnique({
      where: { id: planoId },
      include: { fotos: { orderBy: { createdAt: "asc" } } },
    });

    if (!plano) {
      return NextResponse.json({ error: "Plano no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ plano });
  } catch (err) {
    console.error("[GET /api/proyectos/[id]/planos/[planoId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// PATCH — actualiza las notas del plano (observaciones del relevamiento,
// absorbido de la vieja card "Documentación"). Único campo editable por
// ahora; nombre/archivo no se editan en esta etapa.
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; planoId: string }> }
) {
  try {
    const { planoId } = await context.params;
    const body = await req.json().catch(() => null);

    if (typeof body?.notas !== "string" && body?.notas !== null) {
      return NextResponse.json({ error: "Se esperaba { notas: string | null }" }, { status: 400 });
    }

    const plano = await db.planoProyecto.update({
      where: { id: planoId },
      data: { notas: body.notas?.trim() || null },
      include: { fotos: { orderBy: { createdAt: "asc" } } },
    });

    return NextResponse.json({ plano });
  } catch (err) {
    console.error("[PATCH /api/proyectos/[id]/planos/[planoId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE — elimina el plano; las fotos complementarias se borran en cascada
// (onDelete: Cascade en el schema).
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string; planoId: string }> }
) {
  try {
    const { planoId } = await context.params;
    await db.planoProyecto.delete({ where: { id: planoId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/proyectos/[id]/planos/[planoId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
