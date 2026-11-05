// Límite de intentos de login (auditoría de seguridad nov-2026, hallazgo #2):
// antes se podían probar contraseñas sin freno. Cuenta los intentos FALLIDOS
// en una ventana de 15 minutos:
// - por email: 5 → frena probar contraseñas contra una cuenta;
// - por IP: 20 → frena probar muchas cuentas desde el mismo lugar.
// Un email inexistente cuenta igual que uno real, para no revelar cuáles
// están registrados. Un login correcto limpia el contador de ese email.
//
// En memoria, igual que el límite del registro (lib/registro.ts): alcanza con
// una sola instancia (Render con un único proceso). Se pierde al reiniciar y
// no se comparte entre instancias.
// TODO: pasar a Redis (o una tabla) si la app corre en más de una instancia.

export const VENTANA_LOGIN_MIN = 15;
const VENTANA_MS = VENTANA_LOGIN_MIN * 60_000;
const MAX_FALLIDOS_POR_EMAIL = 5;
const MAX_FALLIDOS_POR_IP = 20;

const fallidos = new Map<string, number[]>();

function recientes(clave: string, ahora: number): number[] {
  const lista = (fallidos.get(clave) ?? []).filter((t) => ahora - t < VENTANA_MS);
  if (lista.length > 0) fallidos.set(clave, lista);
  else fallidos.delete(clave);
  return lista;
}

/** true si ese email o esa IP ya agotaron los intentos de la ventana. */
export function loginBloqueado(email: string, ip: string, ahora = Date.now()): boolean {
  return (
    recientes(`email:${email}`, ahora).length >= MAX_FALLIDOS_POR_EMAIL ||
    recientes(`ip:${ip}`, ahora).length >= MAX_FALLIDOS_POR_IP
  );
}

export function registrarLoginFallido(email: string, ip: string, ahora = Date.now()): void {
  for (const clave of [`email:${email}`, `ip:${ip}`]) {
    fallidos.set(clave, [...recientes(clave, ahora), ahora]);
  }
  // Limpieza ocasional para que el Map no crezca sin límite.
  if (fallidos.size > 5000) {
    for (const [k, v] of fallidos) if (v.every((t) => ahora - t >= VENTANA_MS)) fallidos.delete(k);
  }
}

export function registrarLoginCorrecto(email: string): void {
  fallidos.delete(`email:${email}`);
}

/**
 * IP del cliente a partir de los headers que NextAuth le pasa a authorize().
 * Mismo orden que ipDelPedido (lib/registro.ts): primero los del proxy de
 * borde, que el cliente no puede falsear.
 */
export function ipDeHeaders(headers: Record<string, string | string[] | undefined> | undefined): string {
  const leer = (nombre: string) => {
    const v = headers?.[nombre];
    return (Array.isArray(v) ? v[0] : v)?.trim();
  };
  return (
    leer("true-client-ip") ||
    leer("cf-connecting-ip") ||
    leer("x-forwarded-for")?.split(",")[0]?.trim() ||
    leer("x-real-ip") ||
    "desconocida"
  );
}
