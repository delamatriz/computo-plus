// Fase 2 del bug "clona a $0" — corrección de 3 casos de MATERIAL MAL
// ASIGNADO en Subcontratos - Carpinterías (no solo falta de precio, el
// material del código no coincide con lo que el código dice ser).
//
// 1. 7.3.14 (Puerta de chapa calibre 18 0.75x2.05m) — DESACTIVAR
//    (activo: false, no borrar). Es redundante exacto con carpmet-001
//    (mismo material 0.90x2.10m, mismos tornillos, misma MO idéntica).
//
// 2. 7.3.15 (Portón de garage dos hojas 2.40x2.10m, BATIENTE) — el
//    material apuntaba a "Portón metálico corredizo 3.00x2.10m"
//    (tipo Y tamaño distintos, con un rendimiento 0.9 que era un parche
//    para aproximar el costo). Se reemplaza por un material nuevo real
//    "Portón batiente dos hojas de hierro 2.40x2.10m" (rend=1, sin
//    parche). carpmet-004 NO es redundante (es el corredizo real, un
//    producto distinto) — no se toca.
//
// 3. 7.3.18 (Ventana corrediza ALUMINIO serie 25 1.20x1.10m) — el
//    material apuntaba a "Ventana metálica corrediza 1.20x1.10m"
//    (material equivocado: hierro/metálico genérico, no aluminio). Se
//    reemplaza por un material nuevo real "Ventana corrediza aluminio
//    serie 25 1.20x1.10m". carpmet-002 NO es redundante (es la ventana
//    de hierro genérica real, un producto distinto) — no se toca.
//
// Reusados sin cambios: "Tornillos y herrajes metálicos" ($450/gl, ya
// real) y "Silicona para ventanas" ($280/u, ya real).
//
// Precios de referencia:
//  - Portón batiente dos hojas de hierro 2.40x2.10m: ⚠️ ESTIMACIÓN
//    GRUESA — no se encontró cotización directa de plaza uruguaya con
//    esa medida exacta (son productos a medida, cotización directa con
//    herrero). $38.000/u.
//  - Ventana corrediza aluminio Serie 25 1.20x1.10m: confirmado que es
//    un producto real y estandarizado en el mercado uruguayo (PGU,
//    Waluminio, Aberturas Moscú, MgM Aberturas, Alumex — todos venden
//    esta línea específica), pero no se pudo extraer el precio exacto
//    de las páginas (contenido dinámico/no accesible por fetch). ⚠️
//    ESTIMACIÓN GRUESA anclada a la existencia confirmada del producto.
//    $12.500/u.
//
// Sin capa de leyes sociales, GG=15%/Util=10%.
//
// Ejecutar (dry-run): npx tsx scripts/fix-material-mal-asignado-carpinterias.ts
// Ejecutar (real):     npx tsx scripts/fix-material-mal-asignado-carpinterias.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;

const TORNILLOS_HERRAJES = { descripcion: "Tornillos y herrajes metálicos", unidad: "gl", precioUnitario: 450 };
const SILICONA_VENTANAS = { descripcion: "Silicona para ventanas", unidad: "u", precioUnitario: 280 };

const PRECIOS_NUEVOS = [
  { codigo: "MAT-PORTON-BATIENTE-2H-240210", descripcion: "Portón batiente dos hojas de hierro 2.40x2.10m", unidad: "u", precioUnitario: 38000 },
  { codigo: "MAT-VENTANA-ALUM-SERIE25-120110", descripcion: "Ventana corrediza aluminio serie 25 1.20x1.10m", unidad: "u", precioUnitario: 12500 },
] as const;

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);

  // ── 1. Desactivar 7.3.14 ──────────────────────────────────────────────
  console.log("── Desactivar (activo: false, NO se borra) ──");
  const c14 = await db.subrubroEstandar.findUnique({ where: { codigo: "7.3.14" } });
  if (c14) {
    console.log(`  7.3.14 — "${c14.descripcion}" — activo: ${c14.activo} → false (redundante exacto con carpmet-001)`);
    if (aplicar) await db.subrubroEstandar.update({ where: { codigo: "7.3.14" }, data: { activo: false } });
  } else {
    console.log("  ⚠ 7.3.14 no encontrado");
  }

  // ── 2. PrecioMTOP nuevos ───────────────────────────────────────────────
  console.log("\n── PrecioMTOP nuevos ──");
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

  const categoriasLaborales = await db.categoriaLaboral.findMany();
  const jornalPorNombre = (nombre: string) =>
    categoriasLaborales.find((c) => c.nombre.trim().toLowerCase() === nombre.trim().toLowerCase())?.jornal ?? 0;

  // ── 3. Corregir 7.3.15 ────────────────────────────────────────────────
  console.log("\n── Corrección de 7.3.15 (Portón de garage dos hojas 2.40x2.10m) ──");
  {
    const porton = PRECIOS_NUEVOS[0];
    const sumMat = 1 * porton.precioUnitario + 1 * TORNILLOS_HERRAJES.precioUnitario;
    const moRend = 0.5; // sin cambios — misma complejidad de instalación que el batiente original
    const sumMO = jornalPorNombre("Oficial especializado") / moRend + jornalPorNombre("Peón") / moRend;
    const costoDirecto = sumMat + sumMO;
    const precioUY = Math.round(costoDirecto * (1 + GG_PCT / 100) * (1 + UTIL_PCT / 100) * 100) / 100;

    console.log(`  material: ${porton.descripcion} — rendimiento 1 u — $${porton.precioUnitario}/u (antes: Portón corredizo 3.00x2.10m, rend 0.9 — parche eliminado)`);
    console.log(`  material: ${TORNILLOS_HERRAJES.descripcion} — rendimiento 1 gl — $${TORNILLOS_HERRAJES.precioUnitario}/gl (sin cambios)`);
    console.log(`  MO: Oficial especializado + Peón — rendimiento ${moRend} U/jornada c/u (sin cambios)`);
    console.log(`  sumMat=$${sumMat.toFixed(2)} sumMO=$${sumMO.toFixed(2)} costoDirecto=$${costoDirecto.toFixed(2)}`);
    console.log(`  precioUY actual: $51388.67 (con material equivocado) → NUEVO: $${precioUY}`);

    if (aplicar) {
      const s = await db.subrubroEstandar.update({
        where: { codigo: "7.3.15" },
        data: { precioUY, fechaBase: FECHA },
      });
      const apu = await db.aPUEstandar.findUnique({ where: { subrubroId: s.id } });
      if (apu) {
        await db.materialAPUEstandar.deleteMany({ where: { apuId: apu.id } });
        await db.materialAPUEstandar.create({ data: { apuId: apu.id, descripcion: porton.descripcion, unidad: porton.unidad, rendimiento: 1 } });
        await db.materialAPUEstandar.create({ data: { apuId: apu.id, descripcion: TORNILLOS_HERRAJES.descripcion, unidad: TORNILLOS_HERRAJES.unidad, rendimiento: 1 } });
      }
    }
  }

  // ── 4. Corregir 7.3.18 ────────────────────────────────────────────────
  console.log("\n── Corrección de 7.3.18 (Ventana corrediza aluminio serie 25 1.20x1.10m) ──");
  {
    const ventana = PRECIOS_NUEVOS[1];
    const sumMat = 1 * ventana.precioUnitario + 1 * SILICONA_VENTANAS.precioUnitario;
    const moRend = 1.2; // sin cambios
    const sumMO = jornalPorNombre("Oficial especializado") / moRend;
    const costoDirecto = sumMat + sumMO;
    const precioUY = Math.round(costoDirecto * (1 + GG_PCT / 100) * (1 + UTIL_PCT / 100) * 100) / 100;

    console.log(`  material: ${ventana.descripcion} — rendimiento 1 u — $${ventana.precioUnitario}/u (antes: Ventana metálica corrediza, material equivocado)`);
    console.log(`  material: ${SILICONA_VENTANAS.descripcion} — rendimiento 1 u — $${SILICONA_VENTANAS.precioUnitario}/u (sin cambios)`);
    console.log(`  MO: Oficial especializado — rendimiento ${moRend} U/jornada (sin cambios, sin Peón)`);
    console.log(`  sumMat=$${sumMat.toFixed(2)} sumMO=$${sumMO.toFixed(2)} costoDirecto=$${costoDirecto.toFixed(2)}`);
    console.log(`  precioUY actual: $9560.66 (con material equivocado) → NUEVO: $${precioUY}`);

    if (aplicar) {
      const s = await db.subrubroEstandar.update({
        where: { codigo: "7.3.18" },
        data: { precioUY, fechaBase: FECHA },
      });
      const apu = await db.aPUEstandar.findUnique({ where: { subrubroId: s.id } });
      if (apu) {
        await db.materialAPUEstandar.deleteMany({ where: { apuId: apu.id } });
        await db.materialAPUEstandar.create({ data: { apuId: apu.id, descripcion: ventana.descripcion, unidad: ventana.unidad, rendimiento: 1 } });
        await db.materialAPUEstandar.create({ data: { apuId: apu.id, descripcion: SILICONA_VENTANAS.descripcion, unidad: SILICONA_VENTANAS.unidad, rendimiento: 1 } });
      }
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
