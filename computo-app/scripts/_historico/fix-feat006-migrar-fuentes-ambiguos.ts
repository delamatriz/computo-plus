// FEAT-AI-006, etapa 2 — segunda pasada. Resuelve los 11 registros que
// quedaron pendientes de la primera migración (commit 1deb343):
// 7 de Ascensor, 1 de Policarbonato, 2 de Piscina — con
// requiereVerificacion=true donde corresponde para que entren directo
// a la cola de revisión en vez de esperar la corrida trimestral.
// MAT-CARPMET-ACCESORIOS-MOTOR NO se migra (sin script trazable) — se
// documenta aparte en PENDIENTES-FASE2.md.
//
// SOLO METADATA DE FUENTE — no toca precioUY ni ningún otro dato de
// precio. Idempotente (update por código, las filas ya existen).
//
// Ejecutar (dry-run): npx tsx scripts/fix-feat006-migrar-fuentes-ambiguos.ts
// Ejecutar (real):     npx tsx scripts/fix-feat006-migrar-fuentes-ambiguos.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

type Item = {
  codigo: string;
  proveedor: string;
  nombreProducto: string;
  urlReferencia: string | null;
  fechaUltimaVerificacion: string;
  motivoVerificacion: string;
  requiereVerificacion: boolean;
};

const PROVEEDOR_DERIVADO_MODELO = "Derivado — modelo de regresión (matriz capacidad/paradas)";

const ITEMS: Item[] = [
  // 2 códigos de fix-ascensor-faltantes.ts (modelo con intercepto, 3 de 5 puntos reales)
  {
    codigo: "MAT-ASC-8P-12PAR",
    proveedor: PROVEEDOR_DERIVADO_MODELO,
    nombreProducto:
      "Ascensor 8 personas 12 paradas (instalado) — modelo: precio = -138.390,49 + 9.778,69×paradas + 168.460,26×personas, calibrado sobre 3 de 5 puntos reales de la familia de ascensores instalados y verificado contra los 5.",
    urlReferencia: null,
    fechaUltimaVerificacion: "2026-07-25",
    motivoVerificacion: "derivado_modelo_regresion",
    requiereVerificacion: false,
  },
  {
    codigo: "MAT-ASC-6P-5PAR",
    proveedor: PROVEEDOR_DERIVADO_MODELO,
    nombreProducto:
      "Ascensor 6 personas 5 paradas (instalado) — modelo: precio = -138.390,49 + 9.778,69×paradas + 168.460,26×personas, calibrado sobre 3 de 5 puntos reales de la familia de ascensores instalados y verificado contra los 5.",
    urlReferencia: null,
    fechaUltimaVerificacion: "2026-07-25",
    motivoVerificacion: "derivado_modelo_regresion",
    requiereVerificacion: false,
  },
  // 5 códigos de seed-ascensor.ts (modelo exacto sin intercepto, calibrado desde 7.2.30/7.2.31)
  {
    codigo: "MAT-ASC-4P-4PAR",
    proveedor: PROVEEDOR_DERIVADO_MODELO,
    nombreProducto:
      "Ascensor 4 personas 4 paradas (instalado) — modelo: precio = 213.102,225×personas + 12.370,05×paradas, resuelto de forma exacta a partir de 7.2.30 (8p/12par) y 7.2.31 (6p/5par).",
    urlReferencia: null,
    fechaUltimaVerificacion: "2026-07-17",
    motivoVerificacion: "derivado_modelo_regresion",
    requiereVerificacion: false,
  },
  {
    codigo: "MAT-ASC-6P-8PAR",
    proveedor: PROVEEDOR_DERIVADO_MODELO,
    nombreProducto:
      "Ascensor 6 personas 8 paradas (instalado) — modelo: precio = 213.102,225×personas + 12.370,05×paradas, resuelto de forma exacta a partir de 7.2.30 (8p/12par) y 7.2.31 (6p/5par).",
    urlReferencia: null,
    fechaUltimaVerificacion: "2026-07-17",
    motivoVerificacion: "derivado_modelo_regresion",
    requiereVerificacion: false,
  },
  {
    codigo: "MAT-ASC-8P-6PAR",
    proveedor: PROVEEDOR_DERIVADO_MODELO,
    nombreProducto:
      "Ascensor 8 personas 6 paradas (instalado) — modelo: precio = 213.102,225×personas + 12.370,05×paradas, resuelto de forma exacta a partir de 7.2.30 (8p/12par) y 7.2.31 (6p/5par).",
    urlReferencia: null,
    fechaUltimaVerificacion: "2026-07-17",
    motivoVerificacion: "derivado_modelo_regresion",
    requiereVerificacion: false,
  },
  {
    codigo: "MAT-ASC-10P-8PAR",
    proveedor: PROVEEDOR_DERIVADO_MODELO,
    nombreProducto:
      "Ascensor 10 personas 8 paradas (instalado) — modelo: precio = 213.102,225×personas + 12.370,05×paradas, resuelto de forma exacta a partir de 7.2.30 (8p/12par) y 7.2.31 (6p/5par).",
    urlReferencia: null,
    fechaUltimaVerificacion: "2026-07-17",
    motivoVerificacion: "derivado_modelo_regresion",
    requiereVerificacion: false,
  },
  {
    codigo: "MAT-ASC-CAMILLERO-10P-6PAR",
    proveedor: PROVEEDOR_DERIVADO_MODELO,
    nombreProducto:
      "Ascensor camillero 10 personas 6 paradas, uso hospitalario/PH (instalado) — modelo: precio = 213.102,225×personas + 12.370,05×paradas, resuelto de forma exacta a partir de 7.2.30 (8p/12par) y 7.2.31 (6p/5par). La variante camillero encaja en el mismo modelo sin premium adicional (observación no confirmada, no fuente de precio distinta).",
    urlReferencia: null,
    fechaUltimaVerificacion: "2026-07-17",
    motivoVerificacion: "derivado_modelo_regresion",
    requiereVerificacion: false,
  },
  // Perfil de unión policarbonato — fuente cruzada débil
  {
    codigo: "MAT-PERFIL-UNION-POLICARBONATO",
    proveedor: "GINISA (Argentina)",
    nombreProducto:
      "Perfil H de unión para policarbonato, barra 5,80m, ARS 37.143 — convertido con doble tipo de cambio (ARS→USD→UYU, jul-2026) a $174,81/ml. Fuente cruzada de menor confianza: Aluminios del Uruguay tiene el producto en catálogo sin precio visible; MercadoLibre Uruguay bloqueó el fetch (403).",
    urlReferencia: null,
    fechaUltimaVerificacion: "2026-07-25",
    motivoVerificacion: "fuente_debil_cruzada",
    requiereVerificacion: true,
  },
  // 2 de Piscina — retro-derivados sin cotización fresca
  {
    codigo: "MAT-PISCINA-POLIESTER-7535",
    proveedor: "Retro-derivado SAU 2022 + inflación estimada",
    nombreProducto:
      "Piscina de poliéster 7.5x3.5x1.4m — retro-derivado del Rubrado SAU 2022 (material implícito $158.418,67 combinado con equipo de filtrado, descontando MO y materiales ya reales) + ajuste de inflación estimado +20% (2022→2026), 85% del valor combinado. Sin cotización de mercado fresca ni proveedor identificable.",
    urlReferencia: null,
    fechaUltimaVerificacion: "2026-07-19",
    motivoVerificacion: "sin_cotizacion_fresca",
    requiereVerificacion: true,
  },
  {
    codigo: "MAT-EQUIPO-FILTRADO-PISCINA",
    proveedor: "Retro-derivado SAU 2022 + inflación estimada",
    nombreProducto:
      "Equipo de filtrado para piscina — mismo origen que MAT-PISCINA-POLIESTER-7535: retro-derivado del Rubrado SAU 2022 + ajuste de inflación estimado, 15% del valor combinado. Sin cotización de mercado fresca ni proveedor identificable.",
    urlReferencia: null,
    fechaUltimaVerificacion: "2026-07-19",
    motivoVerificacion: "sin_cotizacion_fresca",
    requiereVerificacion: true,
  },
];

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);
  console.log(`Total a migrar: ${ITEMS.length} (esperado: 10 — MAT-CARPMET-ACCESORIOS-MOTOR queda sin migrar, aparte)\n`);

  let noEncontrados = 0;
  for (const item of ITEMS) {
    const existente = await db.precioMTOP.findUnique({ where: { codigo: item.codigo } });
    if (!existente) {
      console.warn(`  ⚠ ${item.codigo} — NO existe en PrecioMTOP, se salta`);
      noEncontrados++;
      continue;
    }
    console.log(
      `  ${item.codigo} — proveedor="${item.proveedor}" motivo=${item.motivoVerificacion} requiereVerificacion=${item.requiereVerificacion}`
    );
    if (aplicar) {
      await db.precioMTOP.update({
        where: { codigo: item.codigo },
        data: {
          proveedor: item.proveedor,
          nombreProducto: item.nombreProducto,
          urlReferencia: item.urlReferencia,
          fechaUltimaVerificacion: new Date(item.fechaUltimaVerificacion),
          motivoVerificacion: item.motivoVerificacion,
          requiereVerificacion: item.requiereVerificacion,
        },
      });
    }
  }

  console.log(`\nNo encontrados en DB: ${noEncontrados}`);
  console.log(aplicar ? "\nAplicado." : "\nDry-run — nada se escribió.");

  await db.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await db.$disconnect();
  process.exit(1);
});
