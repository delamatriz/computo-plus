// Cliente del SDK de MercadoPago (solo servidor). Las credenciales vienen de MP_ACCESS_TOKEN;
// con un token de prueba (TEST-…) todo corre en el sandbox. Ver lib/config-mercadopago.ts.

import { MercadoPagoConfig } from "mercadopago";

/** null si falta MP_ACCESS_TOKEN (quien lo llama responde "pagos no configurados"). */
export function clienteMercadoPago(): MercadoPagoConfig | null {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) return null;
  return new MercadoPagoConfig({ accessToken, options: { timeout: 15_000 } });
}
