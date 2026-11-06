import { NextResponse } from "next/server";
import { requerirSuperadmin } from "@/lib/sesion";
import { resumenConsumoIA } from "@/lib/consumoIA";

// Panel /admin → Consumo IA: una fila por empresa (ACTIVA y PRUEBA) con el
// gasto del mes en curso, el del mes anterior y su estado contra el umbral del
// plan. Solo SUPERADMIN. Ver lib/consumoIA.ts.
export async function GET() {
  const acceso = await requerirSuperadmin();
  if (acceso instanceof NextResponse) return acceso;
  try {
    return NextResponse.json(await resumenConsumoIA());
  } catch (err) {
    console.error("[GET /api/admin/consumo-ia]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
