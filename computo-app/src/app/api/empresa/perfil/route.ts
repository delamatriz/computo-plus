import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requerirSesion } from "@/lib/sesion";

// La empresa es la del usuario logueado (tenant). Siempre existe: el
// usuario no puede crearse sin empresa (User.empresaId es obligatorio).
export async function GET() {
  const sesion = await requerirSesion();
  if (sesion instanceof NextResponse) return sesion;
  try {
    const empresa = await db.empresa.findUnique({ where: { id: sesion.empresaId } });
    if (!empresa) return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });
    return NextResponse.json(empresa);
  } catch (err) {
    console.error("[GET /api/empresa/perfil]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const sesion = await requerirSesion();
  if (sesion instanceof NextResponse) return sesion;
  try {
    const body = await request.json();

    const data: {
      nombre?: string;
      rut?: string;
      direccion?: string | null;
      telefono?: string | null;
      email?: string | null;
      web?: string | null;
      logo?: string | null;
    } = {};

    if (body.nombre !== undefined && String(body.nombre).trim()) {
      data.nombre = String(body.nombre).trim();
    }
    if (body.rut !== undefined && String(body.rut).trim()) {
      data.rut = String(body.rut).trim();
    }
    if (body.direccion !== undefined) data.direccion = body.direccion || null;
    if (body.telefono !== undefined) data.telefono = body.telefono || null;
    if (body.email !== undefined) data.email = body.email || null;
    if (body.web !== undefined) data.web = body.web || null;
    if (body.logo !== undefined) data.logo = body.logo || null;

    const actualizada = await db.empresa.update({
      where: { id: sesion.empresaId },
      data,
    });
    return NextResponse.json(actualizada);
  } catch (err) {
    console.error("[PATCH /api/empresa/perfil]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
