// FEAT-AI-006, etapa 3 — verifica el precio de mercado ACTUAL de un
// insumo de "retail directo" (proveedor conocido, sin fuente derivada)
// contra el proveedor guardado, usando Claude + web_search.
//
// Extraído de scripts/verificar-precios-mercado.ts para que la misma
// lógica la use tanto el script de terminal (corrida manual, todos los
// elegibles de una) como el botón "Buscar precios actualizados" de
// Configuración → Actualización de datos (tandas chicas disparadas desde
// el navegador, ver SeccionActualizacionDatos.tsx) — un solo lugar donde
// vive la regla de decisión, nunca diverge entre los dos.
//
// Regla de decisión (sin cambios respecto al script original):
// - Variación absoluta < umbralAlertaPorcentaje del ítem (default 17.5%):
//   actualiza precioUnitario/precioConIva, fechaUltimaVerificacion = hoy,
//   requiereVerificacion queda false. Sin intervención humana.
// - Variación >= umbral: NO toca el precio. Marca
//   requiereVerificacion=true, motivoVerificacion="variacion_alta",
//   guarda el precio nuevo en precioSugeridoPendiente.
// - No se encuentra el producto o falla la búsqueda: NO toca el precio.
//   Marca requiereVerificacion=true con el motivo correspondiente.

import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const SYSTEM_PROMPT = `Eres un asistente que verifica precios de materiales de construcción en el
mercado uruguayo. Se te da un proveedor, un nombre de producto ya conocido, y
la UNIDAD y el PRECIO DE REFERENCIA guardados actualmente en esa unidad.
Tu tarea es buscar el precio ACTUAL de ese mismo producto en ese mismo
proveedor (o el más cercano equivalente si el producto exacto ya no está
disponible) usando la herramienta de búsqueda web.

CRÍTICO — unidad de medida: el proveedor puede vender el producto en una
unidad de venta distinta a la unidad de referencia (ej. por pieza/bolsa/litro
en vez de por m²/kg). Si encontrás el producto pero en otra unidad de venta,
DEBÉS convertir el precio encontrado a la MISMA unidad de referencia antes de
reportarlo (usando el tamaño/rendimiento real del producto: m² por pieza, kg
por bolsa, etc.), y explicar esa conversión en "fuente_detalle". Nunca
reportes un precio en una unidad distinta a la de referencia sin convertir —
eso genera una comparación inválida.

No inventes precios ni los estimes: si no encontrás el producto o el
proveedor ya no lo vende, indicalo explícitamente.

Respondé SOLO con JSON, sin texto adicional, con este formato exacto:
{
  "encontrado": true | false,
  "precio_encontrado": number | null,
  "moneda": "UYU" | "USD" | null,
  "motivo_no_encontrado": "producto_no_encontrado" | "fuente_no_disponible" | null,
  "fuente_detalle": "breve descripción de qué encontraste, en qué unidad de venta original, y la conversión aplicada si hizo falta",
  "url_referencia": "URL exacta de la página donde encontraste el precio, o null si no encontraste nada"
}`;

type ResultadoModelo = {
  encontrado: boolean;
  precio_encontrado: number | null;
  moneda: "UYU" | "USD" | null;
  motivo_no_encontrado: "producto_no_encontrado" | "fuente_no_disponible" | null;
  fuente_detalle: string;
  url_referencia: string | null;
};

const USD_UYU = 40.85;

async function consultarPrecio(
  proveedor: string,
  nombreProducto: string,
  unidadReferencia: string,
  precioReferencia: number
): Promise<ResultadoModelo> {
  const prompt = `Proveedor: ${proveedor}
Producto ya conocido: ${nombreProducto}
Precio de referencia guardado: $${precioReferencia}/${unidadReferencia} (UYU)

Buscá el precio actual de este producto en este proveedor. Si el proveedor lo vende en una unidad de venta distinta a "${unidadReferencia}" (por pieza, por bolsa, por litro, etc.), convertí tu respuesta a $/${unidadReferencia} antes de reportarla — usá el tamaño real del producto para la conversión y explicala en fuente_detalle.`;

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];
  let message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    tools: [{ type: "web_search_20250305", name: "web_search" }],
    messages,
  });

  let intentos = 0;
  while (message.stop_reason === "pause_turn" && intentos < 5) {
    messages.push({ role: "assistant", content: message.content });
    message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages,
    });
    intentos++;
  }

  const textoCompleto = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("\n");

  const match = textoCompleto.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`No se pudo interpretar la respuesta del modelo: ${textoCompleto.slice(0, 200)}`);

  return JSON.parse(match[0]) as ResultadoModelo;
}

// "ya_no_elegible" no lo produce esta función — lo agrega el caller
// (POST procesar-tanda) cuando revalida elegibilidad justo antes de
// llamar acá, por si el registro cambió de estado entre que el cliente
// pidió la lista de elegibles y esta tanda le tocó el turno.
export type AccionVerificacion = "actualizado" | "variacion_alta" | "no_encontrado" | "error" | "ya_no_elegible";

export interface ResultadoVerificacionPrecio {
  codigo: string;
  descripcion: string;
  accion: AccionVerificacion;
  precioAnterior: number;
  precioNuevo: number | null;
  variacionPct: number | null;
  detalle: string;
  // Solo poblados cuando accion === "no_encontrado" / "variacion_alta" —
  // se guardan acá (además de aplicarse ya mismo si escribir=true) para
  // que un caller pueda cachear el resultado completo y aplicarlo después
  // sin tener que volver a consultar la IA (ver aplicarResultadoVerificacion,
  // usado por el mecanismo de resume de scripts/verificar-precios-mercado.ts).
  motivoNoEncontrado?: "producto_no_encontrado" | "fuente_no_disponible" | null;
  urlReferencia?: string | null;
}

// Único punto que escribe en PrecioMTOP a partir de un resultado ya
// decidido — lo usa verificarPrecioMTOP (cuando escribir=true, con un
// resultado recién consultado) y aplicarResultadoVerificacion (con un
// resultado cacheado de una corrida anterior del mismo ciclo, sin volver
// a consultar la IA). Mismas 4 ramas de siempre, solo movidas a un solo
// lugar para no duplicarlas entre los dos casos de uso.
async function escribirResultado(codigo: string, resultado: ResultadoVerificacionPrecio): Promise<void> {
  if (resultado.accion === "ya_no_elegible") return; // no aplica escritura — lo agrega el caller de procesar-tanda, ver arriba

  // codigo dejó de ser único por sí solo (PrecioMTOP.codigo pasó a
  // @@unique([codigo, proveedor]), para poder alojar listas de precios de
  // más de un origen) — hay que resolver el id real de esta fila antes de
  // poder actualizarla. Se usa id (no el compuesto codigo_proveedor):
  // Prisma no acepta null en el shorthand de un compound unique, y la
  // inmensa mayoría de las filas hoy tiene proveedor=null.
  const fila = await db.precioMTOP.findFirst({ where: { codigo }, select: { id: true } });
  if (!fila) return;
  const where = { id: fila.id };

  switch (resultado.accion) {
    case "error":
      await db.precioMTOP.update({
        where,
        data: { requiereVerificacion: true, motivoVerificacion: "fuente_no_disponible" },
      });
      return;
    case "no_encontrado":
      await db.precioMTOP.update({
        where,
        data: {
          requiereVerificacion: true,
          motivoVerificacion: resultado.motivoNoEncontrado ?? "producto_no_encontrado",
        },
      });
      return;
    case "actualizado":
      await db.precioMTOP.update({
        where,
        data: {
          precioUnitario: resultado.precioNuevo!,
          precioConIva: resultado.precioNuevo!,
          precioAnterior: resultado.precioAnterior,
          fechaUltimaVerificacion: new Date(),
          requiereVerificacion: false,
          precioSugeridoPendiente: null,
          origenVerificacion: "automatico",
        },
      });
      return;
    case "variacion_alta":
      await db.precioMTOP.update({
        where,
        data: {
          requiereVerificacion: true,
          motivoVerificacion: "variacion_alta",
          precioSugeridoPendiente: resultado.precioNuevo,
          fechaUltimaVerificacion: new Date(),
          detalleVerificacion: resultado.detalle,
          urlReferencia: resultado.urlReferencia,
        },
      });
      return;
  }
}

// escribir=false (solo lo usa el script de terminal, para probar con
// --sample sin tocar la base) hace la misma consulta pero se salta el
// update final — el botón de la UI siempre llama con escribir=true (el
// diseño confirmado no tiene gate de confirmación aparte, cada tanda se
// aplica sola, ver SeccionActualizacionDatos.tsx).
export async function verificarPrecioMTOP(codigo: string, escribir = true): Promise<ResultadoVerificacionPrecio> {
  // findFirst en vez de findUnique — codigo dejó de ser único por sí solo
  // (ver escribirResultado más abajo).
  const item = await db.precioMTOP.findFirst({ where: { codigo } });
  if (!item) {
    throw new Error(`Código no encontrado en PrecioMTOP: ${codigo}`);
  }

  const base = { codigo: item.codigo, descripcion: item.descripcion, precioAnterior: item.precioUnitario };

  let resultado: ResultadoModelo;
  try {
    resultado = await consultarPrecio(item.proveedor!, item.nombreProducto ?? item.descripcion, item.unidad, item.precioUnitario);
  } catch (err) {
    const salida: ResultadoVerificacionPrecio = {
      ...base,
      accion: "error",
      precioNuevo: null,
      variacionPct: null,
      detalle: `Error en la consulta: ${(err as Error).message}`,
    };
    if (escribir) await escribirResultado(codigo, salida);
    return salida;
  }

  if (!resultado.encontrado || resultado.precio_encontrado == null) {
    const salida: ResultadoVerificacionPrecio = {
      ...base,
      accion: "no_encontrado",
      precioNuevo: null,
      variacionPct: null,
      detalle: resultado.fuente_detalle,
      motivoNoEncontrado: resultado.motivo_no_encontrado,
    };
    if (escribir) await escribirResultado(codigo, salida);
    return salida;
  }

  const precioNuevoUYU =
    resultado.moneda === "USD" ? Math.round(resultado.precio_encontrado * USD_UYU * 100) / 100 : resultado.precio_encontrado;
  const variacionPct = Math.abs((precioNuevoUYU - item.precioUnitario) / item.precioUnitario) * 100;
  const umbral = item.umbralAlertaPorcentaje;

  if (variacionPct < umbral) {
    const salida: ResultadoVerificacionPrecio = {
      ...base,
      accion: "actualizado",
      precioNuevo: precioNuevoUYU,
      variacionPct,
      detalle: resultado.fuente_detalle,
    };
    if (escribir) await escribirResultado(codigo, salida);
    return salida;
  }

  const salida: ResultadoVerificacionPrecio = {
    ...base,
    accion: "variacion_alta",
    precioNuevo: precioNuevoUYU,
    variacionPct,
    detalle: resultado.fuente_detalle,
    urlReferencia: resultado.url_referencia,
  };
  if (escribir) await escribirResultado(codigo, salida);
  return salida;
}

// Aplica un resultado YA DECIDIDO en una corrida anterior (mismo ciclo,
// cacheado en scripts/.estado-verificacion-precios.json) — sin volver a
// consultar la IA. Pensado para el modo --apply del script de terminal
// cuando retoma un ciclo que ya tiene dry-runs previos: el precio/decisión
// que se muestra en el reporte es exactamente el que se escribe acá.
export async function aplicarResultadoVerificacion(codigo: string, resultado: ResultadoVerificacionPrecio): Promise<void> {
  await escribirResultado(codigo, resultado);
}
