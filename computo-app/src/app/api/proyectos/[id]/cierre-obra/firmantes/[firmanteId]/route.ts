import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const ROLES_VALIDOS = ["Director de obra", "Comitente", "Contratista", "Otro"];

// PATCH — edita un firmante, incluido marcar firmado.
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; firmanteId: string }> }
) {
  try {
    const { firmanteId } = await context.params;
    const body = await req.json().catch(() => ({}));
    const { nombre, rol, firmado } = body as {
      nombre?: string;
      rol?: string;
      firmado?: boolean;
    };

    if (!nombre?.trim()) {
      return NextResponse.json({ error: "Falta nombre" }, { status: 400 });
    }
    if (!rol || !ROLES_VALIDOS.includes(rol)) {
      return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
    }

    const existente = await db.firmante.findUnique({ where: { id: firmanteId } });
    if (!existente) {
      return NextResponse.json({ error: "Firmante no encontrado" }, { status: 404 });
    }

    const actualizado = await db.firmante.update({
      where: { id: firmanteId },
      data: {
        nombre: nombre.trim(),
        rol,
        firmado: firmado ?? existente.firmado,
      },
    });

    return NextResponse.json(actualizado);
  } catch (err) {
    console.error("[PATCH /api/proyectos/[id]/cierre-obra/firmantes/[firmanteId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE — borra un firmante individual (no el acta en sí).
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; firmanteId: string }> }
) {
  try {
    const { firmanteId } = await context.params;
    const existente = await db.firmante.findUnique({ where: { id: firmanteId } });
    if (!existente) {
      return NextResponse.json({ error: "Firmante no encontrado" }, { status: 404 });
    }
    await db.firmante.delete({ where: { id: firmanteId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/proyectos/[id]/cierre-obra/firmantes/[firmanteId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
