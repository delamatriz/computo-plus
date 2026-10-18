import { NextRequest, NextResponse } from "next/server";
import { PreApproval } from "mercadopago";
import { db } from "@/lib/db";
import { requerirSesion } from "@/lib/sesion";
import { estadoEfectivo } from "@/lib/acceso";
import { esPlanMP, MP_MONEDA, MP_PLANES, mpUrlBase } from "@/lib/config-mercadopago";
import { clienteMercadoPago } from "@/lib/mercadopago";

// Inicia la suscripción mensual de la empresa en MercadoPago (preapproval pendiente) y devuelve
// la URL de pago (init_point) a la que el navegador redirige. El estado real de la empresa lo
// cambia el webhook de MercadoPago al confirmarse el cobro, no esta ruta ni la back_url.
//   Body: { plan: "basico" | "premium" }
// Pueden usarla empresas en PRUEBA o VENCIDA (una VENCIDA tiene las escrituras bloqueadas por
// src/proxy.ts, que deja pasar esta ruta a propósito).
export async function POST(req: NextRequest) {
  const sesion = await requerirSesion();
  if (sesion instanceof NextResponse) return sesion;
  try {
    const body = await req.json().catch(() => null);
    const plan = body?.plan;
    if (!esPlanMP(plan)) {
      return NextResponse.json({ error: "plan_invalido", mensaje: "Plan inválido (basico o premium)." }, { status: 400 });
    }

    const mp = clienteMercadoPago();
    if (!mp) {
      console.error("[crear-suscripcion] falta MP_ACCESS_TOKEN");
      return NextResponse.json({ error: "pagos_no_configurados", mensaje: "El pago online todavía no está disponible. Escribinos y lo resolvemos." }, { status: 503 });
    }

    const empresa = await db.empresa.findUnique({
      where: { id: sesion.empresaId },
      select: { estado: true, fechaVencimientoPrueba: true },
    });
    if (!empresa) return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });
    const estado = estadoEfectivo(empresa);
    if (estado !== "PRUEBA" && estado !== "VENCIDA") {
      return NextResponse.json(
        { error: "estado_no_permitido", mensaje: estado === "ACTIVA" ? "Tu cuenta ya está activa." : "Tu cuenta no puede contratar un plan." },
        { status: 409 }
      );
    }

    const { nombre, montoUYU } = MP_PLANES[plan];
    // Una suscripción por empresa: si ya había una (intento anterior, cambio de plan) se reutiliza
    // la fila y se vuelve a "pendiente"; el id de MercadoPago se reemplaza cuando se cree el nuevo.
    await db.suscripcion.upsert({
      where: { empresaId: sesion.empresaId },
      create: { empresaId: sesion.empresaId, plan, montoUYU, estado: "pendiente" },
      update: { plan, montoUYU, estado: "pendiente", mpPreapprovalId: null },
    });

    let preapproval;
    try {
      preapproval = await new PreApproval(mp).create({
        body: {
          reason: `CÓMPUTO+ Plan ${nombre}`,
          // El webhook relaciona el cobro con la empresa por este valor.
          external_reference: sesion.empresaId,
          payer_email: sesion.email,
          back_url: `${mpUrlBase()}/planes/confirmacion`,
          status: "pending",
          auto_recurring: {
            frequency: 1,
            frequency_type: "months",
            transaction_amount: montoUYU,
            currency_id: MP_MONEDA,
          },
        },
      });
    } catch (err) {
      console.error("[crear-suscripcion] MercadoPago rechazó la suscripción", err);
      return NextResponse.json({ error: "mp_error", mensaje: "No pudimos iniciar el pago. Probá de nuevo en un rato o escribinos." }, { status: 502 });
    }

    if (!preapproval.id || !preapproval.init_point) {
      console.error("[crear-suscripcion] respuesta de MercadoPago sin id o init_point", preapproval);
      return NextResponse.json({ error: "mp_error", mensaje: "No pudimos iniciar el pago. Probá de nuevo en un rato o escribinos." }, { status: 502 });
    }

    await db.suscripcion.update({ where: { empresaId: sesion.empresaId }, data: { mpPreapprovalId: preapproval.id } });
    return NextResponse.json({ init_point: preapproval.init_point });
  } catch (err) {
    console.error("[POST /api/pagos/crear-suscripcion]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
