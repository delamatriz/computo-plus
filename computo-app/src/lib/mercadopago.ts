// Cliente del SDK de MercadoPago (solo servidor). Las credenciales vienen de MP_ACCESS_TOKEN;
// con un token de prueba (TEST-…) todo corre en el sandbox. Ver lib/config-mercadopago.ts.

import { MercadoPagoConfig } from "mercadopago";

/** null si falta MP_ACCESS_TOKEN (quien lo llama responde "pagos no configurados"). */
export function clienteMercadoPago(): MercadoPagoConfig | null {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) return null;
  return new MercadoPagoConfig({ accessToken, options: { timeout: 15_000 } });
}

/**
 * Resumen de un error de la API de MercadoPago para guardarlo como evento en /admin: tipo, status,
 * mensaje, código y causas (sale del cuerpo de la RESPUESTA de MercadoPago; el SDK nunca guarda el
 * token en el error). Por las dudas se enmascaran los mails y se recorta el largo.
 */
export function resumenErrorMercadoPago(err: unknown): { status: number | null; texto: string } {
  const e = (err ?? {}) as { name?: unknown; status?: unknown; message?: unknown; error?: unknown; causes?: unknown; cause?: unknown };
  const status = typeof e.status === "number" ? e.status : null;
  const causas = Array.isArray(e.causes) && e.causes.length > 0 ? e.causes : Array.isArray(e.cause) ? e.cause : [];
  const partes = [
    typeof e.name === "string" ? e.name : "Error",
    status != null ? `status ${status}` : null,
    typeof e.message === "string" && e.message ? `mensaje: ${e.message}` : null,
    typeof e.error === "string" && e.error ? `código: ${e.error}` : null,
    causas.length > 0 ? `causas: ${JSON.stringify(causas)}` : null,
  ].filter(Boolean);
  const texto = partes
    .join(" · ")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[mail]")
    .slice(0, 1500);
  return { status, texto };
}
