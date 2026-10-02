// Fase 2 del bug "clona a $0" — Tanda 3 (Subcontratos -
// Acondicionamientos), sub-tanda 3e: últimos 7 códigos, todos en Obra
// Exterior/Jardín. Cierra la Tanda 3 por completo.
//
// Confirmado (sin material mal asignado) en los 7. Ninguno usado en
// Rubro real de HOGAR/Matisse Monet.
//
// Chequeo de la hipótesis de sobreprecio en veneciana exterior vs.
// interior (pedido explícitamente por el usuario) — NO se sostiene:
// Bork y Uruguay Decoraciones venden lama de aluminio "a medida" sin
// diferenciar precio interior/exterior. El aluminio ya es resistente
// a la intemperie por naturaleza (a diferencia de PVC/madera, que sí
// implicarían un salto de material). Se aplicó un margen modesto
// (+10%) solo por accesorios de montaje/estanqueidad de exterior, no
// por un material distinto — mucho menor al salto que se suponía.
//
// Fuentes de precio:
//  - Césped artificial h=20mm: Sodimac Uruguay, Just Home Collection,
//    $700/m² real (⚠️ formato chico tipo alfombra, no rollo
//    profesional de jardín).
//  - Baldosa Green Block: Prodeco (Uruguay), $139/pieza 35x35cm →
//    $1.134,69/m² real.
//  - Toldo vertical manual: Casajardín (Uruguay), 3,50x2,00m,
//    $5.077/m² real.
//  - Cortina veneciana exterior: reusa base de la interior (Bork,
//    $2.000/m², ya real) +10% por accesorios de montaje exterior.
//  - Arena de sílice, tabla/estructura/tornillos de deck, baldosa de
//    caucho reciclado, adhesivo para caucho, soporte para toldo: ⚠️⚠️
//    sin fuente puntual en Uruguay (productos reales confirmados en
//    varios casos, pero sin precio publicado) — estimación gruesa.
//  - Piscina de poliéster + Equipo de filtrado: ⚠️⚠️ ítem muy
//    específico/caro sin cotización fresca — retro-derivado del
//    Rubrado SAU 2022 (material implícito $158.418,67 combinado,
//    descontando MO y los materiales ya reales —cemento, balasto—)
//    +20% de ajuste por inflación 2022→2026, dividido 85%/15% entre
//    piscina y equipo.
//
// Sin cambios de mano de obra. GG 15% / Utilidad 10%, sin leyes
// sociales.
//
// Ejecutar (dry-run): npx tsx scripts/fix-acondicionamientos-obra-exterior.ts
// Ejecutar (real):     npx tsx scripts/fix-acondicionamientos-obra-exterior.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;

const CESPED_M2 = 700;
const ARENA_SILICE_KG = 45;
const TABLA_DECK_M2 = 1000;
const ESTRUCTURA_DECK_ML = 250;
const TORNILLOS_DECK_U = 8;
const GREEN_BLOCK_M2 = 139 / (0.35 * 0.35);
const BALDOSA_CAUCHO_M2 = 1800;
const ADHESIVO_CAUCHO_KG = 150;
const PISCINA_U = 161587.04;
const EQUIPO_FILTRADO_U = 28515.36;
const TOLDO_M2 = 5077;
const SOPORTE_TOLDO_U = 300;
const VENECIANA_EXT_M2 = 2000 * 1.1;

type MaterialNuevo = { codigoMTOP: string; descripcion: string; unidad: string; precio: number };
type Def = { codigo: string; materialesNuevos: MaterialNuevo[] };

const DEFS: Def[] = [
  {
    codigo: "7.2.23",
    materialesNuevos: [
      { codigoMTOP: "MAT-CESPED-ARTIFICIAL-20MM", descripcion: "Césped artificial h=20mm", unidad: "m2", precio: CESPED_M2 },
      { codigoMTOP: "MAT-ARENA-SILICE-RELLENO", descripcion: "Arena de sílice para relleno", unidad: "kg", precio: ARENA_SILICE_KG },
    ],
  },
  {
    codigo: "7.2.24",
    materialesNuevos: [
      { codigoMTOP: "MAT-TABLA-DECK-MADERA", descripcion: "Tabla de deck de madera", unidad: "m2", precio: TABLA_DECK_M2 },
      { codigoMTOP: "MAT-ESTRUCTURA-SOPORTE-DECK", descripcion: "Estructura de soporte para deck", unidad: "ml", precio: ESTRUCTURA_DECK_ML },
      { codigoMTOP: "MAT-TORNILLOS-DECK", descripcion: "Tornillos para deck", unidad: "u", precio: TORNILLOS_DECK_U },
    ],
  },
  { codigo: "7.2.25", materialesNuevos: [{ codigoMTOP: "MAT-BALDOSA-GREEN-BLOCK", descripcion: "Baldosa Green Block", unidad: "m2", precio: GREEN_BLOCK_M2 }] },
  {
    codigo: "7.2.26",
    materialesNuevos: [
      { codigoMTOP: "MAT-BALDOSA-CAUCHO-5050", descripcion: "Baldosa de caucho reciclado 50x50cm", unidad: "m2", precio: BALDOSA_CAUCHO_M2 },
      { codigoMTOP: "MAT-ADHESIVO-CAUCHO", descripcion: "Adhesivo para caucho", unidad: "kg", precio: ADHESIVO_CAUCHO_KG },
    ],
  },
  {
    codigo: "7.2.27",
    materialesNuevos: [
      { codigoMTOP: "MAT-PISCINA-POLIESTER-7535", descripcion: "Piscina de poliéster 7.5x3.5x1.4m", unidad: "u", precio: PISCINA_U },
      { codigoMTOP: "MAT-EQUIPO-FILTRADO-PISCINA", descripcion: "Equipo de filtrado para piscina", unidad: "u", precio: EQUIPO_FILTRADO_U },
    ],
  },
  {
    codigo: "7.2.28",
    materialesNuevos: [
      { codigoMTOP: "MAT-TOLDO-VERTICAL-MANUAL", descripcion: "Toldo vertical manual", unidad: "m2", precio: TOLDO_M2 },
      { codigoMTOP: "MAT-SOPORTE-TOLDO", descripcion: "Soporte para toldo", unidad: "u", precio: SOPORTE_TOLDO_U },
    ],
  },
  { codigo: "7.2.29", materialesNuevos: [{ codigoMTOP: "MAT-CORTINA-VENECIANA-EXT", descripcion: "Cortina veneciana exterior", unidad: "m2", precio: VENECIANA_EXT_M2 }] },
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
