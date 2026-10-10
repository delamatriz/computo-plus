import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { esSuperadmin, requerirSesion } from "@/lib/sesion";

// Único campo editable hoy: resuelta (el checkbox de la lista). El
// mensaje en sí no tiene edición — es un buzón, no un documento.
// Sugerencia de otra empresa → 404 (salvo SUPERADMIN), igual que el resto
// de las rutas multi-tenant.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sesion = await requerirSesion();
    if (sesion instanceof NextResponse) return sesion;
    const { id } = await params;
    const body = await req.json();
    if (typeof body.resuelta !== "boolean") {
      return NextResponse.json({ error: "resuelta debe ser boolean" }, { status: 400 });
    }
    const superadmin = await esSuperadmin(sesion);
    const where = superadmin ? { id } : { id, empresaId: sesion.empresaId };
    const existente = await db.sugerencia.findFirst({ where, select: { id: true } });
    if (!existente) {
      return NextResponse.json({ error: "Sugerencia no encontrada" }, { status: 404 });
    }
    const sugerencia = await db.sugerencia.update({ where: { id }, data: { resuelta: body.resuelta } });
    return NextResponse.json(sugerencia);
  } catch (err) {
    console.error("[PATCH /api/sugerencias/[id]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
