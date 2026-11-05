// Tope diario de llamadas a las funciones asistidas que no tienen cupo
// propio (auditoría de seguridad nov-2026, hallazgo #10): en la prueba
// gratis ya están bloqueadas, pero una empresa paga podía llamarlas en bucle
// y generar costo de IA sin límite. Ahora: 50 llamadas por día, por empresa
// y POR RUTA (no 50 en total). El día es el de UTC: el contador vuelve a 0 a
// medianoche UTC.
//
// En memoria, igual que el límite de login (lib/limiteLogin.ts): alcanza con
// una sola instancia (Render con un único proceso). Se pierde al reiniciar y
// no se comparte entre instancias.
// TODO: pasar a Redis (o una tabla) si la app corre en más de una instancia.

import { NextResponse } from "next/server";
import { whatsappContacto } from "@/lib/config-prueba";

export const MAX_LLAMADAS_IA_POR_DIA = 50;
export const MENSAJE_LIMITE_DIARIO_IA = "Límite diario de sugerencias alcanzado. Volvé mañana.";

export type RutaConTopeDiario =
  | "materiales/estimar-precio"
  | "metrajes/analizar-imagen"
  | "metrajes/sugerir"
  | "sugerir-capitulos"
  | "sugerir-apu-rubro";

// "AAAA-MM-DD|ruta|empresa" → llamadas de ese día.
const llamadas = new Map<string, number>();
let diaActual = "";

const diaUTC = (ahora: Date) => ahora.toISOString().slice(0, 10);

/**
 * Cuenta una llamada de esa empresa a esa ruta. Si ya llegó al tope del día,
 * devuelve la respuesta 429 lista para retornar (y no la cuenta); si no, null.
 * El cuerpo usa el formato de los avisos de acceso ("FUNCION_NO_DISPONIBLE",
 * ver lib/accesoCliente.ts): las pantallas ya lo muestran con <AvisoAcceso />.
 */
export function consumirLimiteDiarioIA(
  ruta: RutaConTopeDiario,
  sesion: { empresaId: string; email: string },
  ahora = new Date()
): NextResponse | null {
  const { empresaId } = sesion;
  const dia = diaUTC(ahora);
  // Cambió el día: se descartan los contadores viejos de una.
  if (dia !== diaActual) {
    llamadas.clear();
    diaActual = dia;
  }
  const clave = `${dia}|${ruta}|${empresaId}`;
  const usadas = llamadas.get(clave) ?? 0;
  if (usadas >= MAX_LLAMADAS_IA_POR_DIA) {
    return NextResponse.json(
      { error: "FUNCION_NO_DISPONIBLE", mensaje: MENSAJE_LIMITE_DIARIO_IA, contacto: whatsappContacto(sesion.email) },
      { status: 429 }
    );
  }
  llamadas.set(clave, usadas + 1);
  return null;
}
