// Criterio ÚNICO de los materiales pendientes del catálogo (PrecioMTOP), el
// que usan la campanita (conteo), la cola de revisión del administrador y los
// filtros de /materiales. Así el número que ve el usuario en la campanita es
// el mismo que cantidad de filas que ve al llegar a /materiales.
//
//   - "A cotizar" / "sin precio de referencia": motivoVerificacion ===
//     "sin_precio_referencia" (nunca tuvo precio).
//   - "Requieren verificación": marcados explícitamente con
//     requiereVerificacion = true, SIN contar los de arriba (un material sin
//     precio de referencia va a "a cotizar" aunque también esté marcado, para
//     no duplicarlo entre las dos categorías). No es "nunca verificado": eso
//     es el filtro "Pendiente de verificar", mucho más amplio.
//
// WHERE_* (para Prisma, en el servidor) y la función (en el cliente) son el
// mismo criterio escrito dos veces: si se toca uno, se toca el otro.

import type { Prisma } from "@/generated/prisma/client";

export const MOTIVO_SIN_PRECIO_REFERENCIA = "sin_precio_referencia";

/** Materiales marcados requiereVerificacion, sin los "sin precio de referencia". Un motivo vacío cuenta. */
export const WHERE_REQUIEREN_VERIFICACION = {
  requiereVerificacion: true,
  OR: [{ motivoVerificacion: null }, { motivoVerificacion: { not: MOTIVO_SIN_PRECIO_REFERENCIA } }],
} satisfies Prisma.PrecioMTOPWhereInput;

export const WHERE_A_COTIZAR = {
  motivoVerificacion: MOTIVO_SIN_PRECIO_REFERENCIA,
} satisfies Prisma.PrecioMTOPWhereInput;

/** Mismo criterio que WHERE_REQUIEREN_VERIFICACION, sobre un material ya cargado en el cliente. */
export function requiereVerificacionExplicita(m: { requiereVerificacion: boolean; motivoVerificacion: string | null }): boolean {
  return m.requiereVerificacion && m.motivoVerificacion !== MOTIVO_SIN_PRECIO_REFERENCIA;
}
