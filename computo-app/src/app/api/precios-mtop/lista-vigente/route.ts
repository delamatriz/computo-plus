import { NextResponse } from "next/server";
import { requerirSesion } from "@/lib/sesion";
import { listaMTOPVigente } from "@/lib/listaMTOPVigente";

// Número y mes de la lista oficial MTOP más reciente del catálogo global, para los textos de
// /materiales. { lista: null } si todavía no hay ninguna lista con número.
export async function GET() {
  const sesion = await requerirSesion();
  if (sesion instanceof NextResponse) return sesion;
  try {
    return NextResponse.json({ lista: await listaMTOPVigente() });
  } catch (err) {
    console.error("[GET /api/precios-mtop/lista-vigente]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
