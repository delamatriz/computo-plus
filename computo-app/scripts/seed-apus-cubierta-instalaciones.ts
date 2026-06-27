// Carga los APUs estándar (materiales + mano de obra) de subrubros de
// Cubierta/Techos, Contrapisos y Revoques adicionales (capítulo
// Albañilería) e Impermeabilizaciones del rubrado SAU en la base de
// PRODUCCIÓN.
// Ejecutar: DATABASE_URL="postgresql://..." npx tsx scripts/seed-apus-cubierta-instalaciones.ts

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

type MaterialDef = { descripcion: string; unidad: string; rendimiento: number };
type ManoObraDef = { categoria: string; jornadaHs: number; rendimiento: number };

type ApuDef = {
  codigo: string;
  descripcion: string; // usada como fallback de búsqueda si no hay match por código
  capituloFallback: string;
  materiales: MaterialDef[];
  manoObra: ManoObraDef[];
};

const APUS: ApuDef[] = [
  // ── Cubierta / Techos ────────────────────────────────────────
  {
    codigo: "6.6.13",
    descripcion: "COLOCACIÓN DE TEJAS COLONIALES",
    capituloFallback: "Impermeabilizaciones y Aislaciones",
    materiales: [
      { descripcion: "Teja colonial", unidad: "u", rendimiento: 16 },
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 3 },
      { descripcion: "Arena fina (en obra)", unidad: "m3", rendimiento: 0.008 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 10 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 10 },
    ],
  },
  {
    codigo: "6.6.6",
    descripcion: "ESPUMA PLAST AUTOTRABANTE SOBRE LOSAS",
    capituloFallback: "Impermeabilizaciones y Aislaciones",
    materiales: [
      { descripcion: "Espuma plast autotrabante", unidad: "m2", rendimiento: 1.05 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 30 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 30 },
    ],
  },
  {
    codigo: "6.6.5",
    descripcion: "POLIURETANO EXPANDIDO SOBRE LOSA Y MURO e=3cm",
    capituloFallback: "Impermeabilizaciones y Aislaciones",
    materiales: [
      { descripcion: "Poliuretano expandido e=3cm", unidad: "m2", rendimiento: 1.05 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 25 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 25 },
    ],
  },
  {
    codigo: "6.3.6",
    descripcion: "HORMIGÓN POROSO EN AZOTEA e=12cm",
    capituloFallback: "Albañilería",
    materiales: [
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 15 },
      { descripcion: "Balasto (en obra)", unidad: "m3", rendimiento: 0.14 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 8 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 8 },
    ],
  },

  // ── Contrapisos adicionales ──────────────────────────────────
  {
    codigo: "6.3.4",
    descripcion: "ALISADO DE ARENA Y PORTLAND e=2cm",
    capituloFallback: "Albañilería",
    materiales: [
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 5 },
      { descripcion: "Arena fina (en obra)", unidad: "m3", rendimiento: 0.012 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 18 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 18 },
    ],
  },
  {
    codigo: "6.3.5",
    descripcion: "COLOCACIÓN DE MALLA ELECTROSOLDADA 15x15x4.2mm",
    capituloFallback: "Albañilería",
    materiales: [
      { descripcion: "Malla electrosoldada 15x15x4.2mm", unidad: "m2", rendimiento: 1.05 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 30 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 30 },
    ],
  },

  // ── Revoques adicionales ─────────────────────────────────────
  {
    codigo: "6.2.3",
    descripcion: "BALAI PARA CIELORRASO",
    capituloFallback: "Albañilería",
    materiales: [
      { descripcion: "Cal hidratada", unidad: "kg", rendimiento: 3 },
      { descripcion: "Arena fina (en obra)", unidad: "m3", rendimiento: 0.005 },
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 22 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 22 },
    ],
  },
  {
    codigo: "6.2.6",
    descripcion: "REVOQUE ARENA Y PORTLAND LUSTRADO",
    capituloFallback: "Albañilería",
    materiales: [
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 5 },
      { descripcion: "Arena fina (en obra)", unidad: "m3", rendimiento: 0.010 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 12 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 12 },
    ],
  },
  {
    codigo: "6.2.7",
    descripcion: "BALAI EN MURO INTERIOR",
    capituloFallback: "Albañilería",
    materiales: [
      { descripcion: "Cal hidratada", unidad: "kg", rendimiento: 3 },
      { descripcion: "Arena fina (en obra)", unidad: "m3", rendimiento: 0.005 },
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 24 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 24 },
    ],
  },
  {
    codigo: "6.2.8",
    descripcion: "CAPA HIDROFUGADA PARA MURO EXTERIOR",
    capituloFallback: "Albañilería",
    materiales: [
      { descripcion: "Hidrófugo líquido", unidad: "l", rendimiento: 0.3 },
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 4 },
      { descripcion: "Arena fina (en obra)", unidad: "m3", rendimiento: 0.010 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 18 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 18 },
    ],
  },
  {
    codigo: "6.2.11",
    descripcion: "BALAI EN FACHADA CON MEZCLA FINA",
    capituloFallback: "Albañilería",
    materiales: [
      { descripcion: "Cal hidratada", unidad: "kg", rendimiento: 3.5 },
      { descripcion: "Arena fina (en obra)", unidad: "m3", rendimiento: 0.006 },
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 1.5 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 20 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 20 },
    ],
  },
  {
    codigo: "6.2.13",
    descripcion: "MOCHETA INTERIOR COMPLETA 15x15cm",
    capituloFallback: "Albañilería",
    materiales: [
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 1.5 },
      { descripcion: "Arena fina (en obra)", unidad: "m3", rendimiento: 0.004 },
      { descripcion: "Cal hidratada", unidad: "kg", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 20 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 20 },
    ],
  },
];

async function buscarSubrubro(def: ApuDef) {
  const porCodigo = await p.subrubroEstandar.findUnique({ where: { codigo: def.codigo } });
  if (porCodigo) return porCodigo;

  return p.subrubroEstandar.findFirst({
    where: {
      capitulo: { contains: def.capituloFallback, mode: "insensitive" },
      descripcion: { contains: def.descripcion, mode: "insensitive" },
    },
  });
}

async function main() {
  let creados = 0;
  let actualizados = 0;
  let noEncontrados = 0;

  for (const def of APUS) {
    const subrubro = await buscarSubrubro(def);

    if (!subrubro) {
      console.warn(`✗ No se encontró SubrubroEstandar para ${def.codigo} — ${def.descripcion}`);
      noEncontrados++;
      continue;
    }

    const existente = await p.aPUEstandar.findUnique({ where: { subrubroId: subrubro.id } });

    const apu = existente
      ? await p.aPUEstandar.update({
          where: { subrubroId: subrubro.id },
          data: {},
        })
      : await p.aPUEstandar.create({
          data: { subrubroId: subrubro.id },
        });

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

    if (existente) {
      console.log(`↻ Actualizado APUEstandar — ${subrubro.codigo} (${subrubro.descripcion})`);
      actualizados++;
    } else {
      console.log(`✓ Creado APUEstandar — ${subrubro.codigo} (${subrubro.descripcion})`);
      creados++;
    }
  }

  console.log("\n── Resumen ──");
  console.log(`Creados:        ${creados}`);
  console.log(`Actualizados:   ${actualizados}`);
  console.log(`No encontrados: ${noEncontrados}`);
  console.log(`Total definidos: ${APUS.length}`);

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
