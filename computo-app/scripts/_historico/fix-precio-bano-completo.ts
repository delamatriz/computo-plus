// Fase 1 de corrección del bug "clona a $0" — único código con impacto en
// proyecto real hoy: 7.2.1 (BAÑO COMPLETO), usado en HOGAR (Rubro R001,
// precioUnit=$37.524,96 tecleado a mano sobre un APU de biblioteca roto).
//
// Este script SOLO agrega los 6 PrecioMTOP que faltan (para que el APU de
// biblioteca de 7.2.1 no clone a $0) y recalcula su precioUY. NO toca el
// Rubro real de HOGAR — el precio tecleado a mano queda intacto.
//
// Efecto cascada esperado (positivo, no se toca ningún otro
// SubrubroEstandar/APUEstandar, solo se comparte el PrecioMTOP vía el
// mismo lookup por descripción que ya usa clonar-apu): 7.2.2 (Cocina
// completa), sanitaria-002/003 (termofusión agua fría/caliente),
// sanitaria-006/007 (desagüe PVC 110mm/50mm) usan los mismos nombres de
// material y quedan resueltos también.
//
// Fuentes de precio:
//  - Caño PVC desagüe 110mm: Uruguay, retailers (Barraca Carmela,
//    Tigre/Barraca Dayman) — rango real observado $300-427/ml para
//    caño aprobado UNIT 206, se usó $350/ml.
//  - Caño PVC desagüe 50mm: sin cotización directa encontrada —
//    ESTIMACIÓN GRUESA, escalado proporcional desde 110mm ($120/ml).
//  - Caño termofusión 20mm agua fría/caliente: MISMO producto físico
//    (PPR termofusionable Ø1/2", apto agua fría Y caliente) — ya existe
//    en la Lista MTOP como SA001 ($968.03 por barra de 6m = $161,34/ml).
//    Se reusa ese valor real para ambos usos (fría/caliente), en 2 filas
//    de PrecioMTOP separadas (los nombres de material no comparten
//    substring único para un solo registro).
//  - Accesorios termofusión: ESTIMACIÓN GRUESA por analogía con
//    "Accesorios PVC sanitario" (MAT-ACC-PVC-SAN, $850/gl, ya cargado)
//    — ajustado al alza (piezas termofusionables más caras por unidad).
//  - Sellador sanitario: ESTIMACIÓN GRUESA, sin cotización Uruguay
//    específica encontrada.
//
// GG=15%/Util=10%, sin leyes sociales — misma fórmula de siempre.
//
// Ejecutar (dry-run): npx tsx scripts/fix-precio-bano-completo.ts
// Ejecutar (real):     npx tsx scripts/fix-precio-bano-completo.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;

const PRECIOS_NUEVOS = [
  { codigo: "MAT-SANITARIA-PVC-DESAGUE-110", descripcion: "Caño PVC desagüe 110mm", unidad: "ml", precioUnitario: 350 },
  { codigo: "MAT-SANITARIA-PVC-DESAGUE-50", descripcion: "Caño PVC desagüe 50mm", unidad: "ml", precioUnitario: 120 },
  { codigo: "MAT-SANITARIA-TERMOFUSION-FRIA", descripcion: "Caño termofusión 20mm agua fría", unidad: "ml", precioUnitario: 161.34 },
  { codigo: "MAT-SANITARIA-TERMOFUSION-CALIENTE", descripcion: "Caño termofusión 20mm agua caliente", unidad: "ml", precioUnitario: 161.34 },
  { codigo: "MAT-SANITARIA-ACCESORIOS-TERMOFUSION", descripcion: "Accesorios termofusión", unidad: "gl", precioUnitario: 1100 },
  { codigo: "MAT-SANITARIA-SELLADOR", descripcion: "Sellador sanitario", unidad: "gl", precioUnitario: 450 },
] as const;

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);

  console.log("── PrecioMTOP nuevos (6) ──");
  for (const p of PRECIOS_NUEVOS) {
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

  // ── Recalcular precioUY de 7.2.1 con el mismo APU (rendimientos intactos) ──
  console.log("\n── Recalculo de 7.2.1 (BAÑO COMPLETO) ──");
  const s = await db.subrubroEstandar.findUnique({
    where: { codigo: "7.2.1" },
    include: { apuEstandar: { include: { materiales: true, manoObra: true } } },
  });
  if (!s || !s.apuEstandar) {
    console.error("No se encontró 7.2.1 o su APUEstandar — abortando.");
    await db.$disconnect();
    process.exit(1);
  }

  const precioPorCodigo = new Map<string, number>(PRECIOS_NUEVOS.map((p) => [p.descripcion, p.precioUnitario]));
  const precioAccesoriosPVC = 850; // MAT-ACC-PVC-SAN, ya existente, no se toca

  const categoriasLaborales = await db.categoriaLaboral.findMany();
  const jornalPorNombre = (nombre: string) =>
    categoriasLaborales.find((c) => c.nombre.trim().toLowerCase() === nombre.trim().toLowerCase())?.jornal ?? 0;

  let sumMat = 0;
  for (const m of s.apuEstandar.materiales) {
    const precio = precioPorCodigo.get(m.descripcion) ?? (m.descripcion === "Accesorios PVC sanitario" ? precioAccesoriosPVC : null);
    if (precio === null) {
      console.warn(`  ⚠ material "${m.descripcion}" no tiene precio definido en este script`);
      continue;
    }
    const aporte = m.rendimiento * precio;
    sumMat += aporte;
    console.log(`  material: ${m.descripcion} — rendimiento ${m.rendimiento} ${m.unidad} × $${precio} = $${aporte.toFixed(2)}`);
  }
  let sumMO = 0;
  for (const mo of s.apuEstandar.manoObra) {
    const jornal = jornalPorNombre(mo.categoria);
    const aporte = jornal / mo.rendimiento;
    sumMO += aporte;
    console.log(`  MO: ${mo.categoria} — rendimiento ${mo.rendimiento} GL/jornada — jornal $${jornal} = $${aporte.toFixed(2)}`);
  }

  const costoDirecto = sumMat + sumMO;
  const precioUYNuevo = Math.round(costoDirecto * (1 + GG_PCT / 100) * (1 + UTIL_PCT / 100) * 100) / 100;

  console.log(`\nsumMat: $${sumMat.toFixed(2)}`);
  console.log(`sumMO: $${sumMO.toFixed(2)}`);
  console.log(`costoDirecto: $${costoDirecto.toFixed(2)}`);
  console.log(`precioUY actual (biblioteca, roto): $${s.precioUY}`);
  console.log(`precioUY NUEVO (corregido): $${precioUYNuevo}`);
  console.log(`\nComparación con el Rubro real de HOGAR (tecleado a mano, NO se toca): $37,524.96`);
  const diffPct = ((precioUYNuevo - 37524.96) / 37524.96) * 100;
  console.log(`Diferencia: ${diffPct.toFixed(1)}%`);

  if (aplicar) {
    await db.subrubroEstandar.update({ where: { codigo: "7.2.1" }, data: { precioUY: precioUYNuevo, fechaBase: FECHA } });
    console.log("\n✓ SubrubroEstandar 7.2.1 actualizado (precioUY + fechaBase). Rubro real de HOGAR NO tocado.");
  }

  console.log("\n── Resumen ──");
  console.log(`Modo: ${aplicar ? "APLICADO A PRODUCCIÓN" : "DRY RUN (nada escrito)"}`);

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
