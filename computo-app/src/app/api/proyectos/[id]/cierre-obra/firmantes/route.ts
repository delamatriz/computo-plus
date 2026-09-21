import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const ROLES_VALIDOS = ["Director de obra", "Comitente", "Contratista", "Otro"];

// POST — agrega un firmante al acta de cierre.
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
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

    const acta = await db.actaCierre.findUnique({ where: { proyectoId: id } });
    if (!acta) {
      return NextResponse.json({ error: "Este proyecto todavía no tiene acta de cierre" }, { status: 404 });
    }

    const nuevo = await db.firmante.create({
      data: {
        actaCierreId: acta.id,
        nombre: nombre.trim(),
        rol,
        firmado: firmado ?? false,
      },
    });

    return NextResponse.json(nuevo, { status: 201 });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/cierre-obra/firmantes]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
