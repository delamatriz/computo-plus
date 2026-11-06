// Verificación de la firma de los webhooks de MercadoPago (header x-signature).
//
// MercadoPago manda `x-signature: ts=<epoch>,v1=<hmac>` y `x-request-id`. El hmac es SHA-256, con
// el secreto de webhooks (MP_WEBHOOK_SECRET) como clave, de este texto (sin los campos que no
// vengan):  id:<data.id en minúscula>;request-id:<x-request-id>;ts:<ts>;
// donde data.id sale del query string del pedido (?data.id=…).

import { createHmac, timingSafeEqual } from "crypto";

// Antigüedad máxima del ts de la firma (auditoría de seguridad nov-2026,
// hallazgo #11): sin esto, una notificación firmada se podía reenviar para
// siempre. La documentación de MercadoPago no da una tolerancia, y si el
// servidor no responde reintenta cada 15 minutos y después con plazos más
// largos, sin decir si el reintento trae un ts nuevo. Por eso la ventana es
// amplia: corta reenvíos viejos sin rechazar reintentos legítimos de una
// caída de unas horas. (El riesgo de fondo era bajo: el webhook vuelve a
// consultar el estado real en MercadoPago.)
const ANTIGUEDAD_MAXIMA_MS = 72 * 60 * 60 * 1000;
// Margen para relojes un poco adelantados.
const ADELANTO_MAXIMO_MS = 5 * 60 * 1000;

/** ts de MercadoPago a milisegundos: viene en segundos (10 dígitos); se acepta también en ms. */
function tsEnMs(ts: string): number | null {
  if (!/^\d{9,14}$/.test(ts)) return null;
  const n = Number(ts);
  return n < 1e12 ? n * 1000 : n;
}

export function firmaMercadoPagoValida(datos: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
  secreto: string;
  ahora?: number;
}): boolean {
  if (!datos.xSignature) return false;
  const partes = new Map<string, string>();
  for (const p of datos.xSignature.split(",")) {
    const i = p.indexOf("=");
    if (i > 0) partes.set(p.slice(0, i).trim(), p.slice(i + 1).trim());
  }
  const ts = partes.get("ts");
  const v1 = partes.get("v1");
  if (!ts || !v1) return false;

  let manifiesto = "";
  if (datos.dataId) manifiesto += `id:${datos.dataId.toLowerCase()};`;
  if (datos.xRequestId) manifiesto += `request-id:${datos.xRequestId};`;
  manifiesto += `ts:${ts};`;

  const esperado = createHmac("sha256", datos.secreto).update(manifiesto).digest("hex");
  const a = Buffer.from(esperado);
  const b = Buffer.from(v1);
  if (!(a.length === b.length && timingSafeEqual(a, b))) return false;

  // Firma correcta, pero además el ts tiene que ser reciente.
  const ms = tsEnMs(ts);
  if (ms === null) return false;
  const ahora = datos.ahora ?? Date.now();
  return ms <= ahora + ADELANTO_MAXIMO_MS && ahora - ms <= ANTIGUEDAD_MAXIMA_MS;
}
