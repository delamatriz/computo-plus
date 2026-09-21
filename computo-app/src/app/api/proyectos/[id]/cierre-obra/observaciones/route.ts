import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const ESTADOS_VALIDOS = ["Aprobado sin observaciones", "Con observaciones pendientes"];

// POST — agrega una observación de cierre vinculada a un rubro.
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
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

    const acta = await db.actaCierre.findUnique({ where: { proyectoId: id } });
    if (!acta) {
      return NextResponse.json({ error: "Este proyecto todavía no tiene acta de cierre" }, { status: 404 });
    }

    const nueva = await db.observacionCierreRubro.create({
      data: {
        actaCierreId: acta.id,
        rubroId,
        observacion: observacion.trim(),
        estado: estado ?? "Aprobado sin observaciones",
      },
      include: { rubro: { select: { id: true, codigo: true, descripcion: true, capitulo: { select: { nombre: true } } } } },
    });

    return NextResponse.json(nueva, { status: 201 });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/cierre-obra/observaciones]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
