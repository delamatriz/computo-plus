import { NextResponse } from "next/server";
import { requerirSesion } from "@/lib/sesion";
import { tipoCambioVigente } from "@/lib/tipoCambio";

// GET — tipo de cambio dólar/peso vigente (último guardado del BCU, o el de
// referencia si no hay ninguno). Lo usa Cálculo Rápido.
export async function GET() {
  const sesion = await requerirSesion();
  if (sesion instanceof NextResponse) return sesion;
  try {
    return NextResponse.json(await tipoCambioVigente());
  } catch (err) {
    console.error("[GET /api/tipo-cambio]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
