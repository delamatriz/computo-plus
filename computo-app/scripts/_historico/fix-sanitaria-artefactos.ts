// Fase 2 del bug "clona a $0" — Tanda 4 (Instalación Sanitaria),
// sub-tanda 4b: Sanitarios/artefactos (4 códigos).
//
// Confirmado (sin material mal asignado): en los 4 el material del
// APU coincide con lo que el código describe. Ninguno usado en Rubro
// real de HOGAR/Matisse Monet.
//
// Fuentes de precio (USD convertido a $40,85/USD, BROU venta) — gama
// media/estándar, no premium:
//  - Inodoro sin mochila (compartido sanitaria-009/010): Sodimac
//    Uruguay, Celite "Saveiro" corto, USD 69 real (se evitó "Fit",
//    USD 107-124, gama más alta).
//  - Cisterna embutida (sanitaria-009): Acher Cerámicas, Valsir
//    "Tropea FixSystem" (cisterna + soportes para muro sólido), USD
//    480,68 con descuento vigente, real — es un sistema de muro
//    completo (marco+soportes), no solo un tanque, de ahí el salto
//    de precio real frente a la cisterna de sobreponer.
//  - Cisterna de sobreponer (sanitaria-010): Sodimac Uruguay,
//    "Cisterna tradicional blanco", $1.899 real.
//  - Bañera estándar (sanitaria-013): Sodimac Uruguay, fibra y
//    acrílico 140x70x38cm, $7.919 real.
//  - Calefón a gas 10L (sanitaria-019): Sodimac Uruguay, Enxuta
//    TENX10G, USD 235 real.
//  - Grifería monocomando ducha (sanitaria-013): ya real desde
//    Acondicionamientos ($1.593,15), reusada sin cambios.
//
// Sin cambios de mano de obra. GG 15% / Utilidad 10%, sin leyes
// sociales.
//
// Ejecutar (dry-run): npx tsx scripts/fix-sanitaria-artefactos.ts
// Ejecutar (real):     npx tsx scripts/fix-sanitaria-artefactos.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;
const USD_UYU = 40.85;

const INODORO_SIN_MOCHILA_U = 69 * USD_UYU;
const CISTERNA_EMBUTIDA_U = 480.68 * USD_UYU;
const CISTERNA_SOBREPONER_U = 1899;
const BANERA_ESTANDAR_U = 7919;
const CALEFON_10L_U = 235 * USD_UYU;

type MaterialNuevo = { codigoMTOP: string; descripcion: string; unidad: string; precio: number };
type Def = { codigo: string; materialesNuevos: MaterialNuevo[] };

const DEFS: Def[] = [
  {
    codigo: "sanitaria-009",
    materialesNuevos: [
      { codigoMTOP: "MAT-INODORO-SIN-MOCHILA", descripcion: "Inodoro sin mochila", unidad: "u", precio: INODORO_SIN_MOCHILA_U },
      { codigoMTOP: "MAT-CISTERNA-EMBUTIDA", descripcion: "Cisterna embutida", unidad: "u", precio: CISTERNA_EMBUTIDA_U },
    ],
  },
  {
    codigo: "sanitaria-010",
    materialesNuevos: [
      { codigoMTOP: "MAT-INODORO-SIN-MOCHILA", descripcion: "Inodoro sin mochila", unidad: "u", precio: INODORO_SIN_MOCHILA_U },
      { codigoMTOP: "MAT-CISTERNA-SOBREPONER", descripcion: "Cisterna de sobreponer", unidad: "u", precio: CISTERNA_SOBREPONER_U },
    ],
  },
  { codigo: "sanitaria-013", materialesNuevos: [{ codigoMTOP: "MAT-BANERA-ESTANDAR", descripcion: "Bañera estándar", unidad: "u", precio: BANERA_ESTANDAR_U }] },
  { codigo: "sanitaria-019", materialesNuevos: [{ codigoMTOP: "MAT-CALEFON-GAS-10L", descripcion: "Calefón a gas 10 litros", unidad: "u", precio: CALEFON_10L_U }] },
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
