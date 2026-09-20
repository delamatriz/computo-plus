import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET — lista el personal del proyecto, con la categoría laboral
// vinculada (nombre + jornal, para mostrar en la pantalla). Trae
// activos e inactivos: el filtro "solo activas" es de la UI, no del
// backend.
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const personal = await db.personalObra.findMany({
      where: { proyectoId: id },
      include: { categoriaLaboral: true },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(personal);
  } catch (err) {
    console.error("[GET /api/proyectos/[id]/personal]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST — crea una persona. Sin numero correlativo (no es un registro
// fechado como Bitácora/Certificación, es un roster).
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const {
      nombre,
      categoriaLaboralId,
      cuadrilla,
      empresaSubcontratista,
      telefono,
      activo,
    } = body as {
      nombre?: string;
      categoriaLaboralId?: string;
      cuadrilla?: string;
      empresaSubcontratista?: string;
      telefono?: string;
      activo?: boolean;
    };

    if (!nombre?.trim()) {
      return NextResponse.json({ error: "Falta nombre" }, { status: 400 });
    }
    if (!categoriaLaboralId?.trim()) {
      return NextResponse.json({ error: "Falta categoriaLaboralId" }, { status: 400 });
    }

    const proyecto = await db.proyecto.findUnique({ where: { id }, select: { id: true } });
    if (!proyecto) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const categoria = await db.categoriaLaboral.findUnique({ where: { id: categoriaLaboralId } });
    if (!categoria) {
      return NextResponse.json({ error: "Categoría laboral no encontrada" }, { status: 400 });
    }

    const persona = await db.personalObra.create({
      data: {
        proyectoId: id,
        nombre: nombre.trim(),
        categoriaLaboralId,
        cuadrilla: cuadrilla?.trim() || "",
        empresaSubcontratista: empresaSubcontratista?.trim() || null,
        telefono: telefono?.trim() || null,
        activo: activo ?? true,
      },
      include: { categoriaLaboral: true },
    });

    return NextResponse.json(persona, { status: 201 });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/personal]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
