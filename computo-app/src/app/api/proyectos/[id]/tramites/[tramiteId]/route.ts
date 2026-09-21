import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const ESTADOS_VALIDOS = ["Pendiente", "En trámite", "Aprobado", "Rechazado"];

// PATCH — edita un trámite legal, incluido cambiar estado. Sin
// DELETE a propósito — mismo criterio que los módulos anteriores de
// Gestión de Obra.
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; tramiteId: string }> }
) {
  try {
    const { tramiteId } = await context.params;
    const body = await req.json().catch(() => ({}));
    const { nombre, organismo, estado, fecha, observaciones } = body as {
      nombre?: string;
      organismo?: string;
      estado?: string;
      fecha?: string;
      observaciones?: string;
    };

    if (!nombre?.trim()) {
      return NextResponse.json({ error: "Falta nombre" }, { status: 400 });
    }
    if (estado && !ESTADOS_VALIDOS.includes(estado)) {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    }

    const existente = await db.tramiteLegal.findUnique({ where: { id: tramiteId } });
    if (!existente) {
      return NextResponse.json({ error: "Trámite no encontrado" }, { status: 404 });
    }

    const tramite = await db.tramiteLegal.update({
      where: { id: tramiteId },
      data: {
        nombre: nombre.trim(),
        organismo: organismo?.trim() || null,
        estado: estado ?? existente.estado,
        fecha: fecha ? new Date(fecha) : null,
        observaciones: observaciones?.trim() || null,
      },
    });

    return NextResponse.json(tramite);
  } catch (err) {
    console.error("[PATCH /api/proyectos/[id]/tramites/[tramiteId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
