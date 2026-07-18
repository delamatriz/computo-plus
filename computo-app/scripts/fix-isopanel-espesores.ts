// Reemplazo de cubierta-008 (Cubierta de Isopanel genérico, sin espesor,
// precioUY=0) por 3 códigos con espesor real, reusando 3 PrecioMTOP que
// ya existían cargados con precio real pero sin ningún SubrubroEstandar
// que los usara (CUB001/002/003 — Panel autoestructural prefabricado
// multicapa, 50/150/250mm).
//
// MO: mismo criterio que ya usaba cubierta-008 (Oficial albañil + Peón,
// rendimiento 16 m2/jornada) para isopanel-001/002. Para isopanel-003
// (250mm, panel más grueso/pesado) se bajó el rendimiento a 13 m2/jornada
// — más lento de manipular y fijar, mismo criterio de ajuste que se usó
// en otros pares grosor/rendimiento de esta biblioteca (ej. estmet-001
// vs 002).
//
// Material "Tornillos autoperforantes para chapa" ya tiene PrecioMTOP
// real ($6/u) — se reusa igual en los 3, sin cambios.
//
// cubierta-008 se desactiva (activo: false, NO se borra — mismo patrón
// que 7.2.19/7.2.20 y el contrapiso duplicado 6.6.3).
//
// GG=15%/Util=10%, sin leyes sociales.
//
// Ejecutar (dry-run): npx tsx scripts/fix-isopanel-espesores.ts
// Ejecutar (real):     npx tsx scripts/fix-isopanel-espesores.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;
const NOMBRE_CAPITULO = "Cubierta / Techos";

const TORNILLOS = { descripcion: "Tornillos autoperforantes para chapa", unidad: "u", precioUnitario: 6, rendimiento: 6 };

type Def = { codigo: string; descripcion: string; materialDescripcion: string; materialPrecio: number; moRendimiento: number };
const CODIGOS: Def[] = [
  { codigo: "isopanel-001", descripcion: "Cubierta de Isopanel 50mm", materialDescripcion: "Panel autoestructural prefabricado, Tipo multicapa espesor 50 mm", materialPrecio: 1978.53, moRendimiento: 16 },
  { codigo: "isopanel-002", descripcion: "Cubierta de Isopanel 150mm", materialDescripcion: "Panel autoestructural prefabricado, Tipo multicapa espesor 150 mm", materialPrecio: 2418.13, moRendimiento: 16 },
  { codigo: "isopanel-003", descripcion: "Cubierta de Isopanel 250mm", materialDescripcion: "Panel autoestructural prefabricado, Tipo multicapa espesor 250 mm", materialPrecio: 2969.42, moRendimiento: 13 },
];

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);

  const capitulo = await db.capituloCatalogo.findUnique({ where: { nombre: NOMBRE_CAPITULO } });
  if (!capitulo) {
    console.error(`Falta CapituloCatalogo "${NOMBRE_CAPITULO}" — abortando.`);
    await db.$disconnect();
    process.exit(1);
  }

  // ── 1. Desactivar cubierta-008 ────────────────────────────────────────
  console.log("── Desactivar (activo: false, NO se borra) ──");
  const c008 = await db.subrubroEstandar.findUnique({ where: { codigo: "cubierta-008" } });
  if (c008) {
    console.log(`  cubierta-008 — "${c008.descripcion}" — activo: ${c008.activo} → false`);
    if (aplicar) {
      await db.subrubroEstandar.update({ where: { codigo: "cubierta-008" }, data: { activo: false } });
    }
  } else {
    console.log("  ⚠ cubierta-008 no encontrado");
  }

  // ── 2. Crear isopanel-001/002/003 ──────────────────────────────────────
  console.log("\n── SubrubroEstandar + APUEstandar nuevos ──");
  const categoriasLaborales = await db.categoriaLaboral.findMany();
  const jornalPorNombre = (nombre: string) =>
    categoriasLaborales.find((c) => c.nombre.trim().toLowerCase() === nombre.trim().toLowerCase())?.jornal ?? 0;
  const jornalOficialAlbanil = jornalPorNombre("Oficial albañil");
  const jornalPeon = jornalPorNombre("Peón");

  for (const def of CODIGOS) {
    const sumMat = 1.05 * def.materialPrecio + TORNILLOS.rendimiento * TORNILLOS.precioUnitario;
    const sumMO = jornalOficialAlbanil / def.moRendimiento + jornalPeon / def.moRendimiento;
    const costoDirecto = sumMat + sumMO;
    const precioUY = Math.round(costoDirecto * (1 + GG_PCT / 100) * (1 + UTIL_PCT / 100) * 100) / 100;

    const yaExiste = await db.subrubroEstandar.findUnique({ where: { codigo: def.codigo } });
    console.log(`\n  ${yaExiste ? "= actualiza" : "+ crea"} ${def.codigo} — ${def.descripcion} (M2) — $${precioUY}/M2`);
    console.log(`      material: ${def.materialDescripcion} — rendimiento 1.05 m2 — $${def.materialPrecio}/m2`);
    console.log(`      material: ${TORNILLOS.descripcion} — rendimiento ${TORNILLOS.rendimiento} u — $${TORNILLOS.precioUnitario}/u`);
    console.log(`      MO: Oficial albañil — rendimiento ${def.moRendimiento} M2/jornada — jornal $${jornalOficialAlbanil}`);
    console.log(`      MO: Peón — rendimiento ${def.moRendimiento} M2/jornada — jornal $${jornalPeon}`);
    console.log(`      sumMat=$${sumMat.toFixed(2)} sumMO=$${sumMO.toFixed(2)} costoDirecto=$${costoDirecto.toFixed(2)}`);

    if (!aplicar) continue;

    const subrubro = await db.subrubroEstandar.upsert({
      where: { codigo: def.codigo },
      create: { codigo: def.codigo, descripcion: def.descripcion, unidad: "M2", precioUY, fechaBase: FECHA, origen: "manual", capituloId: capitulo.id, subcapituloId: null },
      update: { descripcion: def.descripcion, unidad: "M2", precioUY, fechaBase: FECHA, capituloId: capitulo.id },
    });

    const apuExistente = await db.aPUEstandar.findUnique({ where: { subrubroId: subrubro.id } });
    const apu = apuExistente
      ? await db.aPUEstandar.update({ where: { subrubroId: subrubro.id }, data: {} })
      : await db.aPUEstandar.create({ data: { subrubroId: subrubro.id } });

    await db.materialAPUEstandar.deleteMany({ where: { apuId: apu.id } });
    await db.manoObraAPUEstandar.deleteMany({ where: { apuId: apu.id } });
    await db.materialAPUEstandar.create({ data: { apuId: apu.id, descripcion: def.materialDescripcion, unidad: "m2", rendimiento: 1.05 } });
    await db.materialAPUEstandar.create({ data: { apuId: apu.id, descripcion: TORNILLOS.descripcion, unidad: TORNILLOS.unidad, rendimiento: TORNILLOS.rendimiento } });
    await db.manoObraAPUEstandar.create({ data: { apuId: apu.id, categoria: "Oficial albañil", jornadaHs: 8, rendimiento: def.moRendimiento } });
    await db.manoObraAPUEstandar.create({ data: { apuId: apu.id, categoria: "Peón", jornadaHs: 8, rendimiento: def.moRendimiento } });
  }

  console.log("\n── Resumen ──");
  console.log(`Modo: ${aplicar ? "APLICADO A PRODUCCIÓN" : "DRY RUN (nada escrito)"}`);
  if (aplicar) {
    const total = await db.subrubroEstandar.count({ where: { capituloId: capitulo.id, activo: true } });
    console.log(`Total SubrubroEstandar activos en "${NOMBRE_CAPITULO}": ${total}`);
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
