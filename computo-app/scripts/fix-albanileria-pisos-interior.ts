// Fase 2 del bug "clona a $0" — Tanda 2 (Albañilería), sub-tanda 2,
// Grupo A: pisos de interior "blandos" (6 códigos).
//
// Confirmado (sin material mal asignado): en los 6 el material del
// APU coincide con lo que el código describe. Ninguno usado en Rubro
// real de HOGAR/Matisse Monet.
//
// Chequeo del orden esperado (rollo < baldosa ≈ H2O < flotante <
// parquet) — NO se sostiene completo con fuentes reales equivalentes:
//  - Baldosa vinílica sale más barata que el rollo (no al revés). El
//    rollo usado es de grado comercial/industrial pesado (clase
//    34/43 ISO 10874), la baldosa es de uso comercial moderado (clase
//    31) — no son grados exactamente equivalentes, pero es la
//    comparación real más cercana disponible.
//  - H2O (SPC rígido) resulta la MÁS cara de las 5, no "≈ baldosa" —
//    tiene sentido: es una categoría de producto más moderna/premium
//    (núcleo rígido, resistente al agua) que el vinílico flexible
//    tradicional.
//  - Flotante < parquet SÍ se sostiene en precio final instalado,
//    aunque no por el material bruto (el parquet multicapa da menos
//    material que el flotante premium) sino por la mano de obra: el
//    parquet lleva mucha más MO por m² (rend. 6 vs. 18), y esa
//    diferencia termina invirtiendo el orden a favor del parquet.
// Aprobado por el usuario tal cual, sin forzar el orden esperado.
//
// Fuentes de precio (USD convertido a $40,85/USD, BROU venta):
//  - Piso vinílico H2O e=8mm: Sodimac Uruguay, SPC "Holztek Natural
//    Brow" 4mm, USD 31/m² real → $1.266,35/m². ⚠️ espesor real (4mm)
//    distinto al del código (8mm), mismo orden de magnitud.
//  - Piso vinílico en rollo: CYPE Uruguay, heterogéneo 2mm clase
//    23/34/43 (uso comercial), material PVC solo $672,87/m² real.
//  - Baldosa vinílica 30x30cm: CYPE Uruguay, losetas PVC 455x455mm
//    clase 31 (comercial moderado), material solo $446,92/m² real.
//  - Adhesivo para vinílico (compartido 6.4.2/6.4.3): CYPE Uruguay,
//    $53,89/m² de adhesivo acrílico ÷ cobertura 0,4kg/m² (nuestro
//    rendimiento) → $134,72/kg.
//  - Piso flotante alta calidad: Sodimac Uruguay, promedio 3 gamas
//    altas (Oak/Main/Dorm, USD 27,50-30,50/m²) → $1.196,90/m².
//  - Espuma para piso flotante: CYPE Uruguay (base de espuma de
//    polietileno, del rubro de parquet multicapa), $34,40/m² real.
//  - Parquet de madera: CYPE Uruguay "Parquet multicapa" (ingeniería,
//    tres capas, 2180x200x14mm chapa de roble — gama alta, no
//    "mosaico" que es más básico), material lamas $941,40/m² real.
//  - Adhesivo para parquet: CYPE Uruguay, adhesivo+cinta selladora del
//    mismo rubro multicapa ($34,40+$14,18=$48,58/m²) ÷ 1,2kg/m²
//    (nuestro rendimiento) → $40,48/kg.
//  - Alfombra de alto tránsito: ⚠️⚠️ ADVERTENCIA MÁS FUERTE DEL SISTEMA
//    — Casa Belforte y Vinibel (mayoristas reales uruguayos) confirman
//    el producto exacto en plaza ("alfombra en baldosas/modular alto
//    tránsito") pero SIN precio publicado en ningún canal accesible.
//    Estimado escalando el total del Rubrado SAU 2022 ($1.191,81/m²)
//    con la proporción material/MO típica observada en esta
//    investigación (~80% material) y una porción de adhesivo (~15%
//    del material) análoga al resto de pisos blandos. Sin ancla de
//    precio real — revisar con criterio de obra si se detecta uso
//    real futuro antes de confiar en el número.
//  - Adhesivo para alfombra: mismo origen especulativo que la
//    alfombra, misma advertencia.
//
// Sin cambios de mano de obra. GG 15% / Utilidad 10%, sin leyes
// sociales.
//
// Ejecutar (dry-run): npx tsx scripts/fix-albanileria-pisos-interior.ts
// Ejecutar (real):     npx tsx scripts/fix-albanileria-pisos-interior.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;
const USD_UYU = 40.85;

const PISO_SPC_M2 = 31 * USD_UYU;
const ROLLO_PVC_M2 = 672.87;
const ADH_VINILICO_KG = 53.89 / 0.4;
const BALDOSA_VINILICA_M2 = 446.92;
const PISO_FLOTANTE_ALTA_M2 = ((27.5 + 29.9 + 30.5) / 3) * USD_UYU;
const ESPUMA_FLOTANTE_M2 = 34.4;
const PARQUET_MULTICAPA_M2 = 941.4;
const ADH_PARQUET_KG = (34.4 + 14.18) / 1.2;
const ALFOMBRA_ALTO_TRANSITO_M2 = 1191.81 * 0.8 * 0.85;
const ADH_ALFOMBRA_KG = (1191.81 * 0.8 * 0.15) / 0.3;

type MaterialNuevo = { codigoMTOP: string; descripcion: string; unidad: string; precio: number };
type Def = { codigo: string; materialesNuevos: MaterialNuevo[] };

const DEFS: Def[] = [
  { codigo: "6.4.1", materialesNuevos: [{ codigoMTOP: "MAT-PISO-VINILICO-H2O", descripcion: "Piso vinílico H2O e=8mm", unidad: "m2", precio: PISO_SPC_M2 }] },
  {
    codigo: "6.4.2",
    materialesNuevos: [
      { codigoMTOP: "MAT-PISO-VINILICO-ROLLO", descripcion: "Piso vinílico en rollo", unidad: "m2", precio: ROLLO_PVC_M2 },
      { codigoMTOP: "MAT-ADHESIVO-VINILICO", descripcion: "Adhesivo para vinílico", unidad: "kg", precio: ADH_VINILICO_KG },
    ],
  },
  {
    codigo: "6.4.3",
    materialesNuevos: [
      { codigoMTOP: "MAT-BALDOSA-VINILICA-3030", descripcion: "Baldosa vinílica 30x30cm", unidad: "m2", precio: BALDOSA_VINILICA_M2 },
      { codigoMTOP: "MAT-ADHESIVO-VINILICO", descripcion: "Adhesivo para vinílico", unidad: "kg", precio: ADH_VINILICO_KG },
    ],
  },
  {
    codigo: "6.4.4",
    materialesNuevos: [
      { codigoMTOP: "MAT-PISO-FLOTANTE-ALTA", descripcion: "Piso flotante alta calidad", unidad: "m2", precio: PISO_FLOTANTE_ALTA_M2 },
      { codigoMTOP: "MAT-ESPUMA-FLOTANTE", descripcion: "Espuma para piso flotante", unidad: "m2", precio: ESPUMA_FLOTANTE_M2 },
    ],
  },
  {
    codigo: "6.4.5",
    materialesNuevos: [
      { codigoMTOP: "MAT-PARQUET-MADERA", descripcion: "Parquet de madera", unidad: "m2", precio: PARQUET_MULTICAPA_M2 },
      { codigoMTOP: "MAT-ADHESIVO-PARQUET", descripcion: "Adhesivo para parquet", unidad: "kg", precio: ADH_PARQUET_KG },
    ],
  },
  {
    codigo: "6.4.9",
    materialesNuevos: [
      { codigoMTOP: "MAT-ALFOMBRA-ALTO-TRANSITO", descripcion: "Alfombra de alto tránsito", unidad: "m2", precio: ALFOMBRA_ALTO_TRANSITO_M2 },
      { codigoMTOP: "MAT-ADHESIVO-ALFOMBRA", descripcion: "Adhesivo para alfombra", unidad: "kg", precio: ADH_ALFOMBRA_KG },
    ],
  },
];

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);

  const categoriasLaborales = await db.categoriaLaboral.findMany();
  const jornalPorNombre = (nombre: string) =>
    categoriasLaborales.find((c) => c.nombre.trim().toLowerCase() === nombre.trim().toLowerCase())?.jornal ?? 0;

  for (const def of DEFS) {
    const s = await db.subrubroEstandar.findFirst({
      where: { codigo: def.codigo },
      include: { apuEstandar: { include: { materiales: true, manoObra: true } } },
    });
    if (!s || !s.apuEstandar) {
      console.error(`${def.codigo}: no encontrado — abortando.`);
      continue;
    }

    console.log(`\n${def.codigo} — ${s.descripcion}`);
    let sumMat = 0;

    for (const m of s.apuEstandar.materiales) {
      const nuevo = def.materialesNuevos.find((n) => n.descripcion.toLowerCase() === m.descripcion.toLowerCase());
      if (!nuevo) {
        console.error(`  ⚠️ material inesperado sin definición: "${m.descripcion}" — revisar script.`);
        continue;
      }
      const precio = Math.round(nuevo.precio * 100) / 100;
      console.log(`  material: ${nuevo.descripcion} — $${precio}/${nuevo.unidad} (${nuevo.codigoMTOP}) × rend ${m.rendimiento}`);
      sumMat += m.rendimiento * precio;

      if (aplicar) {
        await db.precioMTOP.upsert({
          where: { codigo: nuevo.codigoMTOP },
          create: {
            codigo: nuevo.codigoMTOP,
            descripcion: nuevo.descripcion,
            cantidadUnidad: `1 ${nuevo.unidad}`,
            unidad: nuevo.unidad,
            cantidad: 1,
            precioConIva: precio,
            precioUnitario: precio,
            numeroLista: 0,
            fechaLista: FECHA,
          },
          update: { precioUnitario: precio, precioConIva: precio },
        });
      }
    }

    const sumMO = s.apuEstandar.manoObra.reduce((acc, mo) => {
      const jornal = jornalPorNombre(mo.categoria);
      console.log(`  MO: ${mo.categoria} — rendimiento ${mo.rendimiento} U/jornada (sin cambios)`);
      return acc + jornal / mo.rendimiento;
    }, 0);

    const costoDirecto = sumMat + sumMO;
    const precioUY = Math.round(costoDirecto * (1 + GG_PCT / 100) * (1 + UTIL_PCT / 100) * 100) / 100;

    console.log(`  sumMat=$${sumMat.toFixed(2)} sumMO=$${sumMO.toFixed(2)} costoDirecto=$${costoDirecto.toFixed(2)}`);
    console.log(`  precioUY actual: $${s.precioUY} (fechaBase ${s.fechaBase}) → NUEVO: $${precioUY}`);

    if (aplicar) {
      await db.subrubroEstandar.update({ where: { codigo: def.codigo }, data: { precioUY, fechaBase: FECHA } });
    }
  }

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
