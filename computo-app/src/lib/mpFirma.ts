// Verificación de la firma de los webhooks de MercadoPago (header x-signature).
//
// MercadoPago manda `x-signature: ts=<epoch>,v1=<hmac>` y `x-request-id`. El hmac es SHA-256, con
// el secreto de webhooks (MP_WEBHOOK_SECRET) como clave, de este texto (sin los campos que no
// vengan):  id:<data.id en minúscula>;request-id:<x-request-id>;ts:<ts>;
// donde data.id sale del query string del pedido (?data.id=…).

import { createHmac, timingSafeEqual } from "crypto";

export function firmaMercadoPagoValida(datos: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
  secreto: string;
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
  return a.length === b.length && timingSafeEqual(a, b);
}
