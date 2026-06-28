import { NextResponse } from "next/server";
import { db } from "@/lib/db";

async function getOrCreateEmpresa() {
  const existente = await db.empresa.findFirst();
  if (existente) return existente;
  return db.empresa.create({ data: { nombre: "Mi Empresa", rut: "000000000000" } });
}

export async function GET() {
  try {
    const empresa = await getOrCreateEmpresa();
    return NextResponse.json(empresa);
  } catch (err) {
    console.error("[GET /api/empresa/perfil]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const empresa = await getOrCreateEmpresa();

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
      where: { id: empresa.id },
      data,
    });
    return NextResponse.json(actualizada);
  } catch (err) {
    console.error("[PATCH /api/empresa/perfil]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
