import { NextResponse } from "next/server";
import { requerirSuperadmin } from "@/lib/sesion";
import { detalleConsumoEmpresa } from "@/lib/consumoIA";

// Panel /admin → Consumo IA, detalle de una empresa: desglose por función del
// mes en curso y los últimos 6 meses. Solo SUPERADMIN.
export async function GET(_req: Request, { params }: { params: Promise<{ empresaId: string }> }) {
  const acceso = await requerirSuperadmin();
  if (acceso instanceof NextResponse) return acceso;
  try {
    const { empresaId } = await params;
    const detalle = await detalleConsumoEmpresa(empresaId);
    if (!detalle) return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });
    return NextResponse.json(detalle);
  } catch (err) {
    console.error("[GET /api/admin/consumo-ia/[empresaId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
