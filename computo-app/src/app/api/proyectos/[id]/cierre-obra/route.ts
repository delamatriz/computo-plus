import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const INCLUDE_COMPLETO = {
  observaciones: {
    include: { rubro: { select: { id: true, codigo: true, descripcion: true, capitulo: { select: { nombre: true } } } } },
    orderBy: { createdAt: "asc" as const },
  },
  firmantes: { orderBy: { createdAt: "asc" as const } },
  documentos: { orderBy: { createdAt: "asc" as const } },
};

// GET — obtiene el acta de cierre del proyecto (o null si todavía no
// se creó), con observaciones, firmantes y documentos.
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const acta = await db.actaCierre.findUnique({
      where: { proyectoId: id },
      include: INCLUDE_COMPLETO,
    });
    return NextResponse.json(acta);
  } catch (err) {
    console.error("[GET /api/proyectos/[id]/cierre-obra]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST — crea el acta de cierre del proyecto (primera vez). 409 si ya
// existe (usar PATCH para editar una existente).
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const { fechaCierre, observacionesGenerales } = body as {
      fechaCierre?: string;
      observacionesGenerales?: string;
    };

    const proyecto = await db.proyecto.findUnique({ where: { id }, select: { id: true } });
    if (!proyecto) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const existente = await db.actaCierre.findUnique({ where: { proyectoId: id } });
    if (existente) {
      return NextResponse.json({ error: "Este proyecto ya tiene un acta de cierre" }, { status: 409 });
    }

    const acta = await db.actaCierre.create({
      data: {
        proyectoId: id,
        fechaCierre: fechaCierre ? new Date(fechaCierre) : null,
        observacionesGenerales: observacionesGenerales?.trim() || null,
      },
      include: INCLUDE_COMPLETO,
    });

    return NextResponse.json(acta, { status: 201 });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/cierre-obra]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// PATCH — edita los campos generales del acta ya existente.
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const { fechaCierre, observacionesGenerales } = body as {
      fechaCierre?: string;
      observacionesGenerales?: string;
    };

    const existente = await db.actaCierre.findUnique({ where: { proyectoId: id } });
    if (!existente) {
      return NextResponse.json({ error: "Este proyecto todavía no tiene acta de cierre" }, { status: 404 });
    }

    const acta = await db.actaCierre.update({
      where: { proyectoId: id },
      data: {
        fechaCierre: fechaCierre ? new Date(fechaCierre) : null,
        observacionesGenerales: observacionesGenerales?.trim() || null,
      },
      include: INCLUDE_COMPLETO,
    });

    return NextResponse.json(acta);
  } catch (err) {
    console.error("[PATCH /api/proyectos/[id]/cierre-obra]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
