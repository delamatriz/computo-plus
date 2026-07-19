// Fase 2 del bug "clona a $0" — Tanda 2 (Albañilería), sub-tanda 2,
// Grupo C: varios (6 códigos, sin relación temática entre sí — cierra
// la Tanda 2 por completo).
//
// Confirmado (sin material mal asignado): en los 6 el material del
// APU coincide con lo que el código describe. Ninguno usado en Rubro
// real de HOGAR/Matisse Monet (confirmado por consistencia).
//
// Hallazgo: "Cemento blanco" (material de 6.1.17) YA tenía precio
// real en la Lista MTOP — "Cemento Portland blanco (en bolsa)"
// $54,44/kg — pero el `contains` no matcheaba porque "cemento blanco"
// no es substring contiguo de "cemento PORTLAND blanco". Mismo patrón
// que el bug de 6.4.8 (sub-tanda 1): no hizo falta investigar nada,
// solo renombrar el material para que matchee el precio ya existente.
//
// Fuentes de precio (USD convertido a $40,85/USD, BROU venta):
//  - Baldosa de vereda 20x20cm: Sodimac Uruguay, $23/u real → $575/m²
//    (25 unidades/m²).
//  - Ladrillo de vidrio 19x19x8cm: 360Revestimientos.com.uy, línea
//    "Brilly" USD 13,50/u real → $551,48/u. ⚠️ línea de color
//    específica confirmada con precio; no se verificó si la variante
//    transparente básica es más barata.
//  - Varilla de armado para vidrio: Emat.com.uy, varilla de hierro
//    tratada 6mm x 12m, $19,22/ml real.
//  - Malla electrosoldada 15x15x4,2mm: Barraca Luissi, USD 3,64-3,83/m²
//    (promedio USD 3,74) → $152,57/m² real.
//  - Porcelanato 30x60cm blanco mate: Acher Cerámicas, serie Munari
//    Eliane, USD 31,48/m² real (con descuento vigente) → $1.285,96/m²
//    — cae dentro del rango encontrado en la sub-tanda 1 para 60x60
//    (USD 33-39/m²), levemente por debajo, coherente con el formato
//    más chico.
//  - Madera dura 10x5cm / Zócalo de madera 75x15mm: misma derivación
//    ya validada en 6.4.16/6.4.19 — La Casa del Carpintero (Uruguay),
//    lapacho boliviano $358.050,72/m³ implícito × sección transversal
//    de cada perfil.
//
// Sin cambios de mano de obra. GG 15% / Utilidad 10%, sin leyes
// sociales.
//
// Ejecutar (dry-run): npx tsx scripts/fix-albanileria-varios.ts
// Ejecutar (real):     npx tsx scripts/fix-albanileria-varios.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;
const USD_UYU = 40.85;
const PRECIO_M3_LAPACHO = 358050.72; // ya usado en 6.4.16/6.4.19

const BALDOSA_VEREDA_M2 = 23 * 25;
const LADRILLO_VIDRIO_U = 13.5 * USD_UYU;
const VARILLA_VIDRIO_ML = 19.22;
const MALLA_ELECTROSOLDADA_M2 = ((3.64 + 3.83) / 2) * USD_UYU;
const PORCELANATO_3060_M2 = 31.48 * USD_UYU;
const MADERA_DURA_10X5_ML = PRECIO_M3_LAPACHO * (0.1 * 0.05);
const ZOCALO_MADERA_75X15_ML = PRECIO_M3_LAPACHO * (0.075 * 0.015);

type MaterialNuevo = { codigoMTOP: string; descripcion: string; unidad: string; precio: number };
type RenombreSolo = { origenDescripcion: string; descripcion: string };
type Def = { codigo: string; materialesNuevos: MaterialNuevo[]; renombresSolo?: RenombreSolo[] };

const DEFS: Def[] = [
  { codigo: "6.4.10", materialesNuevos: [{ codigoMTOP: "MAT-BALDOSA-VEREDA-2020", descripcion: "Baldosa de vereda 20x20cm", unidad: "m2", precio: BALDOSA_VEREDA_M2 }] },
  { codigo: "6.4.15", materialesNuevos: [{ codigoMTOP: "MAT-MADERA-DURA-10X5", descripcion: "Madera dura 10x5cm", unidad: "ml", precio: MADERA_DURA_10X5_ML }] },
  { codigo: "6.4.21", materialesNuevos: [{ codigoMTOP: "MAT-ZOCALO-MADERA-7515", descripcion: "Zócalo de madera 75x15mm", unidad: "ml", precio: ZOCALO_MADERA_75X15_ML }] },
  {
    codigo: "6.1.17",
    materialesNuevos: [
      { codigoMTOP: "MAT-LADRILLO-VIDRIO-19198", descripcion: "Ladrillo de vidrio 19x19x8cm", unidad: "u", precio: LADRILLO_VIDRIO_U },
      { codigoMTOP: "MAT-VARILLA-ARMADO-VIDRIO", descripcion: "Varilla de armado para vidrio", unidad: "ml", precio: VARILLA_VIDRIO_ML },
    ],
    renombresSolo: [{ origenDescripcion: "Cemento blanco", descripcion: "Cemento Portland blanco (en bolsa)" }],
  },
  { codigo: "6.3.5", materialesNuevos: [{ codigoMTOP: "MAT-MALLA-ELECTROSOLDADA-1515", descripcion: "Malla electrosoldada 15x15x4.2mm", unidad: "m2", precio: MALLA_ELECTROSOLDADA_M2 }] },
  { codigo: "6.5.2", materialesNuevos: [{ codigoMTOP: "MAT-PORCELANATO-3060-BLANCO", descripcion: "Porcelanato 30x60cm", unidad: "m2", precio: PORCELANATO_3060_M2 }] },
];

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);

  const categoriasLaborales = await db.categoriaLaboral.findMany();
  const jornalPorNombre = (nombre: string) =>
    categoriasLaborales.find((c) => c.nombre.trim().toLowerCase() === nombre.trim().toLowerCase())?.jornal ?? 0;
  const todosPrecios = await db.precioMTOP.findMany();
  const resolverPrecioExistente = (desc: string) =>
    todosPrecios.find((p) => p.descripcion.toLowerCase().includes(desc.toLowerCase()))?.precioUnitario ?? 0;

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
      const renombreSolo = def.renombresSolo?.find((r) => m.descripcion === r.origenDescripcion || m.descripcion === r.descripcion);

      if (nuevo) {
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
      } else if (renombreSolo) {
        const precio = resolverPrecioExistente(renombreSolo.descripcion);
        console.log(`  material: ${renombreSolo.descripcion} — $${precio}/${m.unidad} (renombrado desde "${renombreSolo.origenDescripcion}", ya real, sin PrecioMTOP nuevo) × rend ${m.rendimiento}`);
        sumMat += m.rendimiento * precio;

        if (aplicar && m.descripcion === renombreSolo.origenDescripcion) {
          await db.materialAPUEstandar.update({ where: { id: m.id }, data: { descripcion: renombreSolo.descripcion } });
        }
      } else {
        const precio = resolverPrecioExistente(m.descripcion);
        console.log(`  material: ${m.descripcion} — $${precio}/${m.unidad} (ya real, sin cambios) × rend ${m.rendimiento}`);
        sumMat += m.rendimiento * precio;
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
