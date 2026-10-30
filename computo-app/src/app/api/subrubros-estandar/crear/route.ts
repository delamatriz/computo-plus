import { NextRequest, NextResponse } from "next/server";
import { crearRubroCatalogo } from "@/lib/crearRubroCatalogo";
import { requerirSuperadmin } from "@/lib/sesion";

// Alta de un rubro en el catálogo global desde /rubros — solo SUPERADMIN.
// La lógica (validación, capítulo nuevo, código, precio) vive en
// lib/crearRubroCatalogo.ts.
export async function POST(req: NextRequest) {
  const sesion = await requerirSuperadmin();
  if (sesion instanceof NextResponse) return sesion;

  try {
    const datos = await req.json().catch(() => null);
    const { status, body } = await crearRubroCatalogo(datos);
    return NextResponse.json(body, { status });
  } catch (err) {
    console.error("[POST /api/subrubros-estandar/crear]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
