// Carga los APUs estándar (materiales + mano de obra) de subrubros de
// Carpintería, Zócalos/Escalones/Umbrales/Pisos adicionales (capítulo
// Pisos, Zócalos y Revestimientos) y revoques restantes (capítulo
// Albañilería) del rubrado SAU en la base de PRODUCCIÓN.
// Ejecutar: DATABASE_URL="postgresql://..." npx tsx scripts/seed-apus-carpinterias-varios.ts

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
  // ── Carpinterías de madera ───────────────────────────────────
  {
    codigo: "7.3.1",
    descripcion: "PUERTA EXTERIOR CON MARCO 0.90x2.10m",
    capituloFallback: "Carpintería",
    materiales: [
      { descripcion: "Puerta exterior de madera 0.90x2.10m", unidad: "u", rendimiento: 1 },
      { descripcion: "Tornillos y herrajes", unidad: "gl", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 1 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 1 },
    ],
  },
  {
    codigo: "7.3.2",
    descripcion: "PUERTA INTERIOR CON MARCO 0.80x2.05m",
    capituloFallback: "Carpintería",
    materiales: [
      { descripcion: "Puerta interior de madera 0.80x2.05m", unidad: "u", rendimiento: 1 },
      { descripcion: "Tornillos y herrajes", unidad: "gl", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 1.5 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 1.5 },
    ],
  },

  // ── Zócalos ────────────────────────────────────────────────
  {
    codigo: "6.4.21",
    descripcion: "ZÓCALO DE MADERA 75x15mm",
    capituloFallback: "Pisos, Zócalos y Revestimientos",
    materiales: [
      { descripcion: "Zócalo de madera 75x15mm", unidad: "ml", rendimiento: 1.05 },
      { descripcion: "Tornillos y herrajes", unidad: "gl", rendimiento: 0.1 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 30 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 30 },
    ],
  },
  {
    codigo: "6.4.22",
    descripcion: "ZÓCALO DE BALDOSA CERÁMICA 50x50cm h=12cm",
    capituloFallback: "Pisos, Zócalos y Revestimientos",
    materiales: [
      { descripcion: "Baldosa cerámica 50x50cm", unidad: "m2", rendimiento: 0.13 },
      { descripcion: "Pegamento para cerámica", unidad: "kg", rendimiento: 0.6 },
      { descripcion: "Pastina para juntas", unidad: "kg", rendimiento: 0.06 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 20 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 20 },
    ],
  },
  {
    codigo: "6.4.24",
    descripcion: "ZÓCALO PORCELANATO h=12cm",
    capituloFallback: "Pisos, Zócalos y Revestimientos",
    materiales: [
      { descripcion: "Porcelanato 60x60cm", unidad: "m2", rendimiento: 0.13 },
      { descripcion: "Pegamento para cerámica", unidad: "kg", rendimiento: 0.6 },
      { descripcion: "Pastina para juntas", unidad: "kg", rendimiento: 0.06 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 18 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 18 },
    ],
  },

  // ── Escalones y umbrales ──────────────────────────────────────
  {
    codigo: "6.4.20",
    descripcion: "ESCALÓN ARENA Y PORTLAND LUSTRADO h=7cm",
    capituloFallback: "Pisos, Zócalos y Revestimientos",
    materiales: [
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 4 },
      { descripcion: "Arena fina (en obra)", unidad: "m3", rendimiento: 0.010 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 10 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 10 },
    ],
  },
  {
    codigo: "6.4.14",
    descripcion: "UMBRAL DE PORTLAND LUSTRADO ancho=30cm",
    capituloFallback: "Pisos, Zócalos y Revestimientos",
    materiales: [
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 3 },
      { descripcion: "Arena fina (en obra)", unidad: "m3", rendimiento: 0.008 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 12 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 12 },
    ],
  },

  // ── Pisos adicionales ──────────────────────────────────────────
  {
    codigo: "6.4.1",
    descripcion: "PISO VINÍLICO H2O EN TABLAS E=8mm",
    capituloFallback: "Pisos, Zócalos y Revestimientos",
    materiales: [
      { descripcion: "Piso vinílico H2O e=8mm", unidad: "m2", rendimiento: 1.05 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 15 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 15 },
    ],
  },
  {
    codigo: "6.4.4",
    descripcion: "PISO FLOTANTE ALTA CALIDAD",
    capituloFallback: "Pisos, Zócalos y Revestimientos",
    materiales: [
      { descripcion: "Piso flotante alta calidad", unidad: "m2", rendimiento: 1.05 },
      { descripcion: "Espuma para piso flotante", unidad: "m2", rendimiento: 1.05 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 18 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 18 },
    ],
  },
  {
    codigo: "6.4.8",
    descripcion: "BALDOSA DE MONOLÍTICA 40x40cm",
    capituloFallback: "Pisos, Zócalos y Revestimientos",
    materiales: [
      { descripcion: "Baldosa monolítica 40x40cm", unidad: "m2", rendimiento: 1.05 },
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 5 },
      { descripcion: "Arena fina (en obra)", unidad: "m3", rendimiento: 0.012 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 10 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 10 },
    ],
  },

  // ── Revoques restantes ───────────────────────────────────────
  {
    codigo: "6.2.12",
    descripcion: "AZOTADA PARA MORDIENTE EN PARAMENTO",
    capituloFallback: "Albañilería",
    materiales: [
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 3 },
      { descripcion: "Arena fina (en obra)", unidad: "m3", rendimiento: 0.006 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 30 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 30 },
    ],
  },
  {
    codigo: "6.2.14",
    descripcion: "MOCHETA EXTERIOR COMPLETA 15x15cm",
    capituloFallback: "Albañilería",
    materiales: [
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 2 },
      { descripcion: "Arena fina (en obra)", unidad: "m3", rendimiento: 0.005 },
      { descripcion: "Cal hidratada", unidad: "kg", rendimiento: 1.5 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 18 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 18 },
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
