// Envío de mails transaccionales con Resend (oct-2026), por su API HTTP — sin
// SDK, es un solo POST. Remitente en config-prueba.ts (MAIL_REMITENTE).
//
// Sin RESEND_API_KEY:
//   - en desarrollo, el mail no se manda: se escribe en la consola del
//     servidor (para probar el registro sin cuenta de Resend);
//   - en producción, tira error — un registro sin mail no se puede verificar,
//     mejor fallar a la vista que dejar al usuario esperando un código.

import { CODIGO_VIGENCIA_MIN, DIAS_PRUEBA, MAIL_AVISO_REGISTROS, MAIL_CONTACTO, MAIL_REMITENTE } from "@/lib/config-prueba";
import { mpUrlBase } from "@/lib/config-mercadopago";

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

// Datos cargados por el usuario: se escapan antes de meterlos en el HTML.
const escaparHtml = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const fmtUY = (fecha: Date, conHora: boolean) =>
  fecha.toLocaleString("es-UY", {
    timeZone: "America/Montevideo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(conHora ? { hour: "2-digit", minute: "2-digit" } : {}),
  });

/** Aviso interno (a MAIL_AVISO_REGISTROS) de una empresa nueva registrada en la prueba gratis. */
export async function enviarAvisoNuevaEmpresa(datos: {
  empresa: string;
  usuario: string;
  email: string;
  rut: string | null;
  registradaEn: Date;
  vencePrueba: Date;
}): Promise<void> {
  const filas: [string, string][] = [
    ["Empresa", datos.empresa],
    ["Usuario", datos.usuario],
    ["Email", datos.email],
    ["RUT", datos.rut || "—"],
    ["Registro", `${fmtUY(datos.registradaEn, true)} (hora de Uruguay)`],
    ["Estado", `Prueba (${DIAS_PRUEBA} días, vence el ${fmtUY(datos.vencePrueba, false)})`],
  ];
  const texto = ["Se registró una empresa nueva en CÓMPUTO+.", "", ...filas.map(([k, v]) => `${k}: ${v}`)].join("\n");
  const html = `<!doctype html>
<html lang="es"><body style="margin:0;background:#F8FAFC;font-family:'DM Sans',Arial,sans-serif;color:#1E293B">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #E2E8F0;border-radius:12px;padding:24px">
        <tr><td style="font-size:18px;font-weight:700;color:#1A3A5C;padding-bottom:12px">Nueva empresa registrada</td></tr>
        ${filas
          .map(
            ([k, v]) =>
              `<tr><td style="font-size:14px;line-height:1.6"><span style="color:#64748B">${k}:</span> <strong>${escaparHtml(v)}</strong></td></tr>`
          )
          .join("\n        ")}
      </table>
    </td></tr>
  </table>
</body></html>`;
  await enviarMail({ para: MAIL_AVISO_REGISTROS, asunto: `Nueva empresa registrada — ${datos.empresa}`, html, texto });
}


// ── Vencimiento de la prueba (job diario, ver lib/vencimientosPrueba.ts) ─────────────────────
export type TipoAvisoVencimiento = "aviso11" | "aviso13" | "aviso14";

interface PlantillaVencimiento {
  asunto: string;
  /** Párrafos del cuerpo, en texto plano (después del saludo y antes de la firma). */
  parrafos: string[];
  /** Color del título: azul de la app mientras la prueba corre, el mismo azul al vencer. */
  titulo: string;
}

function plantillaVencimiento(tipo: TipoAvisoVencimiento, vence: Date): PlantillaVencimiento {
  const fecha = fmtUY(vence, false);
  const planes = `${mpUrlBase()}/planes`;
  const contacto = `Para continuar usando CÓMPUTO+, elegí tu plan en ${planes} o escribinos a ${MAIL_CONTACTO}.`;
  if (tipo === "aviso11") {
    return {
      asunto: "Tu prueba de CÓMPUTO+ vence en 3 días",
      titulo: "Tu prueba vence en 3 días",
      parrafos: [
        `Te recordamos que tu período de prueba de CÓMPUTO+ vence el ${fecha}.`,
        "Cuando venza, tu cuenta pasará a modo inactivo y vas a necesitar elegir un plan para seguir usando CÓMPUTO+. Tus proyectos y datos van a quedar guardados.",
        `${contacto} Con gusto te ayudamos.`,
      ],
    };
  }
  if (tipo === "aviso13") {
    return {
      asunto: "Tu prueba de CÓMPUTO+ vence mañana",
      titulo: "Tu prueba vence mañana",
      parrafos: [
        `Tu período de prueba de CÓMPUTO+ vence mañana, ${fecha}.`,
        "A partir de ese momento tu cuenta pasará a modo inactivo y no vas a poder usar la app hasta elegir un plan. Tus proyectos y datos van a quedar guardados. Si estás trabajando en un presupuesto, conviene que lo termines o lo exportes antes.",
        `${contacto} Si lo hacés hoy, no vas a tener ninguna interrupción.`,
      ],
    };
  }
  return {
    asunto: "Tu período de prueba de CÓMPUTO+ ha terminado",
    titulo: "Tu período de prueba ha terminado",
    parrafos: [
      "Tu período de prueba de CÓMPUTO+ ha terminado. Tu cuenta pasó a modo inactivo. Tus proyectos y datos están guardados — podés reactivar tu cuenta en cualquier momento eligiendo un plan.",
      `Elegí tu plan en ${planes} o escribinos a ${MAIL_CONTACTO} y lo resolvemos.`,
    ],
  };
}

/**
 * Mail a una empresa con el formato de los avisos de cuenta: saludo "Hola, equipo de X:", título,
 * párrafos, un botón y la firma del equipo. Se manda a cada destinatario por separado. Solo tira si
 * no salió ninguno (quien lo llama decide si reintenta); si salió al menos uno, cuenta como enviado.
 */
async function enviarAvisoEmpresa(datos: {
  para: string[];
  empresa: string;
  asunto: string;
  titulo: string;
  parrafos: string[];
  boton: { texto: string; href: string };
  etiqueta: string;
}): Promise<void> {
  const { asunto, parrafos, titulo, boton } = datos;
  const saludo = `Hola, equipo de ${datos.empresa}:`;
  const firma = "El equipo de CÓMPUTO+";

  const texto = [saludo, "", ...parrafos.flatMap((p) => [p, ""]), firma].join("\n");
  const html = `<!doctype html>
<html lang="es"><body style="margin:0;background:#F8FAFC;font-family:'DM Sans',Arial,sans-serif;color:#1E293B">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #E2E8F0;border-radius:12px;padding:32px">
        <tr><td style="font-size:22px;font-weight:700;color:#1A3A5C">CÓMPUTO<span style="color:#2563EB">+</span></td></tr>
        <tr><td style="padding-top:20px;font-size:18px;font-weight:700;color:#1A3A5C">${escaparHtml(titulo)}</td></tr>
        <tr><td style="padding-top:12px;font-size:15px;line-height:1.6">${escaparHtml(saludo)}</td></tr>
        ${parrafos
          .map((p) => `<tr><td style="padding-top:12px;font-size:15px;line-height:1.6">${escaparHtml(p)}</td></tr>`)
          .join("\n        ")}
        <tr><td style="padding-top:20px"><a href="${boton.href}" style="display:inline-block;background:#2563EB;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:8px">${escaparHtml(boton.texto)}</a></td></tr>
        <tr><td style="padding-top:24px;font-size:14px;line-height:1.5;color:#64748B">${firma}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  let salieron = 0;
  let ultimoError: unknown = null;
  for (const para of datos.para) {
    try {
      await enviarMail({ para, asunto, html, texto });
      salieron++;
    } catch (err) {
      ultimoError = err;
      console.error(`[mail] ${datos.etiqueta} a ${para}`, err);
    }
  }
  if (salieron === 0) throw ultimoError instanceof Error ? ultimoError : new Error("No salió ningún mail");
}

/** Mail del flujo de vencimiento de la prueba (job diario, ver lib/vencimientosPrueba.ts). */
export async function enviarAvisoVencimientoPrueba(datos: {
  para: string[];
  empresa: string;
  tipo: TipoAvisoVencimiento;
  vence: Date;
}): Promise<void> {
  const { asunto, parrafos, titulo } = plantillaVencimiento(datos.tipo, datos.vence);
  await enviarAvisoEmpresa({
    para: datos.para,
    empresa: datos.empresa,
    asunto,
    titulo,
    parrafos,
    boton: { texto: `Escribinos a ${MAIL_CONTACTO}`, href: `mailto:${MAIL_CONTACTO}` },
    etiqueta: datos.tipo,
  });
}

/**
 * Mail cuando MercadoPago informa que la suscripción se canceló o se pausó (webhook, ver
 * lib/suscripciones.ts): la cuenta queda inactiva y se puede reactivar desde /planes.
 */
export async function enviarAvisoSuscripcionCancelada(datos: { para: string[]; empresa: string }): Promise<void> {
  const planes = `${mpUrlBase()}/planes`;
  await enviarAvisoEmpresa({
    para: datos.para,
    empresa: datos.empresa,
    asunto: "Tu suscripción de CÓMPUTO+ fue cancelada",
    titulo: "Tu suscripción fue cancelada",
    parrafos: [
      "Tu suscripción de CÓMPUTO+ fue cancelada. Tu cuenta pasó a modo inactivo. Tus proyectos y datos están guardados — podés reactivar tu cuenta en cualquier momento eligiendo un plan.",
      `Para reactivar tu cuenta, elegí un plan en ${planes} o escribinos a ${MAIL_CONTACTO}.`,
    ],
    boton: { texto: "Elegir un plan", href: planes },
    etiqueta: "suscripcion-cancelada",
  });
}
