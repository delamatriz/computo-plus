import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requerirAdminOSuperadmin } from "@/lib/sesion";
import { listarImportaciones } from "@/lib/importacionesPrecios";

// Listas importadas (/materiales). El Administrador ve las del catálogo
// global (empresaId null); un usuario con rol Empresa, solo las de su empresa.
export async function GET() {
  const sesion = await requerirAdminOSuperadmin(
    "Solo un usuario con rol Empresa o el Administrador de CÓMPUTO+ puede ver las listas importadas."
  );
  if (sesion instanceof NextResponse) return sesion;
  try {
    const empresaId = sesion.rol === "SUPERADMIN" ? null : sesion.empresaId;
    return NextResponse.json(await listarImportaciones(db, empresaId));
  } catch (err) {
    console.error("[GET /api/importaciones-precios]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
