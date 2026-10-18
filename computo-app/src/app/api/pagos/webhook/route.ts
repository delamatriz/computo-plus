import { NextRequest, NextResponse } from "next/server";
import { firmaMercadoPagoValida } from "@/lib/mpFirma";
import { procesarPreapproval } from "@/lib/suscripciones";

// Webhook de MercadoPago (suscripciones). Sin sesión: se autoriza con la firma del header
// x-signature, validada con MP_WEBHOOK_SECRET (por eso src/proxy.ts deja pasar esta ruta). URL a
// registrar en el panel de MercadoPago: https://computo.delamatriz.com/api/pagos/webhook
//   - firma inválida → 400. Sin MP_WEBHOOK_SECRET falla cerrado (503): nunca procesa sin validar.
//   - evento que no es "subscription_preapproval" (por ejemplo cobros sueltos) → 200 sin hacer nada.
//   - llegó al final → 200. Si algo falla por dentro (base o API de MercadoPago caídas) → 500, para
//     que MercadoPago reintente: procesar el mismo evento dos veces es inofensivo.
export async function POST(req: NextRequest) {
  const secreto = process.env.MP_WEBHOOK_SECRET;
  if (!secreto) {
    console.error("[mp-webhook] falta MP_WEBHOOK_SECRET: no se procesa");
    return NextResponse.json({ error: "No configurado" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const tipo: string | null = req.nextUrl.searchParams.get("type") ?? body?.type ?? body?.topic ?? null;
  const dataId: string | null = req.nextUrl.searchParams.get("data.id") ?? (body?.data?.id != null ? String(body.data.id) : null);

  const valida = firmaMercadoPagoValida({
    xSignature: req.headers.get("x-signature"),
    xRequestId: req.headers.get("x-request-id"),
    // La firma usa el data.id del query string; el del cuerpo solo si el pedido no lo trae ahí.
    dataId,
    secreto,
  });
  if (!valida) {
    console.warn("[mp-webhook] firma inválida");
    return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
  }

  if (tipo !== "subscription_preapproval") {
    console.log(`[mp-webhook] evento ${tipo ?? "(sin tipo)"} ignorado`);
    return NextResponse.json({ ok: true, ignorado: true });
  }
  if (!dataId) {
    console.warn("[mp-webhook] subscription_preapproval sin id");
    return NextResponse.json({ ok: true, ignorado: true });
  }

  try {
    const resultado = await procesarPreapproval(dataId);
    return NextResponse.json({ ok: true, resultado });
  } catch (err) {
    console.error("[mp-webhook] error procesando", dataId, err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
