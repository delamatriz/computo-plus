import { NextRequest, NextResponse } from "next/server";
import { crearRubroEmpresa } from "@/lib/crearRubroEmpresa";
import { requerirSesion } from "@/lib/sesion";

// Alta de un rubro desde cero en Mis rubros (/mi-biblioteca) — cualquier
// usuario logueado; la empresa sale de la sesión. La lógica (validación,
// precios, totales del APU) vive en lib/crearRubroEmpresa.ts.
export async function POST(req: NextRequest) {
  const sesion = await requerirSesion();
  if (sesion instanceof NextResponse) return sesion;

  try {
    const datos = await req.json().catch(() => null);
    const { status, body } = await crearRubroEmpresa(sesion.empresaId, datos);
    return NextResponse.json(body, { status });
  } catch (err) {
    console.error("[POST /api/mi-biblioteca/crear]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
