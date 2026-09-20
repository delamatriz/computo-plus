import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// PATCH — edita una persona, incluido activo/inactivo. Sin DELETE a
// propósito, mismo criterio que Bitácora: el personal no se borra, se
// marca inactivo.
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; personaId: string }> }
) {
  try {
    const { personaId } = await context.params;
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

    const existente = await db.personalObra.findUnique({ where: { id: personaId } });
    if (!existente) {
      return NextResponse.json({ error: "Persona no encontrada" }, { status: 404 });
    }

    const categoria = await db.categoriaLaboral.findUnique({ where: { id: categoriaLaboralId } });
    if (!categoria) {
      return NextResponse.json({ error: "Categoría laboral no encontrada" }, { status: 400 });
    }

    const persona = await db.personalObra.update({
      where: { id: personaId },
      data: {
        nombre: nombre.trim(),
        categoriaLaboralId,
        cuadrilla: cuadrilla?.trim() || "",
        empresaSubcontratista: empresaSubcontratista?.trim() || null,
        telefono: telefono?.trim() || null,
        activo: activo ?? existente.activo,
      },
      include: { categoriaLaboral: true },
    });

    return NextResponse.json(persona);
  } catch (err) {
    console.error("[PATCH /api/proyectos/[id]/personal/[personaId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
