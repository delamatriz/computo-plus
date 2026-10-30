import { NextRequest, NextResponse } from "next/server";
import { sugerirApuRubro } from "@/lib/sugerirApuRubro";
import { requerirSesion } from "@/lib/sesion";
import { bloquearSiEsPrueba, respuestaFuncionNoDisponible } from "@/lib/acceso";

// "Sugerir APU" en los formularios de alta de rubros (/rubros y Mis rubros):
// devuelve las líneas del APU para llenar el editor, sin guardar nada (ver
// lib/sugerirApuRubro.ts). Cualquier usuario logueado; no disponible en la
// prueba gratis (no descuenta cupo: directamente no se ofrece), igual que
// sugerir-capitulos.
export async function POST(req: NextRequest) {
  const sesion = await requerirSesion();
  if (sesion instanceof NextResponse) return sesion;
  const bloqueo = await bloquearSiEsPrueba(sesion);
  if (bloqueo) return bloqueo;

  try {
    const body = await req.json().catch(() => null);
    const campo = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    const nombre = campo(body?.nombre);
    if (!nombre) return NextResponse.json({ error: "Falta el nombre del rubro." }, { status: 400 });

    const apu = await sugerirApuRubro(sesion.empresaId, {
      nombre,
      descripcion: campo(body?.descripcion),
      unidad: campo(body?.unidad),
    });
    if (apu.materiales.length + apu.manoObra.length + apu.equipos.length === 0) {
      return NextResponse.json({ error: "La IA no devolvió un APU usable. Probá con una descripción más concreta." }, { status: 502 });
    }
    return NextResponse.json(apu);
  } catch (err) {
    console.error("[POST /api/sugerir-apu-rubro]", err);
    const noDisponible = respuestaFuncionNoDisponible(err, sesion.email);
    if (noDisponible) return noDisponible;
    return NextResponse.json({ error: "No se pudo sugerir el APU. Probá de nuevo." }, { status: 500 });
  }
}
