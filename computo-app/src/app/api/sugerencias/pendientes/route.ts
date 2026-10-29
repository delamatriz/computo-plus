import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requerirSuperadmin } from "@/lib/sesion";

// Cantidad de preguntas y sugerencias sin resolver, de todas las empresas —
// el badge rojo del ítem del Sidebar. Solo SUPERADMIN (otro rol → 403).
export async function GET() {
  const sesion = await requerirSuperadmin();
  if (sesion instanceof NextResponse) return sesion;
  try {
    const pendientes = await db.sugerencia.count({ where: { resuelta: false } });
    return NextResponse.json({ pendientes });
  } catch (err) {
    console.error("[GET /api/sugerencias/pendientes]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
