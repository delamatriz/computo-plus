// Fase 2 del bug "clona a $0" — Tanda 2 (Albañilería), sub-tanda 2,
// Grupo B: pulidos/selladores (2 códigos, sin material "de obra"
// propiamente dicho — solo productos de terminación/mantenimiento).
//
// Confirmado (sin material mal asignado): en los 2 el material del
// APU coincide con lo que el código describe. Ninguno usado en Rubro
// real de HOGAR/Matisse Monet (confirmado por consistencia).
//
// Fuentes de precio:
//  - Sellador para madera / Plastificado para piso de madera: se
//    encontró el producto exacto buscado — Sherwin Williams Uruguay,
//    línea Rexpar ("Sellador Hidro" + "Poliuretano Comercial"),
//    confirmado disponible en Uruguay pero SIN precio publicado en su
//    sitio. Se usó como sustituto el rango real confirmado de Sodimac
//    Uruguay para "Barnices y protectores de madera" (Lusol, Tersuave,
//    Elbex, Inca): $750-$3.489 (envases 1L-4L). Sellador (fondo,
//    típicamente más económico) → tramo bajo-medio $950/L.
//    Plastificado (terminación) → tramo medio-alto $1.750/L. Real
//    (rango confirmado), no un SKU puntual — advertencia simple.
//  - Cera selladora para monolítico: TodoFicina.com.uy, Spartan "Pro
//    Shine" 5L $1.509,54 c/IVA → $301,91/L — SKU real, ficha confirma
//    explícitamente uso en monolítico.
//
// Sin cambios de mano de obra. GG 15% / Utilidad 10%, sin leyes
// sociales.
//
// Ejecutar (dry-run): npx tsx scripts/fix-albanileria-pulidos.ts
// Ejecutar (real):     npx tsx scripts/fix-albanileria-pulidos.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;

const SELLADOR_MADERA_L = 950;
const PLASTIFICADO_MADERA_L = 1750;
const CERA_MONOLITICO_L = 1509.54 / 5;

type MaterialNuevo = { codigoMTOP: string; descripcion: string; unidad: string; precio: number };
type Def = { codigo: string; materialesNuevos: MaterialNuevo[] };

const DEFS: Def[] = [
  {
    codigo: "6.4.11",
    materialesNuevos: [
      { codigoMTOP: "MAT-SELLADOR-MADERA", descripcion: "Sellador para madera", unidad: "l", precio: SELLADOR_MADERA_L },
      { codigoMTOP: "MAT-PLASTIFICADO-PISO-MADERA", descripcion: "Plastificado para piso de madera", unidad: "l", precio: PLASTIFICADO_MADERA_L },
    ],
  },
  {
    codigo: "6.4.12",
    materialesNuevos: [{ codigoMTOP: "MAT-CERA-SELLADORA-MONOLITICO", descripcion: "Cera selladora para monolítico", unidad: "l", precio: CERA_MONOLITICO_L }],
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
