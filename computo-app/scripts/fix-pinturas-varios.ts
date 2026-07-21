// Fase 2 del bug "clona a $0" — Tanda 5 (Subcontratos - Pinturas),
// sub-tanda 5c: últimos 7 códigos, todos de material único. Cierra la
// Tanda 5 por completo.
//
// Confirmado (sin material mal asignado) en los 7 — APU de un solo
// material, unidad/rendimiento coherentes con L/m². Chequeados los
// equipos ANTES de investigar (mismo cuidado que faltó en los
// enduidos exteriores de la sub-tanda 5a): ninguno de los 7 tiene
// equipo en su APU. Sin uso directo de estos 7 códigos en Rubro real,
// pero hay un APU armado a mano en Matisse Monet que usa "Fondo
// fijador acrílico para chapa cementicia y revoques nuevos" a
// $320/L (rubro cmqn3p65v003t2ee9n7fkzvva) — combina fijador +
// imprimación en un solo producto para muros, distinto del par
// separado que tenemos en biblioteca, pero corrobora el orden de
// magnitud de esa familia.
//
// Fuentes de precio — gama media/estándar, no premium:
//  - Fijador para muros: Sodimac Uruguay, Inca Fijador/Sellador al
//    agua, 1L, $659 → $659/L real.
//  - Imprimación para muros: Barraca 5 Esquinas, Tersuave Imprimación
//    Fijador, 1L, $406 → $406/L real.
//  - Fondo selladora para madera: Pinturas Amanecer (Uruguay),
//    Tapaporos para Madera, 0,85L, $576 → $677,65/L real — el
//    término técnico correcto es "tapaporos" (sella los poros de
//    madera nueva antes de barnizar/pintar), no se encontró un
//    "sellador para madera" genérico con precio propio distinto.
//  - Pintura antihongos: Sodimac Uruguay, Prodanix Antihongos Hogar,
//    1L, $229 → $229/L real.
//  - Impermeabilizante siliconado hidrorepelente: DT Importaciones,
//    Sika Igol 5-Sil (hidro-repelente de silicona en solvente), 5L,
//    $6.291 → $1.258,20/L real — match directo con la descripción del
//    material ("hidro-repelente ... en base a resina de silicona").
//    Se investigó también Sika Elastocolor (pedido explícitamente por
//    el usuario) pero es un producto distinto (pintura elastomérica
//    de terminación, no impermeabilizante hidrorepelente incoloro) y
//    sin precio publicado — no aplica como fuente para este material.
//  - Esmalte sintético: Sodimac Uruguay, Tersuave (blanco
//    brillante/mate), 1L, $740 → $740/L real. Se evitó Inca ($1.099-
//    1.209/L, catalogado como gama premium en el mismo listado).
//  - Barniz para madera: Sodimac Uruguay, Tersuave Barniz marino
//    Troya satinado caoba, 4L, $2.590 → $647,50/L real.
//
// Sin cambios de mano de obra. Ninguno de los 7 tiene equipo en su
// APU (verificado antes de calcular). GG 15% / Utilidad 10%, sin
// leyes sociales.
//
// Ejecutar (dry-run): npx tsx scripts/fix-pinturas-varios.ts
// Ejecutar (real):     npx tsx scripts/fix-pinturas-varios.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;

const FIJADOR_MUROS_L = 659;
const IMPRIMACION_MUROS_L = 406;
const FONDO_MADERA_L = 576 / 0.85;
const ANTIHONGOS_L = 229;
const IMPER_SILICONADO_L = 6291 / 5;
const ESMALTE_SINTETICO_L = 740;
const BARNIZ_MADERA_L = 2590 / 4;

type MaterialNuevo = { codigoMTOP: string; descripcion: string; unidad: string; precio: number };
type Def = { codigo: string; materialesNuevos: MaterialNuevo[] };

const DEFS: Def[] = [
  { codigo: "7.1.5", materialesNuevos: [{ codigoMTOP: "MAT-FIJADOR-MUROS", descripcion: "Fijador para muros", unidad: "l", precio: FIJADOR_MUROS_L }] },
  { codigo: "7.1.6", materialesNuevos: [{ codigoMTOP: "MAT-IMPRIMACION-MUROS", descripcion: "Imprimación para muros", unidad: "l", precio: IMPRIMACION_MUROS_L }] },
  { codigo: "7.1.7", materialesNuevos: [{ codigoMTOP: "MAT-FONDO-SELLADORA-MADERA", descripcion: "Fondo selladora para madera", unidad: "l", precio: FONDO_MADERA_L }] },
  { codigo: "7.1.11", materialesNuevos: [{ codigoMTOP: "MAT-PINTURA-ANTIHONGOS", descripcion: "Pintura antihongos", unidad: "l", precio: ANTIHONGOS_L }] },
  { codigo: "7.1.16", materialesNuevos: [{ codigoMTOP: "MAT-IMPER-SILICONADO-HIDROREP", descripcion: "Impermeabilizante siliconado hidrorepelente", unidad: "l", precio: IMPER_SILICONADO_L }] },
  { codigo: "7.1.17", materialesNuevos: [{ codigoMTOP: "MAT-ESMALTE-SINTETICO", descripcion: "Esmalte sintético", unidad: "l", precio: ESMALTE_SINTETICO_L }] },
  { codigo: "7.1.18", materialesNuevos: [{ codigoMTOP: "MAT-BARNIZ-MADERA", descripcion: "Barniz para madera", unidad: "l", precio: BARNIZ_MADERA_L }] },
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
