import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const ESTADOS_VALIDOS = ["Pendiente", "En trámite", "Aprobado", "Rechazado"];

// GET — lista los trámites legales del proyecto.
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const tramites = await db.tramiteLegal.findMany({
      where: { proyectoId: id },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(tramites);
  } catch (err) {
    console.error("[GET /api/proyectos/[id]/tramites]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST — crea un trámite legal.
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
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

    const proyecto = await db.proyecto.findUnique({ where: { id }, select: { id: true } });
    if (!proyecto) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const tramite = await db.tramiteLegal.create({
      data: {
        proyectoId: id,
        nombre: nombre.trim(),
        organismo: organismo?.trim() || null,
        estado: estado ?? "Pendiente",
        fecha: fecha ? new Date(fecha) : null,
        observaciones: observaciones?.trim() || null,
      },
    });

    return NextResponse.json(tramite, { status: 201 });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/tramites]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
