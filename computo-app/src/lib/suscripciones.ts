// Procesa el estado de una suscripción de MercadoPago (preapproval) y lo refleja en la base. Lo usa
// el webhook POST /api/pagos/webhook. El estado se consulta SIEMPRE a la API de MercadoPago (no se
// confía en el cuerpo de la notificación), así que repetir un evento es inofensivo: cada
// transición es idempotente y el mail de cancelación sale una sola vez.
//
//   authorized         → Suscripcion "activa"; Empresa ACTIVA, con el plan contratado; se
//                        reinician los avisos de vencimiento de la prueba
//   paused / cancelled → Suscripcion "pausada" / "cancelada"; si la empresa estaba pagando pasa a
//                        VENCIDA (sin acceso, va a /planes) y se le avisa por mail
//   pending (y otros)  → solo se registra
//
// Una empresa DESACTIVADA por el SUPERADMIN nunca se reactiva ni se pasa a otro estado por acá.

import { PreApproval } from "mercadopago";
import { db } from "@/lib/db";
import { clienteMercadoPago } from "@/lib/mercadopago";
import { enviarAvisoSuscripcionCancelada } from "@/lib/mail";
import { registrarEventoAdmin } from "@/lib/eventos-admin";

export type ResultadoPreapproval = "activada" | "cancelada" | "pausada" | "sin_cambios" | "ignorada" | "desconocida";

export async function procesarPreapproval(preapprovalId: string): Promise<ResultadoPreapproval> {
  const mp = clienteMercadoPago();
  if (!mp) throw new Error("Falta MP_ACCESS_TOKEN");
  const pre = await new PreApproval(mp).get({ id: preapprovalId });
  const estadoMP = pre.status ?? "(sin estado)";

  const sus = await db.suscripcion.findFirst({
    where: { mpPreapprovalId: preapprovalId },
    include: { empresa: { select: { id: true, nombre: true, estado: true, users: { where: { emailVerificado: true }, select: { email: true, rol: true } } } } },
  });
  if (!sus) {
    console.warn(`[mp-webhook] preapproval ${preapprovalId} (${estadoMP}) sin suscripción en la base: se ignora`);
    return "desconocida";
  }
  const { empresa } = sus;
  const evento = (detalle: string) => registrarEventoAdmin("SUSCRIPCION_MP", empresa.id, `mp-webhook:${estadoMP}`, detalle);
  console.log(`[mp-webhook] ${empresa.nombre}: preapproval ${preapprovalId} → ${estadoMP} (suscripción ${sus.estado}, empresa ${empresa.estado})`);

  if (estadoMP === "authorized") {
    const ahora = new Date();
    const ultimoCobroMP = pre.summarized?.last_charged_date ? new Date(pre.summarized.last_charged_date) : null;
    const proximo = pre.next_payment_date ? new Date(pre.next_payment_date) : null;
    await db.suscripcion.update({
      where: { id: sus.id },
      data: {
        estado: "activa",
        mpPayerId: pre.payer_id != null ? String(pre.payer_id) : sus.mpPayerId,
        fechaInicio: sus.fechaInicio ?? ahora,
        fechaProximoCobro: proximo ?? sus.fechaProximoCobro,
        // Un "authorized" repetido no pisa la fecha: solo la fija la primera vez o si MercadoPago informa el cobro.
        fechaUltimoCobro: ultimoCobroMP ?? (sus.estado === "activa" ? sus.fechaUltimoCobro : ahora),
        ultimoEstadoPago: "approved",
      },
    });
    if (empresa.estado === "DESACTIVADA") {
      await evento(`Suscripción autorizada, pero la empresa está DESACTIVADA: no se reactivó (plan ${sus.plan})`);
      return "sin_cambios";
    }
    await db.empresa.update({
      where: { id: empresa.id },
      data: { estado: "ACTIVA", plan: sus.plan, mailAviso11Enviado: false, mailAviso13Enviado: false, mailAviso14Enviado: false },
    });
    if (sus.estado !== "activa") await evento(`Suscripción activada (plan ${sus.plan}, UYU ${sus.montoUYU}): empresa ACTIVA`);
    return sus.estado === "activa" ? "sin_cambios" : "activada";
  }

  if (estadoMP === "cancelled" || estadoMP === "paused") {
    const nuevo = estadoMP === "cancelled" ? "cancelada" : "pausada";
    if (sus.estado === nuevo) return "sin_cambios"; // evento repetido
    const estabaPagando = sus.estado === "activa" || empresa.estado === "ACTIVA";
    await db.suscripcion.update({
      where: { id: sus.id },
      data: { estado: nuevo, ...(estadoMP === "cancelled" ? { ultimoEstadoPago: "cancelled" } : {}) },
    });
    // Una suscripción que nunca llegó a activarse (se canceló en el checkout) no toca la cuenta: si
    // la empresa sigue en su prueba, no se la corta.
    if (!estabaPagando || empresa.estado === "DESACTIVADA") {
      await evento(`Suscripción ${nuevo} sin haber estado activa: la empresa (${empresa.estado}) no cambia`);
      return "sin_cambios";
    }
    await db.empresa.update({ where: { id: empresa.id }, data: { estado: "VENCIDA" } });
    await evento(`Suscripción ${nuevo}: empresa VENCIDA (sin acceso hasta elegir plan)`);

    const admins = empresa.users.filter((u) => u.rol === "ADMIN");
    const para = [...new Set((admins.length > 0 ? admins : empresa.users).map((u) => u.email))];
    if (para.length > 0) {
      // Si el mail falla no se reintenta (MercadoPago reenviaría el evento y ya no habría transición).
      await enviarAvisoSuscripcionCancelada({ para, empresa: empresa.nombre }).catch((err) =>
        console.error("[mp-webhook] no se pudo mandar el mail de suscripción cancelada", err)
      );
    }
    return nuevo === "cancelada" ? "cancelada" : "pausada";
  }

  // "pending" u otro estado: no cambia nada.
  await evento(`Estado ${estadoMP} sin cambios en la cuenta`);
  return "ignorada";
}
