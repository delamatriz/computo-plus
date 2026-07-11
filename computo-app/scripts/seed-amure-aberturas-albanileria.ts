// Agrega a la biblioteca estándar de Albañilería dos códigos nuevos de
// "Colocación y amure de aberturas", medidos por ML (perímetro de la
// abertura — más preciso que M2 para tamaños variables, sobre todo en
// aluminio), con dos métodos como códigos independientes (mismo patrón
// que elegir entre subrubros típicos — sin tocar schema):
//   6.7.1 — Tradicional (mortero + alambre + bulones)
//   6.7.2 — Poliuretano expandido (mismos datos ya verificados en el
//           rubro R006 del proyecto HOGAR)
//
// Esto CONVIVE con los 3 códigos existentes de "amure" en Subcontratos -
// Carpinterías (7.3.5 madera, 7.3.17 hierro, 7.3.24 aluminio, medidos por
// M2, por tipo de material de abertura) — esos NO se tocan, son familia
// aparte con su propio criterio de uso.
//
// También agrega a PrecioMTOP los insumos de referencia que no estaban
// (Bulones ya existe en la Lista N°599, código 250 — no se toca). Los
// nuevos van con codigo "MAT-*" y numeroLista 0, mismo patrón ya usado
// para insumos fuera de la lista oficial (ver MAT-HIERRO-ARM,
// MAT-SILICONA-VEN, etc.). La Espuma de poliuretano en aerosol NO tiene
// precio de referencia en ningún lado del sistema — se deja sin precio
// a propósito (no inventar), igual que ya está en R006.
//
// Por último, re-vincula el rubro real "Colocación y amure de aberturas"
// (R006, proyecto HOGAR) al nuevo código 6.7.2 — reclona su APU desde el
// APUEstandar recién creado (misma lógica que POST clonar-apu) y aplica
// el recálculo al rubro. El resultado numérico no debe cambiar: ya tenía
// cargados a mano los mismos datos de Poliuretano.
//
// Idempotente vía upsert — correr las veces que haga falta.
//
// Ejecutar: npx tsx scripts/seed-amure-aberturas-albanileria.ts

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { sumEquipos, sumManoObra } from "../src/lib/apu-calc";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

const FECHA_LISTA = "2026-07";

// ── 1 — Precios de referencia faltantes (fuera de Lista MTOP N°599) ──
const PRECIOS_MTOP_NUEVOS = [
  { codigo: "MAT-MORTERO-AMURE", descripcion: "Mortero común (cemento + arena) para amure", unidad: "kg", precioUnitario: 18.5 },
  { codigo: "MAT-ALAMBRE-GALV", descripcion: "Alambre galvanizado Nro. 16/14 para fijación", unidad: "kg", precioUnitario: 1059.66 },
  { codigo: "MAT-CUNA-NIVEL", descripcion: "Cuñas plásticas/madera para nivelación", unidad: "gl", precioUnitario: 85.0 },
  { codigo: "MAT-SELLADOR-PERIM", descripcion: "Sellador/Silicona para juntas perimetrales", unidad: "gl", precioUnitario: 320.0 },
  { codigo: "MAT-TARUGO-TORNILLO", descripcion: "Tarugo plástico 6mm c/tornillo", unidad: "u", precioUnitario: 8.5 },
  { codigo: "MAT-SELLADOR-CART", descripcion: "Sellador acrílico en cartucho 300ml", unidad: "u", precioUnitario: 420.0 },
  // Espuma de poliuretano en aerosol: sin precio de referencia a propósito — no está en ningún lado del sistema.
];

// ── 2 — Los dos códigos de biblioteca ──
type MaterialDef = { descripcion: string; unidad: string; rendimiento: number };
type ManoObraDef = { categoria: string; jornadaHs: number; rendimiento: number };

const RENDIMIENTO_MO_TRADICIONAL = 8 / 0.4; // 20 ML/jornada (0,4 h/ML)
const RENDIMIENTO_MO_POLIURETANO = 8 / 0.3; // 26,6667 ML/jornada (0,3 h/ML)

const CODIGOS: {
  codigo: string;
  descripcion: string;
  materiales: MaterialDef[];
  manoObra: ManoObraDef[];
}[] = [
  {
    codigo: "6.7.1",
    descripcion: "COLOCACIÓN Y AMURE DE ABERTURAS — TRADICIONAL",
    materiales: [
      { descripcion: "Mortero común (cemento + arena) para amure", unidad: "kg", rendimiento: 0.7778 },
      { descripcion: "Alambre galvanizado Nro. 16/14 para fijación", unidad: "kg", rendimiento: 0.0333 },
      { descripcion: "Bulones Hierro c/exag. 3/8 x 1 1/2", unidad: "u", rendimiento: 0.8889 },
      { descripcion: "Cuñas plásticas/madera para nivelación", unidad: "gl", rendimiento: 0.2222 },
      { descripcion: "Sellador/Silicona para juntas perimetrales", unidad: "gl", rendimiento: 0.2222 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: RENDIMIENTO_MO_TRADICIONAL },
      { categoria: "Ayudante", jornadaHs: 8, rendimiento: RENDIMIENTO_MO_TRADICIONAL },
    ],
  },
  {
    codigo: "6.7.2",
    descripcion: "COLOCACIÓN Y AMURE DE ABERTURAS — POLIURETANO EXPANDIDO",
    materiales: [
      { descripcion: "Espuma de poliuretano en aerosol", unidad: "u", rendimiento: 0.033 },
      { descripcion: "Tarugo plástico 6mm c/tornillo", unidad: "u", rendimiento: 2 },
      { descripcion: "Sellador acrílico en cartucho 300ml", unidad: "u", rendimiento: 0.1 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: RENDIMIENTO_MO_POLIURETANO },
      { categoria: "Ayudante", jornadaHs: 8, rendimiento: RENDIMIENTO_MO_POLIURETANO },
    ],
  },
];

async function seedPreciosMTOP() {
  for (const precio of PRECIOS_MTOP_NUEVOS) {
    const existente = await p.precioMTOP.findUnique({ where: { codigo: precio.codigo } });
    if (existente) {
      console.log(`= PrecioMTOP ${precio.codigo} ya existe ($${existente.precioUnitario})`);
      continue;
    }
    await p.precioMTOP.create({
      data: {
        codigo: precio.codigo,
        descripcion: precio.descripcion,
        cantidadUnidad: `1 ${precio.unidad}`,
        unidad: precio.unidad,
        cantidad: 1,
        precioConIva: precio.precioUnitario,
        precioUnitario: precio.precioUnitario,
        numeroLista: 0,
        fechaLista: FECHA_LISTA,
      },
    });
    console.log(`+ PrecioMTOP creado: ${precio.codigo} — ${precio.descripcion} ($${precio.precioUnitario}/${precio.unidad})`);
  }
}

async function seedCodigosBiblioteca() {
  for (const def of CODIGOS) {
    let subrubro = await p.subrubroEstandar.findUnique({ where: { codigo: def.codigo } });

    if (!subrubro) {
      subrubro = await p.subrubroEstandar.create({
        data: {
          codigo: def.codigo,
          capitulo: "Albañilería",
          subcapitulo: "Colocación de Aberturas",
          descripcion: def.descripcion,
          unidad: "ML",
          precioUY: 0,
          origen: "manual",
        },
      });
      console.log(`+ SubrubroEstandar creado — ${def.codigo} (${def.descripcion})`);
    } else {
      console.log(`= SubrubroEstandar ${def.codigo} ya existe`);
    }

    const apuExistente = await p.aPUEstandar.findUnique({ where: { subrubroId: subrubro.id } });
    const apu = apuExistente
      ? await p.aPUEstandar.update({ where: { subrubroId: subrubro.id }, data: {} })
      : await p.aPUEstandar.create({ data: { subrubroId: subrubro.id } });

    // Reemplazar materiales y MO para que el script sea idempotente
    await p.materialAPUEstandar.deleteMany({ where: { apuId: apu.id } });
    await p.manoObraAPUEstandar.deleteMany({ where: { apuId: apu.id } });

    for (const m of def.materiales) {
      await p.materialAPUEstandar.create({
        data: { apuId: apu.id, descripcion: m.descripcion, unidad: m.unidad, rendimiento: m.rendimiento },
      });
    }
    for (const mo of def.manoObra) {
      await p.manoObraAPUEstandar.create({
        data: { apuId: apu.id, categoria: mo.categoria, jornadaHs: mo.jornadaHs, rendimiento: mo.rendimiento },
      });
    }

    console.log(`  ✓ APUEstandar de ${def.codigo}: ${def.materiales.length} materiales, ${def.manoObra.length} líneas de MO`);
  }
}

async function revincularR006() {
  const rubro = await p.rubro.findFirst({
    where: {
      descripcion: { contains: "Colocación y amure de aberturas", mode: "insensitive" },
      capitulo: { proyecto: { nombre: { contains: "HOGAR", mode: "insensitive" } } },
    },
    include: { apu: true },
  });

  if (!rubro?.apu) {
    console.warn("✗ No se encontró el rubro R006 de HOGAR o no tiene APU — se omite la re-vinculación");
    return;
  }

  if (rubro.codigo === "6.7.2") {
    console.log("= R006 ya está vinculado al código 6.7.2 — se omite la re-vinculación");
    return;
  }

  const apuEstandar622 = await p.subrubroEstandar.findUnique({
    where: { codigo: "6.7.2" },
    include: { apuEstandar: { include: { materiales: true, manoObra: true } } },
  });
  if (!apuEstandar622?.apuEstandar) throw new Error("No se encontró el APUEstandar de 6.7.2 recién creado");

  const categorias = await p.categoriaLaboral.findMany();
  const jornalPorNombre = (nombre: string) =>
    categorias.find((c) => c.nombre.trim().toLowerCase() === nombre.trim().toLowerCase())?.jornal ?? 0;

  const apuId = rubro.apu.id;

  // Reemplazar materiales (precio resuelto por descripción contra PrecioMTOP —
  // misma lógica que POST /api/subrubros-estandar/[id]/clonar-apu)
  await p.materialAPU.deleteMany({ where: { apuId } });
  for (let i = 0; i < apuEstandar622.apuEstandar.materiales.length; i++) {
    const m = apuEstandar622.apuEstandar.materiales[i];
    const precioMTOP = await p.precioMTOP.findFirst({
      where: { descripcion: { contains: m.descripcion, mode: "insensitive" } },
      orderBy: { id: "asc" },
    });
    await p.materialAPU.create({
      data: {
        apuId,
        descripcion: m.descripcion,
        unidad: m.unidad,
        rendimiento: m.rendimiento,
        precioUnit: precioMTOP?.precioUnitario ?? 0,
        orden: i,
      },
    });
  }

  // Reemplazar mano de obra (jornalRef resuelto por CategoriaLaboral)
  await p.manoObraAPU.deleteMany({ where: { apuId } });
  for (let i = 0; i < apuEstandar622.apuEstandar.manoObra.length; i++) {
    const mo = apuEstandar622.apuEstandar.manoObra[i];
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

  // Marcar el rubro como vinculado al código de biblioteca + recalcular precioUnit
  const apuActualizado = await p.aPU.findUnique({
    where: { id: apuId },
    include: { materiales: true, manoObra: true, equipos: true },
  });
  const sumMat = apuActualizado!.materiales.reduce((s, m) => s + m.rendimiento * m.precioUnit, 0);
  const sumMO = sumManoObra(apuActualizado!.manoObra, apuActualizado!.equipos);
  const sumEq = sumEquipos(apuActualizado!.equipos);
  const costoDirecto = sumMat + sumMO + sumEq;
  const precioFinal = Math.round(costoDirecto * (1 + apuActualizado!.gastosGeneralesPct / 100) * (1 + apuActualizado!.utilidadPct / 100) * 100) / 100;

  await p.rubro.update({
    where: { id: rubro.id },
    data: { codigo: "6.7.2", precioUnit: precioFinal },
  });

  console.log(`✓ R006 re-vinculado a 6.7.2 — precioUnit recalculado: $${precioFinal}/ML`);
}

async function main() {
  await seedPreciosMTOP();
  await seedCodigosBiblioteca();
  await revincularR006();
  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
