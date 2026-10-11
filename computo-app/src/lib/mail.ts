// Envío de mails transaccionales con Resend (oct-2026), por su API HTTP — sin
// SDK, es un solo POST. Remitente en config-prueba.ts (MAIL_REMITENTE).
//
// Sin RESEND_API_KEY:
//   - en desarrollo, el mail no se manda: se escribe en la consola del
//     servidor (para probar el registro sin cuenta de Resend);
//   - en producción, tira error — un registro sin mail no se puede verificar,
//     mejor fallar a la vista que dejar al usuario esperando un código.

import { CODIGO_VIGENCIA_MIN, MAIL_REMITENTE } from "@/lib/config-prueba";

interface Mail {
  para: string;
  asunto: string;
  html: string;
  texto: string;
}

export async function enviarMail({ para, asunto, html, texto }: Mail): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "production") throw new Error("Falta RESEND_API_KEY: no se pueden enviar mails.");
    console.log(`\n[mail · modo dev, sin RESEND_API_KEY] Para: ${para}\nAsunto: ${asunto}\n${texto}\n`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: MAIL_REMITENTE, to: [para], subject: asunto, html, text: texto }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`Resend respondió ${res.status}: ${await res.text().catch(() => "")}`);
  }
}

export async function enviarCodigoVerificacion(para: string, codigo: string): Promise<void> {
  const texto = [
    `Tu código para activar tu cuenta de CÓMPUTO+ es: ${codigo}`,
    "",
    `Vence en ${CODIGO_VIGENCIA_MIN} minutos. Si no pediste este código, ignorá este mail.`,
  ].join("\n");
  const html = `<!doctype html>
<html lang="es"><body style="margin:0;background:#F8FAFC;font-family:'DM Sans',Arial,sans-serif;color:#1E293B">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#ffffff;border:1px solid #E2E8F0;border-radius:12px;padding:32px">
        <tr><td style="font-size:22px;font-weight:700;color:#1A3A5C">CÓMPUTO<span style="color:#2563EB">+</span></td></tr>
        <tr><td style="padding-top:20px;font-size:15px;line-height:1.5">Tu código para activar tu cuenta es:</td></tr>
        <tr><td style="padding:16px 0;font-size:34px;font-weight:700;letter-spacing:8px;color:#1A3A5C">${codigo}</td></tr>
        <tr><td style="font-size:13px;line-height:1.5;color:#64748B">Vence en ${CODIGO_VIGENCIA_MIN} minutos. Si no pediste este código, ignorá este mail.</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  await enviarMail({ para, asunto: `${codigo} es tu código de CÓMPUTO+`, html, texto });
}
