import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requerirSuperadmin } from "@/lib/sesion";
import { esPlan } from "@/lib/roles";

// Panel /admin — empresas (tenants). Solo SUPERADMIN (otro rol → 403).

const SLUG_VALIDO = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function GET() {
  const acceso = await requerirSuperadmin();
  if (acceso instanceof NextResponse) return acceso;
  try {
    const empresas = await db.empresa.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        nombre: true,
        slug: true,
        plan: true,
        rut: true,
        createdAt: true,
        _count: { select: { users: true, proyectos: true } },
      },
    });
    return NextResponse.json({ empresas });
  } catch (err) {
    console.error("[GET /api/admin/empresas]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const acceso = await requerirSuperadmin();
  if (acceso instanceof NextResponse) return acceso;
  try {
    const body = await req.json().catch(() => ({}));
    const nombre = typeof body?.nombre === "string" ? body.nombre.trim() : "";
    const slug = typeof body?.slug === "string" ? body.slug.trim().toLowerCase() : "";
    const plan = body?.plan;
    const rut = typeof body?.rut === "string" ? body.rut.trim() : "";

    if (!nombre) return NextResponse.json({ error: "Falta el nombre" }, { status: 400 });
    if (!SLUG_VALIDO.test(slug)) {
      return NextResponse.json({ error: "El slug solo admite minúsculas, números y guiones (ej. constructora-sur)" }, { status: 400 });
    }
    if (!esPlan(plan)) return NextResponse.json({ error: "Plan inválido" }, { status: 400 });

    if (await db.empresa.findUnique({ where: { slug }, select: { id: true } })) {
      return NextResponse.json({ error: `Ya existe una empresa con el slug "${slug}"` }, { status: 409 });
    }
    // Empresa.rut es obligatorio y único en el schema; si no se carga en el
    // alta, queda un valor provisorio único hasta que la empresa lo complete
    // desde su perfil.
    const rutFinal = rut || `PENDIENTE-${slug}`;
    if (await db.empresa.findUnique({ where: { rut: rutFinal }, select: { id: true } })) {
      return NextResponse.json({ error: `Ya existe una empresa con el RUT ${rutFinal}` }, { status: 409 });
    }

    const empresa = await db.empresa.create({
      data: { nombre, slug, plan, rut: rutFinal },
      select: { id: true, nombre: true, slug: true, plan: true, rut: true, createdAt: true, _count: { select: { users: true, proyectos: true } } },
    });
    return NextResponse.json({ empresa }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/admin/empresas]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
