import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requerirSuperadmin } from "@/lib/sesion";

// Borrar una carga hecha por error — no hay edición inline de mes/variante
// a propósito (cambiar esos dos campos es indistinguible de cargar una
// fila nueva); para corregir el valor, POST /indice-iccv con el mismo
// mes/variante ya actualiza in-place (ver upsert ahí).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requerirSuperadmin();
  if (authCheck instanceof NextResponse) return authCheck;

  try {
    const { id } = await params;
    await db.indiceICCVMensual.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/configuracion/indice-iccv/[id]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
