// FEAT-AI-006, etapa 2 (parcial) — migra los 154/165 registros de
// PrecioMTOP clasificados como REAL (auditoría de gobernanza de Fase 2)
// desde el texto libre de los comentarios de scripts fix-*/seed-* a los
// campos estructurados nuevos (proveedor, nombreProducto, urlReferencia,
// fechaUltimaVerificacion). SOLO METADATA DE FUENTE — no toca precioUY
// ni ningún otro dato de precio.
//
// Los 11 restantes (7 códigos de Ascensor sin proveedor identificable,
// 1 Perfil de unión policarbonato con fuente cruzada GINISA Argentina
// débil, 2 de Piscina retro-derivados sin cotización fresca, 1 no
// encontrado — MAT-CARPMET-ACCESORIOS-MOTOR) quedan para una segunda
// pasada, sin tocar en esta tanda.
//
// Clasificación de los 154 en 3 grupos (marcados vía motivoVerificacion,
// aunque requiereVerificacion queda en false — no son casos que
// necesiten revisión humana AHORA, es un tag de ruteo para que la
// etapa 3 (job de verificación trimestral) sepa qué lógica de búsqueda
// aplicar a cada uno):
//   - Retail directo (mayoría): motivoVerificacion = null. Etapa 3 hace
//     búsqueda web genérica proveedor+producto.
//   - "Derivado — ver nota" (21 códigos: mesadas escaladas desde
//     granito, aluminios Serie25→Probba→Gala, paneles isopanel
//     reutilizados, etc.): motivoVerificacion = "derivado_recalculo_proporcional".
//     No tienen producto propio buscable — la etapa 3 debe recalcular
//     proporcionalmente desde el material ancla, no buscar en la web.
//   - Tarifa oficial (15 códigos: Lista MTOP, OSE, Catastro,
//     MontevideoGas): motivoVerificacion = "tarifa_oficial_organismo".
//     La etapa 3 debe consultar el sitio del organismo correspondiente,
//     no una búsqueda genérica de retail.
//
// Idempotente (update por código, no upsert de filas nuevas — los 154
// códigos ya existen en PrecioMTOP desde Fase 2).
//
// Ejecutar (dry-run): npx tsx scripts/fix-feat006-migrar-fuentes-real.ts
// Ejecutar (real):     npx tsx scripts/fix-feat006-migrar-fuentes-real.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import fs from "fs";
import path from "path";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const DERIVADO_MARCADOR = "Derivado — ver nota";
// Señal adicional de precio derivado/interpolado — se agregó después de
// encontrar 3 códigos que NO usaban el marcador exacto de arriba (venían
// de tandas de migración distintas, con su propia convención de texto:
// "Interpolado — proveedorA (...) y proveedorB (...)" en vez de
// "Derivado — ver nota") y por eso se colaban como "retail directo" en
// la etapa 3 — el job de verificación les hacía una búsqueda web genérica
// en vez de excluirlos para la lógica de recálculo proporcional que
// necesitan (ver MAT-CANO-GALV-12 en la corrida de prueba --sample=35).
// Chequea proveedor Y nombreProducto porque en 2 de los 3 casos el dato
// solo aparecía en nombreProducto ("...interpolado linealmente entre...",
// "...extrapolación lineal desde...").
const PATRON_PROVEEDOR_DERIVADO = /^interpolad/i;
const PATRON_PRODUCTO_DERIVADO = /interpolad|extrapolaci/i;
const TARIFA_OFICIAL_PATRONES = ["Lista Oficial MTOP", "OSE", "MontevideoGas", "Dirección Nacional de Catastro"];

type MapeoItem = {
  codigo: string;
  proveedor: string;
  nombreProducto: string;
  urlReferencia: string | null;
  scriptOrigen: string;
  fechaUltimaVerificacion: string;
  nota?: string;
};

function clasificar(item: MapeoItem): { motivoVerificacion: string | null; proveedorFinal: string; nombreProductoFinal: string } {
  // Tarifa oficial primero: algunos derivados (ej. chapa ondulada, con
  // peso/m² interpolado por espesor) tienen como fuente BASE un
  // organismo oficial — ese es el dato que importa para rutear la
  // reconsulta en etapa 3, no el detalle de que hubo una interpolación
  // intermedia.
  const esTarifaOficial = TARIFA_OFICIAL_PATRONES.some((p) => item.proveedor.includes(p));
  if (esTarifaOficial) {
    return {
      motivoVerificacion: "tarifa_oficial_organismo",
      proveedorFinal: item.proveedor,
      nombreProductoFinal: item.nombreProducto,
    };
  }

  const esDerivado =
    item.proveedor === DERIVADO_MARCADOR ||
    PATRON_PROVEEDOR_DERIVADO.test(item.proveedor) ||
    PATRON_PRODUCTO_DERIVADO.test(item.nombreProducto);
  if (esDerivado) {
    return {
      motivoVerificacion: "derivado_recalculo_proporcional",
      proveedorFinal: `Derivado de ${item.nota ? item.nota.split(".")[0] : "material ancla (ver nota completa en auditoría)"}`,
      nombreProductoFinal: `${item.nombreProducto} — ${item.nota ?? ""}`.trim(),
    };
  }

  return { motivoVerificacion: null, proveedorFinal: item.proveedor, nombreProductoFinal: item.nombreProducto };
}

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);

  const raw = fs.readFileSync(path.join(__dirname, "_data-mapeo-feat006-real.json"), "utf8");
  const data = JSON.parse(raw) as { mapeo: MapeoItem[] };

  console.log(`Total registros a migrar: ${data.mapeo.length} (esperado: 154)\n`);

  let retail = 0;
  let derivado = 0;
  let tarifaOficial = 0;
  let noEncontradosEnDB = 0;

  for (const item of data.mapeo) {
    const { motivoVerificacion, proveedorFinal, nombreProductoFinal } = clasificar(item);
    if (motivoVerificacion === "derivado_recalculo_proporcional") derivado++;
    else if (motivoVerificacion === "tarifa_oficial_organismo") tarifaOficial++;
    else retail++;

    const existente = await db.precioMTOP.findUnique({ where: { codigo: item.codigo } });
    if (!existente) {
      console.warn(`  ⚠ ${item.codigo} — NO existe en PrecioMTOP, se salta`);
      noEncontradosEnDB++;
      continue;
    }

    console.log(
      `  ${item.codigo} — proveedor="${proveedorFinal.slice(0, 60)}${proveedorFinal.length > 60 ? "…" : ""}" fecha=${item.fechaUltimaVerificacion} motivo=${motivoVerificacion ?? "(ninguno)"}`
    );

    if (aplicar) {
      await db.precioMTOP.update({
        where: { codigo: item.codigo },
        data: {
          proveedor: proveedorFinal,
          nombreProducto: nombreProductoFinal,
          urlReferencia: item.urlReferencia,
          fechaUltimaVerificacion: new Date(item.fechaUltimaVerificacion),
          motivoVerificacion,
        },
      });
    }
  }

  console.log("\n── Resumen ──");
  console.log(`Retail directo (sin marcador):        ${retail}`);
  console.log(`Derivado (recalculo_proporcional):    ${derivado}`);
  console.log(`Tarifa oficial (organismo):           ${tarifaOficial}`);
  console.log(`No encontrados en DB (saltados):      ${noEncontradosEnDB}`);
  console.log(`Total procesado:                      ${data.mapeo.length}`);

  if (!aplicar) {
    console.log("\nDry-run — nada se escribió.");
  } else {
    console.log("\nAplicado.");
  }

  await db.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await db.$disconnect();
  process.exit(1);
});
