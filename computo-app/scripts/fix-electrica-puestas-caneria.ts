// Fase 2 del bug "clona a $0" — Instalación Eléctrica, sub-tanda 6a:
// Puestas eléctricas y cañería (3 códigos, 4 materiales compartidos).
//
// Confirmado (sin material mal asignado) en los 3. Sin equipos en
// ningún APU. Ninguno usado en Rubro real de HOGAR/Matisse Monet.
//
// Fuentes de precio (USD convertido a $40,85/USD, BROU venta) — gama
// media/estándar, priorizando Fivisa (especializada en material
// eléctrico) según lo pedido:
//  - Conduit PVC 20mm: Fivisa, Tuboform, caño negro PVC curvable en
//    frío 20mm, 3m, USD 4,00 → $54,47/ml real.
//  - Caja de embutir rectangular: Fivisa, Geros GR1010, 118x96x70mm
//    (tamaño intermedio del catálogo, ni el más chico ni el más
//    grande), USD 2,23 → $91,10/u real.
//  - Cable eléctrico 2.5mm: Fivisa, Fustix CF 2,5mm² (cobre flexible,
//    apto para cañería embutida, clase 5), rollo 100m, USD 63,81 →
//    $26,07/ml real. Se descartaron los "cable bajo goma/plástico"
//    multi-conductor (2x2,5mm², 5x2,5mm²) por ser cables de vaina para
//    instalación portátil/industrial, no el conductor unifilar que
//    corresponde a una cañería embutida.
//  - Tomacorriente o interruptor (criterio: promedio, sin desdoblar):
//    Tomacorriente — Fivisa, módulo entrada lateral Presta (con
//    tierra y seguro), USD 2,98 → $121,73/u. Interruptor — Fivisa,
//    módulo llave unipolar 10A 250V Sica, USD 1,19 → $48,61/u.
//    Promedio real: $85,17/u.
//
// Autocuestionamiento pedido por el usuario: el conduit ($54,47/ml)
// sale más caro que el cable ($26,07/ml). Verificado que no es un
// error — un caño de PVC de 20mm extruido usa más material físico por
// metro lineal que un conductor de cobre de 2,5mm² (calibre fino), y
// ambos precios están confirmados directo en la ficha de producto de
// Fivisa (no son una estimación cruzada).
//
// Sin cambios de mano de obra. GG 15% / Utilidad 10%, sin leyes
// sociales.
//
// Ejecutar (dry-run): npx tsx scripts/fix-electrica-puestas-caneria.ts
// Ejecutar (real):     npx tsx scripts/fix-electrica-puestas-caneria.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;
const USD_UYU = 40.85;

const CONDUIT_20MM_ML = (4.0 / 3) * USD_UYU;
const CAJA_EMBUTIR_U = 2.23 * USD_UYU;
const CABLE_25MM_ML = (63.81 / 100) * USD_UYU;
const TOMACORRIENTE_U = 2.98 * USD_UYU;
const INTERRUPTOR_U = 1.19 * USD_UYU;
const TOMA_O_INTERRUPTOR_U = (TOMACORRIENTE_U + INTERRUPTOR_U) / 2;

type MaterialNuevo = { codigoMTOP: string; descripcion: string; unidad: string; precio: number };
type Def = { codigo: string; materialesNuevos: MaterialNuevo[] };

const DEFS: Def[] = [
  {
    codigo: "7.2.17",
    materialesNuevos: [
      { codigoMTOP: "MAT-CAJA-EMBUTIR-RECT", descripcion: "Caja de embutir rectangular", unidad: "u", precio: CAJA_EMBUTIR_U },
      { codigoMTOP: "MAT-CABLE-ELECTRICO-25MM", descripcion: "Cable eléctrico 2.5mm", unidad: "ml", precio: CABLE_25MM_ML },
      { codigoMTOP: "MAT-TOMA-O-INTERRUPTOR", descripcion: "Tomacorriente o interruptor", unidad: "u", precio: TOMA_O_INTERRUPTOR_U },
      { codigoMTOP: "MAT-CONDUIT-PVC-20MM", descripcion: "Conduit PVC 20mm", unidad: "ml", precio: CONDUIT_20MM_ML },
    ],
  },
  {
    codigo: "electrica-001",
    materialesNuevos: [
      { codigoMTOP: "MAT-CAJA-EMBUTIR-RECT", descripcion: "Caja de embutir rectangular", unidad: "u", precio: CAJA_EMBUTIR_U },
      { codigoMTOP: "MAT-CABLE-ELECTRICO-25MM", descripcion: "Cable eléctrico 2.5mm", unidad: "ml", precio: CABLE_25MM_ML },
      { codigoMTOP: "MAT-TOMA-O-INTERRUPTOR", descripcion: "Tomacorriente o interruptor", unidad: "u", precio: TOMA_O_INTERRUPTOR_U },
      { codigoMTOP: "MAT-CONDUIT-PVC-20MM", descripcion: "Conduit PVC 20mm", unidad: "ml", precio: CONDUIT_20MM_ML },
    ],
  },
  {
    codigo: "electrica-004",
    materialesNuevos: [{ codigoMTOP: "MAT-CONDUIT-PVC-20MM", descripcion: "Conduit PVC 20mm", unidad: "ml", precio: CONDUIT_20MM_ML }],
  },
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
  const todosEquipos = await db.precioEquipo.findMany();
  const resolverCostoEquipo = (desc: string) =>
    todosEquipos.find((e) => e.descripcion.toLowerCase().includes(desc.toLowerCase()))?.precioHora ?? 0;

  for (const def of DEFS) {
    const s = await db.subrubroEstandar.findFirst({
      where: { codigo: def.codigo },
      include: { apuEstandar: { include: { materiales: true, manoObra: true, equipos: true } } },
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

    const sumEq = s.apuEstandar.equipos.reduce((acc, eq) => {
      const costo = resolverCostoEquipo(eq.descripcion);
      console.log(`  Equipo: ${eq.descripcion} — $${costo}/${eq.unidad} (ya real, sin cambios) × rend ${eq.rendimiento}`);
      return acc + eq.rendimiento * costo;
    }, 0);
    if (s.apuEstandar.equipos.length === 0) {
      console.log(`  (sin equipos)`);
    }

    const costoDirecto = sumMat + sumMO + sumEq;
    const precioUY = Math.round(costoDirecto * (1 + GG_PCT / 100) * (1 + UTIL_PCT / 100) * 100) / 100;

    console.log(`  sumMat=$${sumMat.toFixed(2)} sumMO=$${sumMO.toFixed(2)} sumEq=$${sumEq.toFixed(2)} costoDirecto=$${costoDirecto.toFixed(2)}`);
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
