// Fase 2 del bug "clona a $0" — Instalación Eléctrica, sub-tanda 6b:
// Tableros eléctricos (2 códigos, 1 material compartido).
//
// Confirmado (sin material mal asignado) en los 2. Sin equipos en
// ningún APU. Ninguno usado en Rubro real de HOGAR/Matisse Monet.
//
// Fuentes de precio (USD convertido a $40,85/USD, BROU venta) — gama
// media/estándar, Fivisa:
//  - Tablero eléctrico 12 circuitos: Fivisa, Schneider Electric,
//    tablero de embutir 12 módulos c/riel DIN, puerta transparente
//    (MG1566), USD 13,02 → $531,87/u real.
//  - Tablero eléctrico 24 circuitos: Fivisa, Schneider Electric,
//    tablero de embutir 24 módulos c/riel DIN, puerta blanca (línea
//    Easy9, MG1920), USD 32,51 → $1.328,03/u real. Misma marca que el
//    de 12 (evita que la diferencia de precio se explique por marca).
//  - Térmicas y diferenciales (ítem "gl", paquete estimado, NO
//    desglosado térmica por térmica, mismo criterio que "Accesorios de
//    colocación" de tandas anteriores): 1 diferencial 2P 40A 30mA
//    (Fivisa MG1208, USD 65,05) + 12 térmicas 1P 20A (Fivisa HY1520M,
//    USD 2,26 c/u) = USD 92,17 → $3.765,14/gl real — este paquete de
//    referencia representa la protección de un tablero de 12
//    circuitos. El código de 24 circuitos ya tiene su propio
//    rendimiento de 1,5 (vs. 1 del de 12) definido en el APU estándar,
//    así que el mismo precio de paquete se multiplica automáticamente
//    por 1,5 sin necesidad de un segundo material.
//
// Autocuestionamiento pedido por el usuario — ¿el tablero de 24 sale
// "el doble" sin justificación?: NO es simplemente el doble. El
// tablero de 24 (USD 32,51) cuesta 2,50x el de 12 (USD 13,02) —MISMA
// MARCA, mismo riel DIN—, es decir, la carcasa más grande cuesta
// proporcionalmente MÁS que el doble por módulo (economía de escala
// inversa, plausible en una carcasa/puerta más grande). El paquete de
// térmicas/diferenciales solo escala 1,5x (por el rendimiento ya
// definido en el APU, no 2x). Y la mano de obra (rendimiento 1→0,7)
// también sube más que proporcional. El resultado neto del precioUY
// final es electrica-003 ≈ 1,55x electrica-002 — ni "el doble" ni una
// simple copia escalada, sino la combinación real de estos 3 efectos.
//
// Sin cambios de mano de obra ni de rendimientos. GG 15% / Utilidad
// 10%, sin leyes sociales.
//
// Ejecutar (dry-run): npx tsx scripts/fix-electrica-tableros.ts
// Ejecutar (real):     npx tsx scripts/fix-electrica-tableros.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;
const USD_UYU = 40.85;

const TABLERO_12_U = 13.02 * USD_UYU;
const TABLERO_24_U = 32.51 * USD_UYU;
const TERMICA_1P_USD = 2.26;
const DIFERENCIAL_2P_USD = 65.05;
const TERMICAS_DIFERENCIALES_PAQUETE_GL = (DIFERENCIAL_2P_USD + 12 * TERMICA_1P_USD) * USD_UYU;

type MaterialNuevo = { codigoMTOP: string; descripcion: string; unidad: string; precio: number };
type Def = { codigo: string; materialesNuevos: MaterialNuevo[] };

const DEFS: Def[] = [
  {
    codigo: "electrica-002",
    materialesNuevos: [
      { codigoMTOP: "MAT-TABLERO-ELEC-12", descripcion: "Tablero eléctrico 12 circuitos", unidad: "u", precio: TABLERO_12_U },
      { codigoMTOP: "MAT-TERMICAS-DIFERENCIALES", descripcion: "Térmicas y diferenciales", unidad: "gl", precio: TERMICAS_DIFERENCIALES_PAQUETE_GL },
    ],
  },
  {
    codigo: "electrica-003",
    materialesNuevos: [
      { codigoMTOP: "MAT-TABLERO-ELEC-24", descripcion: "Tablero eléctrico 24 circuitos", unidad: "u", precio: TABLERO_24_U },
      { codigoMTOP: "MAT-TERMICAS-DIFERENCIALES", descripcion: "Térmicas y diferenciales", unidad: "gl", precio: TERMICAS_DIFERENCIALES_PAQUETE_GL },
    ],
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
