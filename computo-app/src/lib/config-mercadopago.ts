// Configuración de MercadoPago Uruguay para las suscripciones recurrentes (oct-2026).
// Los planes y precios viven acá y en ningún otro archivo; las credenciales, solo en variables
// de entorno (nunca en el código ni en el repo).

// montoUSD es solo el precio que se muestra en /planes; MercadoPago cobra montoUYU (referencia
// aproximada: si cambia el tipo de cambio hay que actualizar montoUYU, que es lo que se cobra).
export const MP_PLANES = {
  basico: { nombre: "Básico", montoUYU: 1100, montoUSD: 25 },
  premium: { nombre: "Premium", montoUYU: 1500, montoUSD: 35 },
} as const;

export type PlanMP = keyof typeof MP_PLANES;

export const PLANES_MP = Object.keys(MP_PLANES) as PlanMP[];

export function esPlanMP(valor: unknown): valor is PlanMP {
  return typeof valor === "string" && (PLANES_MP as string[]).includes(valor);
}

/** Moneda de las suscripciones (MercadoPago Uruguay). */
export const MP_MONEDA = "UYU";

/**
 * Variables de entorno necesarias (cargarlas en .env.local y en Render):
 *   MP_ACCESS_TOKEN    token privado de la aplicación: crea y consulta suscripciones y pagos
 *   MP_PUBLIC_KEY      clave pública (solo se usa en el navegador, si hace falta)
 *   MP_CLIENT_ID       ID de la aplicación de MercadoPago
 *   MP_CLIENT_SECRET   secreto de la aplicación (OAuth)
 *   MP_WEBHOOK_SECRET  firma secreta para verificar que los webhooks vienen de MercadoPago
 * Con credenciales de prueba (TEST-…) todo corre en el sandbox y no se cobra de verdad.
 */
export const MP_VARIABLES_ENTORNO = ["MP_ACCESS_TOKEN", "MP_PUBLIC_KEY", "MP_CLIENT_ID", "MP_CLIENT_SECRET", "MP_WEBHOOK_SECRET"] as const;

/** Variables de MercadoPago que faltan (vacío = todo configurado). */
export function variablesMPFaltantes(): string[] {
  return MP_VARIABLES_ENTORNO.filter((v) => !process.env[v]);
}

/**
 * Dominio público al que MercadoPago devuelve al usuario después de pagar (back_url). Se puede
 * pisar con MP_URL_BASE (opcional) para probar en otro dominio; sin ella es el de producción.
 */
export const MP_URL_BASE_DEFAULT = "https://computo.delamatriz.com";

export function mpUrlBase(): string {
  return (process.env.MP_URL_BASE || MP_URL_BASE_DEFAULT).replace(/\/+$/, "");
}
