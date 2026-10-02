// Reemplaza el APU del rubro "Colocación y amure de aberturas" (código
// interno R006, proyecto HOGAR) del método tradicional (mortero + alambre
// + bulones, rendimientos de MO pensados por unidad completa de abertura
// pero aplicados por ML) por el método POLIURETANO EXPANSIVO, confirmado
// por Luis como el que se usa hoy en la práctica — variable según
// empresa/obra, este proyecto puntual usa poliuretano.
//
// Rendimientos (por ML de perímetro de abertura, estimación cruzada con
// ficha de fabricante — ajustables si la experiencia de campo de Luis da
// otro número):
//   Materiales:
//     - Espuma de poliuretano en aerosol: 0,033 u/ML (1 lata ~30 ML)
//     - Tarugo plástico 6mm c/tornillo:    2     u/ML
//     - Sellador acrílico en cartucho 300ml: 0,1 u/ML
//   Mano de obra (0,3 horas/ML cada uno → 8/0,3 = 26,6667 ML/jornada):
//     - Oficial albañil
//     - Ayudante
//
// Precios de referencia: Tarugo y Sellador reusan el precio ya vigente en
// otros materiales reales de este mismo sistema (mismo formato/unidad).
// La Espuma de poliuretano en aerosol NO tiene precio de referencia en
// ningún lado del sistema (no está en Lista MTOP N°599 — producto post-
// MTOP 2006) — queda en $0, a completar/estimar en la UI (mismo patrón
// que cualquier material sin precio).
//
// Solo toca el rubro R006 de HOGAR — no toca APUEstandar ni ningún otro
// proyecto/rubro. Esto es un cambio puntual de un solo rubro, no un seed
// de biblioteca — no hay upsert idempotente clásico, pero el script
// verifica el estado antes de tocar nada y no vuelve a aplicar si ya
// está en el método poliuretano.
//
// Ejecutar: npx tsx scripts/fix-rubro-r006-hogar-poliuretano.ts

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { sumEquipos, sumManoObra } from "../src/lib/apu-calc";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

const NUEVOS_MATERIALES = [
  { descripcion: "Espuma de poliuretano en aerosol", unidad: "u", rendimiento: 0.033, precioUnit: 0 },
  { descripcion: "Tarugo plástico 6mm c/tornillo", unidad: "u", rendimiento: 2, precioUnit: 8.5 },
  { descripcion: "Sellador acrílico en cartucho 300ml", unidad: "u", rendimiento: 0.1, precioUnit: 420 },
];

async function main() {
  const rubro = await p.rubro.findFirst({
    where: {
      descripcion: { contains: "Colocación y amure de aberturas", mode: "insensitive" },
      capitulo: { proyecto: { nombre: { contains: "HOGAR", mode: "insensitive" } } },
    },
    include: {
      apu: { include: { materiales: true, manoObra: true, equipos: true } },
    },
  });

  if (!rubro?.apu) {
    console.error("✗ No se encontró el rubro o su APU");
    process.exit(1);
  }

  const yaMigrado = rubro.apu.materiales.some((m) => m.descripcion === "Espuma de poliuretano en aerosol");
  if (yaMigrado) {
    console.log("= El rubro ya está en el método poliuretano — nada que hacer");
    await p.$disconnect();
    return;
  }

  // ── ANTES ──
  const sumMatAntes = rubro.apu.materiales.reduce((s, m) => s + m.rendimiento * m.precioUnit, 0);
  const sumMOAntes = sumManoObra(rubro.apu.manoObra, rubro.apu.equipos);
  const sumEqAntes = sumEquipos(rubro.apu.equipos);
  const costoDirectoAntes = sumMatAntes + sumMOAntes + sumEqAntes;
  const precioFinalAntes = costoDirectoAntes * (1 + rubro.apu.gastosGeneralesPct / 100) * (1 + rubro.apu.utilidadPct / 100);

  console.log("=== ANTES (método tradicional) ===");
  for (const m of rubro.apu.materiales) console.log(`  ${m.descripcion}: ${m.rendimiento} ${m.unidad} x $${m.precioUnit} = $${(m.rendimiento * m.precioUnit).toFixed(2)}`);
  for (const mo of rubro.apu.manoObra) console.log(`  MO ${mo.categoria}: rendimiento ${mo.rendimiento}, jornalRef $${mo.jornalRef}`);
  console.log(`  Costo Directo: $${costoDirectoAntes.toFixed(2)}`);
  console.log(`  Precio Final (por ML): $${precioFinalAntes.toFixed(2)}`);
  console.log(`  Rubro.precioUnit guardado (antes): $${rubro.precioUnit}`);
  console.log(`  Cantidad: ${rubro.cantidad} ${rubro.unidad}`);
  console.log(`  Total rubro guardado (antes): $${((rubro.precioUnit ?? 0) * (rubro.cantidad ?? 0)).toFixed(2)}`);

  // ── Categorías laborales vigentes (jornalRef) ──
  const categorias = await p.categoriaLaboral.findMany();
  const jornalPorNombre = (nombre: string) =>
    categorias.find((c) => c.nombre.trim().toLowerCase() === nombre.trim().toLowerCase())?.jornal ?? 0;

  const RENDIMIENTO_MO = 8 / 0.3; // 26.6667 ML por jornada de 8hs (0,3 horas/ML)
  const NUEVA_MANO_OBRA = [
    { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: RENDIMIENTO_MO },
    { categoria: "Ayudante", jornadaHs: 8, rendimiento: RENDIMIENTO_MO },
  ];

  const apuId = rubro.apu.id;

  // Reemplazar materiales
  await p.materialAPU.deleteMany({ where: { apuId } });
  for (let i = 0; i < NUEVOS_MATERIALES.length; i++) {
    const m = NUEVOS_MATERIALES[i];
    await p.materialAPU.create({
      data: { apuId, descripcion: m.descripcion, unidad: m.unidad, rendimiento: m.rendimiento, precioUnit: m.precioUnit, orden: i },
    });
  }

  // Reemplazar mano de obra (sin equipos vinculados en este rubro)
  await p.manoObraAPU.deleteMany({ where: { apuId } });
  for (let i = 0; i < NUEVA_MANO_OBRA.length; i++) {
    const mo = NUEVA_MANO_OBRA[i];
    await p.manoObraAPU.create({
      data: {
        apuId,
        categoria: mo.categoria,
        jornadaHs: mo.jornadaHs,
        rendimiento: mo.rendimiento,
        jornalRef: jornalPorNombre(mo.categoria),
        orden: i,
      },
    });
  }

  // ── DESPUÉS — releer y recalcular, aplicar al rubro ──
  const apuActualizado = await p.aPU.findUnique({
    where: { id: apuId },
    include: { materiales: true, manoObra: true, equipos: true },
  });

  const sumMatDespues = apuActualizado!.materiales.reduce((s, m) => s + m.rendimiento * m.precioUnit, 0);
  const sumMODespues = sumManoObra(apuActualizado!.manoObra, apuActualizado!.equipos);
  const sumEqDespues = sumEquipos(apuActualizado!.equipos);
  const costoDirectoDespues = sumMatDespues + sumMODespues + sumEqDespues;
  const precioFinalDespues = costoDirectoDespues * (1 + apuActualizado!.gastosGeneralesPct / 100) * (1 + apuActualizado!.utilidadPct / 100);
  const precioRedondeado = Math.round(precioFinalDespues * 100) / 100;

  const rubroActualizado = await p.rubro.update({
    where: { id: rubro.id },
    data: { precioUnit: precioRedondeado },
  });

  console.log("\n=== DESPUÉS (método poliuretano) ===");
  for (const m of apuActualizado!.materiales) console.log(`  ${m.descripcion}: ${m.rendimiento} ${m.unidad} x $${m.precioUnit} = $${(m.rendimiento * m.precioUnit).toFixed(2)}`);
  for (const mo of apuActualizado!.manoObra) console.log(`  MO ${mo.categoria}: rendimiento ${mo.rendimiento.toFixed(4)}, jornalRef $${mo.jornalRef}`);
  console.log(`  Costo Directo: $${costoDirectoDespues.toFixed(2)}`);
  console.log(`  Precio Final (por ML): $${precioFinalDespues.toFixed(2)}`);
  console.log(`  Rubro.precioUnit guardado (después): $${rubroActualizado.precioUnit}`);
  console.log(`  Cantidad: ${rubroActualizado.cantidad} ${rubroActualizado.unidad}`);
  console.log(`  Total rubro (después): $${((rubroActualizado.precioUnit ?? 0) * (rubroActualizado.cantidad ?? 0)).toFixed(2)}`);

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
