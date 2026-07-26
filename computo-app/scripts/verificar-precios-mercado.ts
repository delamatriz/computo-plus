// FEAT-AI-006, etapa 3 — job de verificación periódica de precios de
// mercado libre (por ahora script manual, NO cron activo todavía).
//
// ALCANCE de esta primera versión: SOLO los registros de "retail
// directo" — proveedor poblado, motivoVerificacion NULL,
// requiereVerificacion=false (~116 códigos). Los marcados como
// "derivado_recalculo_proporcional", "derivado_modelo_regresion" y
// "tarifa_oficial_organismo" quedan fuera a propósito — necesitan
// lógica de re-verificación distinta (recálculo proporcional desde un
// material ancla, o consulta al sitio del organismo en vez de
// búsqueda web genérica), a sumar en una fase 3b futura.
//
// Para cada insumo elegible:
//   1. Arma un prompt con Claude + tool web_search, pidiendo el precio
//      ACTUAL del mismo producto en el mismo proveedor.
//   2. El modelo solo devuelve lo que encontró (precio o "no
//      encontrado") — la comparación contra el precio guardado y la
//      decisión de qué hacer las hace este script, no el modelo.
//   3a. Variación absoluta < umbralAlertaPorcentaje (default 17.5%):
//       actualiza precioUnitario/precioConIva, fechaUltimaVerificacion
//       = hoy, requiereVerificacion queda false. Sin intervención
//       humana.
//   3b. Variación >= umbral: NO toca el precio. Marca
//       requiereVerificacion=true, motivoVerificacion="variacion_alta",
//       guarda el precio nuevo en precioSugeridoPendiente para que la
//       etapa 4 (UI) lo muestre en la comparación.
//   3c. No se encuentra el producto o falla la búsqueda: NO toca el
//       precio. Marca requiereVerificacion=true, motivoVerificacion=
//       "producto_no_encontrado" o "fuente_no_disponible" según
//       corresponda.
//
// NOTA IMPORTANTE (limitación conocida, fuera de alcance de esta
// etapa): actualizar PrecioMTOP.precioUnitario NO recalcula
// automáticamente el precioUY de los SubrubroEstandar de biblioteca
// que usan este material — esos quedan desactualizados hasta que se
// corra una recalculación aparte (mismo patrón "recalcular y guardar"
// usado varias veces en Fase 2). No se resuelve acá.
//
// Modo dry-run (default): consulta y muestra qué haría, no escribe
// nada. Modo --apply: escribe en base. Flag --sample=N: limita a los
// primeros N registros elegibles (para pruebas controladas antes de
// correr contra todos).
//
// Ejecutar (prueba chica, dry-run):
//   npx tsx scripts/verificar-precios-mercado.ts --sample=8
// Ejecutar (real, contra todos los elegibles):
//   npx tsx scripts/verificar-precios-mercado.ts --apply

import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import Anthropic from "@anthropic-ai/sdk";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });
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
  "fuente_detalle": "breve descripción de qué encontraste, en qué unidad de venta original, y la conversión aplicada si hizo falta"
}`;

type ResultadoModelo = {
  encontrado: boolean;
  precio_encontrado: number | null;
  moneda: "UYU" | "USD" | null;
  motivo_no_encontrado: "producto_no_encontrado" | "fuente_no_disponible" | null;
  fuente_detalle: string;
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

async function main() {
  const aplicar = process.argv.includes("--apply");
  const sampleArg = process.argv.find((a) => a.startsWith("--sample="));
  const sample = sampleArg ? parseInt(sampleArg.split("=")[1], 10) : null;

  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}`);
  console.log(`Muestra: ${sample ? `primeros ${sample} registros` : "todos los elegibles"}\n`);

  const elegibles = await db.precioMTOP.findMany({
    where: { proveedor: { not: null }, motivoVerificacion: null, requiereVerificacion: false },
    orderBy: { codigo: "asc" },
  });

  console.log(`Total elegibles (retail directo, sin marcador): ${elegibles.length} (esperado ~116)\n`);

  const aProcesar = sample ? elegibles.slice(0, sample) : elegibles;
  console.log(`A procesar en esta corrida: ${aProcesar.length}\n`);

  let actualizadosAuto = 0;
  let variacionAlta = 0;
  let noEncontrados = 0;
  let errores = 0;

  for (const item of aProcesar) {
    console.log(`\n── ${item.codigo} — ${item.descripcion} ──`);
    console.log(`   Proveedor: ${item.proveedor}`);
    console.log(`   Producto: ${item.nombreProducto?.slice(0, 100)}${(item.nombreProducto?.length ?? 0) > 100 ? "…" : ""}`);
    console.log(`   Precio guardado: $${item.precioUnitario}/${item.unidad}`);

    let resultado: ResultadoModelo;
    try {
      resultado = await consultarPrecio(item.proveedor!, item.nombreProducto ?? item.descripcion, item.unidad, item.precioUnitario);
    } catch (err) {
      console.log(`   ⚠ ERROR en la consulta: ${(err as Error).message}`);
      errores++;
      if (aplicar) {
        await db.precioMTOP.update({
          where: { codigo: item.codigo },
          data: { requiereVerificacion: true, motivoVerificacion: "fuente_no_disponible" },
        });
      }
      continue;
    }

    if (!resultado.encontrado || resultado.precio_encontrado == null) {
      console.log(`   → NO ENCONTRADO (${resultado.motivo_no_encontrado}): ${resultado.fuente_detalle}`);
      noEncontrados++;
      if (aplicar) {
        await db.precioMTOP.update({
          where: { codigo: item.codigo },
          data: {
            requiereVerificacion: true,
            motivoVerificacion: resultado.motivo_no_encontrado ?? "producto_no_encontrado",
          },
        });
      }
      continue;
    }

    const precioNuevoUYU =
      resultado.moneda === "USD" ? Math.round(resultado.precio_encontrado * USD_UYU * 100) / 100 : resultado.precio_encontrado;

    const variacionPct = Math.abs((precioNuevoUYU - item.precioUnitario) / item.precioUnitario) * 100;
    const umbral = item.umbralAlertaPorcentaje;

    console.log(`   → Encontrado (original): ${resultado.moneda} ${resultado.precio_encontrado} — ${resultado.fuente_detalle}`);
    console.log(`   → Convertido a UYU para comparar: $${precioNuevoUYU} UYU`);
    console.log(`   → Variación: ${variacionPct.toFixed(1)}% (umbral: ${umbral}%)`);

    if (variacionPct < umbral) {
      console.log(`   ✓ Dentro del umbral — actualización automática`);
      actualizadosAuto++;
      if (aplicar) {
        await db.precioMTOP.update({
          where: { codigo: item.codigo },
          data: {
            precioUnitario: precioNuevoUYU,
            precioConIva: precioNuevoUYU,
            fechaUltimaVerificacion: new Date(),
            requiereVerificacion: false,
            precioSugeridoPendiente: null,
          },
        });
      }
    } else {
      console.log(`   ⚠ Supera el umbral — requiere verificación humana`);
      variacionAlta++;
      if (aplicar) {
        await db.precioMTOP.update({
          where: { codigo: item.codigo },
          data: {
            requiereVerificacion: true,
            motivoVerificacion: "variacion_alta",
            precioSugeridoPendiente: precioNuevoUYU,
            fechaUltimaVerificacion: new Date(),
          },
        });
      }
    }
  }

  console.log("\n── Resumen ──");
  console.log(`Procesados:                 ${aProcesar.length}`);
  console.log(`Actualizados automático:    ${actualizadosAuto}`);
  console.log(`Variación alta (revisión):  ${variacionAlta}`);
  console.log(`No encontrados (revisión):  ${noEncontrados}`);
  console.log(`Errores de consulta:        ${errores}`);
  console.log(aplicar ? "\nAplicado." : "\nDry-run — nada se escribió.");

  await db.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await db.$disconnect();
  process.exit(1);
});
