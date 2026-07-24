// Fase 2 del bug "clona a $0" — Construcción en seco, sub-tanda 7d
// (última del frente): Cielorraso PVC + Lana de roca (2 códigos, sin
// apalancamiento entre sí).
//
// Confirmado ANTES de investigar (mismo chequeo de duplicados que en
// 7a/7c): los 4 insumos tenían 0 filas PrecioMTOP preexistentes —
// genuinamente parte del bug, sin colisión. Ojo particular con
// "Tornillos y tacos" (insumo genérico, riesgo de repetirse en otros
// capítulos ya resueltos) — confirmado 0 matches, no tocado en
// Carpinterías/Albañilería.
//
// Sin material mal asignado, sin equipos en ningún APU. Ninguno usado
// en Rubro real de HOGAR/Matisse Monet. 7.6.4 tenía un precioUY
// guardado no-cero ($923,40, heredado del import 2022) pese a que el
// material "Lana de roca aislante" resolvía a $0 — mismo patrón
// "clona a $0" de siempre (precio de biblioteca desactualizado vs.
// clonado real).
//
// Fuentes de precio (USD convertido a $40,85/USD, BROU venta) — gama
// media/estándar:
//  - Panel cielorraso PVC: Sodimac Uruguay, Barbieri, pack x10
//    (20cm x 120cm x 13mm c/u, 2,40 m² total), $269 → $112,08/m²
//    real. ⚠️ figuraba "no disponible" en el catálogo — precio de
//    mercado válido igual, mismo criterio que con el perfil de steel
//    framing de 7b.
//  - Perfil omega PVC: Sodimac Uruguay, Barbieri, tira omega 12,5mm x
//    2,60m, $129 → $49,62/ml real. Nota importante: el producto es de
//    ALUMINIO, no plástico PVC — se investigó específicamente y
//    varias fuentes uruguayas confirman que el "perfil omega para
//    cielorraso PVC" es, en la práctica, una estructura de soporte
//    metálica/galvanizada o de aluminio (el PVC es el panel, no el
//    perfil de soporte) — "PVC" en el nombre del material refiere al
//    sistema que soporta, no a su composición. No se encontró un
//    perfil omega de plástico PVC propiamente dicho con precio en
//    Uruguay.
//  - Tornillos y tacos: Sodimac Uruguay, Fischer PO 25 (tacos GKA +
//    tornillos TMF 4x25), caja x25u, $299 → $11,96/u real.
//  - Lana de roca aislante: Group Soluciones (Uruguay), caja de 9
//    paneles (40x120x5cm, densidad 40kg/m³) = 4,32 m², $578 →
//    $133,80/m² real — muy cercano a la Lana de vidrio ya usada en
//    7a/7b ($138,84/m²), coherente entre aislantes de gama similar.
//    Se descartó Prodeco (mismo tipo de producto, pero $541,67/m² —
//    un outlier ~4x más caro, probablemente un envase chico con
//    sobreprecio minorista, no representativo de gama estándar).
//
// Sin cambios de mano de obra ni de rendimientos. GG 15% / Utilidad
// 10%, sin leyes sociales.
//
// Ejecutar (dry-run): npx tsx scripts/fix-yeso-pvc-lanaroca.ts
// Ejecutar (real):     npx tsx scripts/fix-yeso-pvc-lanaroca.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;
const USD_UYU = 40.85;

const PANEL_PVC_M2 = 269 / 2.4;
const PERFIL_OMEGA_ML = 129 / 2.6;
const TORNILLOS_TACOS_U = 299 / 25;
const LANA_ROCA_M2 = 578 / 4.32;

type MaterialNuevo = { codigoMTOP: string; descripcion: string; unidad: string; precio: number };
type Def = { codigo: string; materialesNuevos: MaterialNuevo[] };

const DEFS: Def[] = [
  {
    codigo: "yeso-004",
    materialesNuevos: [
      { codigoMTOP: "MAT-PANEL-CIELORRASO-PVC", descripcion: "Panel cielorraso PVC", unidad: "m2", precio: PANEL_PVC_M2 },
      { codigoMTOP: "MAT-PERFIL-OMEGA-PVC", descripcion: "Perfil omega PVC", unidad: "ml", precio: PERFIL_OMEGA_ML },
      { codigoMTOP: "MAT-TORNILLOS-TACOS", descripcion: "Tornillos y tacos", unidad: "u", precio: TORNILLOS_TACOS_U },
    ],
  },
  {
    codigo: "7.6.4",
    materialesNuevos: [{ codigoMTOP: "MAT-LANA-ROCA", descripcion: "Lana de roca aislante", unidad: "m2", precio: LANA_ROCA_M2 }],
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
