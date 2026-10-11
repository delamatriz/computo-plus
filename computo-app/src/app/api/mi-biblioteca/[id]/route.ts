import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requerirSesion } from "@/lib/sesion";

// Elimina un rubro de la biblioteca personal (el cascade borra su APU y
// líneas). De otra empresa → 404, mismo criterio que lib/sesion.ts.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sesion = await requerirSesion();
  if (sesion instanceof NextResponse) return sesion;

  try {
    const { id } = await params;
    const subrubro = await db.subrubroEmpresa.findUnique({ where: { id }, select: { empresaId: true } });
    if (!subrubro || subrubro.empresaId !== sesion.empresaId) {
      return NextResponse.json({ error: "Rubro no encontrado" }, { status: 404 });
    }
    await db.subrubroEmpresa.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/mi-biblioteca/[id]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
