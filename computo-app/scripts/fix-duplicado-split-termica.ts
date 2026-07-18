// Resuelve la duplicación de splits en Instalación Térmica / Aire
// Acondicionado: 7.2.19/7.2.20 (import SAU original, huérfanos sin
// equivalente 18000/24000 BTU) se DESACTIVAN (activo: false, no se
// borran — mismo criterio que el duplicado de contrapiso 6.6.3).
// termica-001 a 004 quedan como fuente de verdad, con su precio de
// biblioteca corregido (mismo bug "clona a $0" de toda la auditoría).
//
// Reuso confirmado: "Caño cobre 1/4 y 3/8" (MAT-CANO-COBRE, $380/ml) y
// "Soporte mural exterior" (MAT-SOPORTE-MURAL, $420/u) YA tienen
// PrecioMTOP real — no se tocan. Solo faltaba el equipo split en sí (las
// 4 potencias) y "Soporte mural exterior reforzado" (termica-003/004,
// nombre distinto al soporte normal, no matchea por contains).
//
// Precios de referencia — mercado uruguayo (MercadoLibre, Sodimac, Aiwa,
// LOi, Tienda Inglesa), rango medio de plaza, no el más barato ni el más
// caro:
//  - 9000 BTU: rango observado ~$14.990 a equivalente USD 594-640 según
//    marca — se usó $19.000/u (gama media).
//  - 12000 BTU: rango observado $12.490-16.990 o USD 299-700 — se usó
//    $22.500/u.
//  - 18000/24000 BTU: menos cotizaciones directas en pesos encontradas —
//    ESTIMACIÓN MÁS GRUESA, escalada proporcionalmente ($32.000 y
//    $42.000/u).
//  - Soporte mural exterior reforzado: estimación por analogía con el
//    soporte normal ($420/u), ajustado al alza para equipos más pesados.
//
// GG=15%/Util=10%, sin leyes sociales — misma fórmula de siempre.
//
// Ejecutar (dry-run): npx tsx scripts/fix-duplicado-split-termica.ts
// Ejecutar (real):     npx tsx scripts/fix-duplicado-split-termica.ts --apply [--incluir-003-004]

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;

const PRECIOS_NUEVOS = [
  { codigo: "MAT-TERMICA-SPLIT-9000", descripcion: "Equipo split 9000 BTU inverter", unidad: "u", precioUnitario: 19000 },
  { codigo: "MAT-TERMICA-SPLIT-12000", descripcion: "Equipo split 12000 BTU inverter", unidad: "u", precioUnitario: 22500 },
  { codigo: "MAT-TERMICA-SPLIT-18000", descripcion: "Equipo split 18000 BTU inverter", unidad: "u", precioUnitario: 32000 },
  { codigo: "MAT-TERMICA-SPLIT-24000", descripcion: "Equipo split 24000 BTU inverter", unidad: "u", precioUnitario: 42000 },
  { codigo: "MAT-TERMICA-SOPORTE-REFORZADO", descripcion: "Soporte mural exterior reforzado", unidad: "u", precioUnitario: 650 },
] as const;

// Materiales ya existentes, reusados (NO se crean de nuevo)
const CANO_COBRE = { descripcion: "Caño cobre 1/4 y 3/8", precioUnitario: 380 };
const SOPORTE_NORMAL = { descripcion: "Soporte mural exterior", precioUnitario: 420 };

const CODIGOS_A_DESACTIVAR = ["7.2.19", "7.2.20"];

type Def = { codigo: string; splitPrecio: number; sopotePrecio: number; canoRend: number; sopoRend: number; moRend: number };
const TODOS: Def[] = [
  { codigo: "termica-001", splitPrecio: 19000, sopotePrecio: SOPORTE_NORMAL.precioUnitario, canoRend: 3, sopoRend: 1, moRend: 2 },
  { codigo: "termica-002", splitPrecio: 22500, sopotePrecio: SOPORTE_NORMAL.precioUnitario, canoRend: 3, sopoRend: 1, moRend: 2 },
  { codigo: "termica-003", splitPrecio: 32000, sopotePrecio: 650, canoRend: 4, sopoRend: 1, moRend: 1.5 },
  { codigo: "termica-004", splitPrecio: 42000, sopotePrecio: 650, canoRend: 4, sopoRend: 1, moRend: 1.2 },
];

async function main() {
  const aplicar = process.argv.includes("--apply");
  const incluir003004 = process.argv.includes("--incluir-003-004");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}`);
  console.log(`Incluir termica-003/004 en esta corrida: ${incluir003004 ? "SÍ" : "NO (solo 001/002)"}\n`);

  // ── 1. Desactivar 7.2.19 / 7.2.20 ─────────────────────────────────────
  console.log("── Desactivar (activo: false, NO se borra) ──");
  for (const codigo of CODIGOS_A_DESACTIVAR) {
    const s = await db.subrubroEstandar.findUnique({ where: { codigo } });
    if (!s) {
      console.log(`  ⚠ ${codigo} no encontrado`);
      continue;
    }
    console.log(`  ${codigo} — "${s.descripcion}" — activo: ${s.activo} → false`);
    if (aplicar) {
      await db.subrubroEstandar.update({ where: { codigo }, data: { activo: false } });
    }
  }

  // ── 2. PrecioMTOP nuevos ───────────────────────────────────────────────
  console.log("\n── PrecioMTOP nuevos ──");
  for (const p of PRECIOS_NUEVOS) {
    const seCrea = incluir003004 || (p.codigo === "MAT-TERMICA-SPLIT-9000" || p.codigo === "MAT-TERMICA-SPLIT-12000");
    if (!seCrea) {
      console.log(`  (omitido en esta corrida — pertenece a termica-003/004) — ${p.codigo}`);
      continue;
    }
    const existente = await db.precioMTOP.findUnique({ where: { codigo: p.codigo } });
    console.log(`  ${existente ? "= ya existe" : "+ nuevo"} — ${p.codigo} — ${p.descripcion} ($${p.precioUnitario}/${p.unidad})`);
    if (aplicar) {
      await db.precioMTOP.upsert({
        where: { codigo: p.codigo },
        create: {
          codigo: p.codigo,
          descripcion: p.descripcion,
          cantidadUnidad: `1 ${p.unidad}`,
          unidad: p.unidad,
          cantidad: 1,
          precioConIva: p.precioUnitario,
          precioUnitario: p.precioUnitario,
          numeroLista: 0,
          fechaLista: FECHA,
        },
        update: { precioUnitario: p.precioUnitario, precioConIva: p.precioUnitario },
      });
    }
  }

  // ── 3. Recalcular precioUY de termica-00X ────────────────────────────
  console.log("\n── Recalculo de termica-00X ──");
  const categoriasLaborales = await db.categoriaLaboral.findMany();
  const jornalPorNombre = (nombre: string) =>
    categoriasLaborales.find((c) => c.nombre.trim().toLowerCase() === nombre.trim().toLowerCase())?.jornal ?? 0;
  const jornalOficialEspecializado = jornalPorNombre("Oficial especializado");
  const jornalPeon = jornalPorNombre("Peón");

  const aCorregir = incluir003004 ? TODOS : TODOS.slice(0, 2);
  for (const def of aCorregir) {
    const sumMat = 1 * def.splitPrecio + def.canoRend * CANO_COBRE.precioUnitario + def.sopoRend * def.sopotePrecio;
    const sumMO = jornalOficialEspecializado / def.moRend + jornalPeon / def.moRend;
    const costoDirecto = sumMat + sumMO;
    const precioUY = Math.round(costoDirecto * (1 + GG_PCT / 100) * (1 + UTIL_PCT / 100) * 100) / 100;

    console.log(`\n  ${def.codigo}:`);
    console.log(`    material: Equipo split — rendimiento 1 u — $${def.splitPrecio}/u`);
    console.log(`    material: Caño cobre 1/4 y 3/8 — rendimiento ${def.canoRend} ml — $${CANO_COBRE.precioUnitario}/ml`);
    console.log(`    material: Soporte mural — rendimiento ${def.sopoRend} u — $${def.sopotePrecio}/u`);
    console.log(`    MO: Oficial especializado + Peón — rendimiento ${def.moRend} U/jornada c/u`);
    console.log(`    sumMat=$${sumMat.toFixed(2)} sumMO=$${sumMO.toFixed(2)} costoDirecto=$${costoDirecto.toFixed(2)}`);
    console.log(`    precioUY NUEVO: $${precioUY}`);

    if (aplicar) {
      await db.subrubroEstandar.update({ where: { codigo: def.codigo }, data: { precioUY, fechaBase: FECHA } });
    }
  }

  console.log("\n── Resumen ──");
  console.log(`Modo: ${aplicar ? "APLICADO A PRODUCCIÓN" : "DRY RUN (nada escrito)"}`);

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
