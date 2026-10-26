// Tipo de cambio dólar/peso del BCU (Banco Central del Uruguay), dólar billete.
//
// Fuente: web service SOAP oficial, público y sin clave
// (https://cotizaciones.bcu.gub.uy/wscotizaciones/servlet/...):
//   1. awsultimocierre      → fecha del último cierre publicado (día hábil).
//   2. awsbcucotizaciones   → cotización de esa fecha para el código 2225
//      (DLS. USA BILLETE): TCC (comprador) y TCV (vendedor).
// Lo consulta una vez por día el job POST /api/admin/actualizar-tipo-cambio
// (GitHub Actions) y lo guarda en TipoCambio. La app nunca le pega al BCU en
// cada pedido: lee el último valor guardado (tipoCambioVigente). Si el BCU no
// responde, el job falla sin escribir y queda el último guardado; si la base
// no tiene ninguno, se usa TIPO_CAMBIO_REFERENCIA.

import { db } from "@/lib/db";
import { TIPO_CAMBIO_REFERENCIA, type TipoCambioVigente } from "@/lib/tipoCambioReferencia";

export { TIPO_CAMBIO_REFERENCIA, type TipoCambioVigente };

const URL_BCU = "https://cotizaciones.bcu.gub.uy/wscotizaciones/servlet";
const CODIGO_DOLAR_BILLETE = 2225;
const TIMEOUT_MS = 20_000;

/** Último tipo de cambio guardado; sin ninguno, el de referencia. */
export async function tipoCambioVigente(): Promise<TipoCambioVigente> {
  const ultimo = await db.tipoCambio.findFirst({
    where: { moneda: "USD", fuente: "BCU" },
    orderBy: { fecha: "desc" },
  });
  if (!ultimo || !(ultimo.valorVenta > 0)) return { valor: TIPO_CAMBIO_REFERENCIA, fecha: null, fuente: "referencia" };
  return { valor: ultimo.valorVenta, fecha: ultimo.fecha.toISOString().slice(0, 10), fuente: "BCU" };
}

async function llamarBCU(servicio: string, cuerpo: string): Promise<string> {
  const res = await fetch(`${URL_BCU}/${servicio}`, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8" },
    body:
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:cot="Cotiza">' +
      `<soapenv:Header/><soapenv:Body>${cuerpo}</soapenv:Body></soapenv:Envelope>`,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`BCU ${servicio}: HTTP ${res.status}`);
  return res.text();
}

const etiqueta = (xml: string, nombre: string) => new RegExp(`<${nombre}>([^<]*)</${nombre}>`).exec(xml)?.[1]?.trim();

/** Consulta al BCU el último cierre del dólar billete. Tira error si el BCU no responde o la respuesta no es válida. */
export async function consultarCierreBCU(): Promise<{ fecha: string; compra: number; venta: number }> {
  const xmlCierre = await llamarBCU("awsultimocierre", "<cot:wsultimocierre.Execute/>");
  const fecha = etiqueta(xmlCierre, "Fecha");
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error("BCU awsultimocierre: respuesta sin fecha válida");

  const xml = await llamarBCU(
    "awsbcucotizaciones",
    "<cot:wsbcucotizaciones.Execute><cot:Entrada>" +
      `<cot:Moneda><cot:item>${CODIGO_DOLAR_BILLETE}</cot:item></cot:Moneda>` +
      `<cot:FechaDesde>${fecha}</cot:FechaDesde><cot:FechaHasta>${fecha}</cot:FechaHasta>` +
      "<cot:Grupo>0</cot:Grupo></cot:Entrada></cot:wsbcucotizaciones.Execute>"
  );
  if (etiqueta(xml, "status") !== "1") throw new Error(`BCU awsbcucotizaciones: status ${etiqueta(xml, "status")} ${etiqueta(xml, "mensaje") ?? ""}`);
  // El bloque del dólar billete (puede venir con otras monedas si cambia el servicio).
  const bloque = xml
    .split(/<datoscotizaciones\.dato>/)
    .find((b) => etiqueta(b, "Moneda") === String(CODIGO_DOLAR_BILLETE));
  const compra = Number(bloque && etiqueta(bloque, "TCC"));
  const venta = Number(bloque && etiqueta(bloque, "TCV"));
  // Rango de sanidad: un valor fuera de esto es una respuesta rota, no un dólar real.
  if (!(venta > 10 && venta < 200) || !(compra > 10 && compra < 200)) {
    throw new Error(`BCU awsbcucotizaciones: cotización inválida (compra ${compra}, venta ${venta})`);
  }
  return { fecha, compra, venta };
}

/** Job diario: consulta el BCU y guarda (o actualiza) la fila de esa fecha. */
export async function actualizarTipoCambio({ simular = false } = {}) {
  const cierre = await consultarCierreBCU();
  const fecha = new Date(`${cierre.fecha}T00:00:00.000Z`);
  if (!simular) {
    await db.tipoCambio.upsert({
      where: { fecha_moneda_fuente: { fecha, moneda: "USD", fuente: "BCU" } },
      create: { fecha, moneda: "USD", valorCompra: cierre.compra, valorVenta: cierre.venta, fuente: "BCU" },
      update: { valorCompra: cierre.compra, valorVenta: cierre.venta },
    });
  }
  return cierre;
}
