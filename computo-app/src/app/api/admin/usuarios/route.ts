import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requerirSuperadmin } from "@/lib/sesion";
import { ROLES_ASIGNABLES } from "@/lib/roles";

// Panel /admin — usuarios de una empresa. Solo SUPERADMIN (otro rol → 403).
// Nunca devuelve passwordHash.

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LARGO_MINIMO_PASSWORD = 8;

const SELECT_USUARIO = {
  id: true,
  nombre: true,
  email: true,
  rol: true,
  creadoEn: true,
  empresa: { select: { id: true, nombre: true } },
} as const;

export async function GET() {
  const acceso = await requerirSuperadmin();
  if (acceso instanceof NextResponse) return acceso;
  try {
    const usuarios = await db.user.findMany({ orderBy: { creadoEn: "asc" }, select: SELECT_USUARIO });
    return NextResponse.json({ usuarios });
  } catch (err) {
    console.error("[GET /api/admin/usuarios]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const acceso = await requerirSuperadmin();
  if (acceso instanceof NextResponse) return acceso;
  try {
    const body = await req.json().catch(() => ({}));
    const nombre = typeof body?.nombre === "string" ? body.nombre.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const rol = body?.rol;
    const empresaId = typeof body?.empresaId === "string" ? body.empresaId : "";

    if (!nombre) return NextResponse.json({ error: "Falta el nombre" }, { status: 400 });
    if (!EMAIL_VALIDO.test(email)) return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    if (password.length < LARGO_MINIMO_PASSWORD) {
      return NextResponse.json({ error: `La contraseña tiene que tener al menos ${LARGO_MINIMO_PASSWORD} caracteres` }, { status: 400 });
    }
    if (!(ROLES_ASIGNABLES as readonly string[]).includes(rol)) {
      return NextResponse.json({ error: "Rol inválido (ADMIN o USUARIO)" }, { status: 400 });
    }
    if (!(await db.empresa.findUnique({ where: { id: empresaId }, select: { id: true } }))) {
      return NextResponse.json({ error: "La empresa no existe" }, { status: 400 });
    }
    if (await db.user.findUnique({ where: { email }, select: { id: true } })) {
      return NextResponse.json({ error: `Ya existe un usuario con el email ${email}` }, { status: 409 });
    }

    const usuario = await db.user.create({
      data: { nombre, email, rol, empresaId, passwordHash: await bcrypt.hash(password, 12) },
      select: SELECT_USUARIO,
    });
    return NextResponse.json({ usuario }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/admin/usuarios]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
