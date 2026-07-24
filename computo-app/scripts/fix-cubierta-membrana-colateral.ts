// Fase 2 del bug "clona a $0" — fix puntual aislado, fuera del
// capítulo actual: cubierta-009 (Membrana asfáltica sobre losa,
// capítulo Cubiertas).
//
// Hallazgo: al verificar los bonus colaterales de la sub-tanda 8a de
// Impermeabilizaciones (Membrana asfáltica con geotextil), se detectó
// que cubierta-009 quedó con precioUY=$0 (fechaBase 2025-06) sin
// aplicar el recálculo, a diferencia de ascensor-001 que sí se había
// corregido en su momento. Sus insumos ya resuelven correctamente vía
// PrecioMTOP (Membrana asfáltica con geotextil $535,90/m², Imprimación
// asfáltica $145/l, ambos de sub-tandas previas) — no requiere
// investigación de precio nueva, solo aplicar el mismo patrón
// "recalcular y guardar" ya usado en Albañilería y Sanitaria.
//
// Sin cambios de mano de obra ni de rendimientos. GG 15% / Utilidad
// 10%, sin leyes sociales.
//
// Ejecutar (dry-run): npx tsx scripts/fix-cubierta-membrana-colateral.ts
// Ejecutar (real):     npx tsx scripts/fix-cubierta-membrana-colateral.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;

const CODIGOS = ["cubierta-009"];

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

  for (const codigo of CODIGOS) {
    const s = await db.subrubroEstandar.findFirst({
      where: { codigo },
      include: { apuEstandar: { include: { materiales: true, manoObra: true, equipos: true } } },
    });
    if (!s || !s.apuEstandar) {
      console.error(`${codigo}: no encontrado — abortando.`);
      continue;
    }

    console.log(`\n${codigo} — ${s.descripcion}`);
    let sumMat = 0;

    for (const m of s.apuEstandar.materiales) {
      const precio = resolverPrecioExistente(m.descripcion);
      console.log(`  material: ${m.descripcion} — $${precio}/${m.unidad} (ya real, sin cambios) × rend ${m.rendimiento}`);
      sumMat += m.rendimiento * precio;
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
      await db.subrubroEstandar.update({ where: { codigo }, data: { precioUY, fechaBase: FECHA } });
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
