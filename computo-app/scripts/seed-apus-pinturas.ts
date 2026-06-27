// Carga los APUs estándar (materiales + mano de obra) de los subrubros de
// Pinturas del rubrado SAU en la base de PRODUCCIÓN.
// Ejecutar: DATABASE_URL="postgresql://..." npx tsx scripts/seed-apus-pinturas.ts

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
  // ── Preparación de superficies ──────────────────────────────
  {
    codigo: "7.1.1",
    descripcion: "APLICACIÓN DE ENDUIDO PLÁSTICO EN TECHOS INTERIORES",
    capituloFallback: "Pinturas",
    materiales: [
      { descripcion: "Enduido plástico interior", unidad: "kg", rendimiento: 0.35 },
    ],
    manoObra: [
      { categoria: "Pintor oficial", jornadaHs: 8, rendimiento: 25 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 25 },
    ],
  },
  {
    codigo: "7.1.3",
    descripcion: "APLICACIÓN DE ENDUIDO PLÁSTICO EN MUROS INTERIORES",
    capituloFallback: "Pinturas",
    materiales: [
      { descripcion: "Enduido plástico interior", unidad: "kg", rendimiento: 0.30 },
    ],
    manoObra: [
      { categoria: "Pintor oficial", jornadaHs: 8, rendimiento: 30 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 30 },
    ],
  },
  {
    codigo: "7.1.5",
    descripcion: "APLICACIÓN DE FIJADOR PARA MUROS",
    capituloFallback: "Pinturas",
    materiales: [
      { descripcion: "Fijador para muros", unidad: "l", rendimiento: 0.15 },
    ],
    manoObra: [
      { categoria: "Pintor oficial", jornadaHs: 8, rendimiento: 50 },
    ],
  },
  {
    codigo: "7.1.6",
    descripcion: "APLICACIÓN DE IMPRIMACIÓN PARA MUROS",
    capituloFallback: "Pinturas",
    materiales: [
      { descripcion: "Imprimación para muros", unidad: "l", rendimiento: 0.15 },
    ],
    manoObra: [
      { categoria: "Pintor oficial", jornadaHs: 8, rendimiento: 50 },
    ],
  },

  // ── Cielorrasos ──────────────────────────────────────────────
  {
    codigo: "7.1.9",
    descripcion: "PINTURA LATEX SOBRE TERCIADA EN CIELORRASOS",
    capituloFallback: "Pinturas",
    materiales: [
      { descripcion: "Pintura látex interior", unidad: "l", rendimiento: 0.12 },
    ],
    manoObra: [
      { categoria: "Pintor oficial", jornadaHs: 8, rendimiento: 25 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 25 },
    ],
  },
  {
    codigo: "7.1.11",
    descripcion: "PINTURA ANTIHONGOS SOBRE ENDUIDO EN CIELORRASO",
    capituloFallback: "Pinturas",
    materiales: [
      { descripcion: "Pintura antihongos", unidad: "l", rendimiento: 0.12 },
    ],
    manoObra: [
      { categoria: "Pintor oficial", jornadaHs: 8, rendimiento: 22 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 22 },
    ],
  },

  // ── Muros interiores ─────────────────────────────────────────
  {
    codigo: "7.1.12",
    descripcion: "PINTURA LATEX SOBRE ENDUIDO EN MURO INTERIOR",
    capituloFallback: "Pinturas",
    materiales: [
      { descripcion: "Pintura látex interior", unidad: "l", rendimiento: 0.10 },
    ],
    manoObra: [
      { categoria: "Pintor oficial", jornadaHs: 8, rendimiento: 35 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 35 },
    ],
  },
  {
    codigo: "7.1.13",
    descripcion: "PINTURA A LA CAL EN MUROS",
    capituloFallback: "Pinturas",
    materiales: [
      { descripcion: "Cal hidratada", unidad: "kg", rendimiento: 0.20 },
    ],
    manoObra: [
      { categoria: "Pintor oficial", jornadaHs: 8, rendimiento: 40 },
    ],
  },

  // ── Muros exteriores ─────────────────────────────────────────
  {
    codigo: "7.1.14",
    descripcion: "PINTURA LATEX SOBRE BALAI MURO EXTERIOR",
    capituloFallback: "Pinturas",
    materiales: [
      { descripcion: "Pintura látex exterior", unidad: "l", rendimiento: 0.12 },
    ],
    manoObra: [
      { categoria: "Pintor oficial", jornadaHs: 8, rendimiento: 28 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 28 },
    ],
  },
  {
    codigo: "7.1.15",
    descripcion: "PINTURA LATEX SIN ENDUIDO MURO EXTERIOR",
    capituloFallback: "Pinturas",
    materiales: [
      { descripcion: "Pintura látex exterior", unidad: "l", rendimiento: 0.12 },
    ],
    manoObra: [
      { categoria: "Pintor oficial", jornadaHs: 8, rendimiento: 32 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 32 },
    ],
  },
  {
    codigo: "7.1.17",
    descripcion: "ESMALTE SINTÉTICO",
    capituloFallback: "Pinturas",
    materiales: [
      { descripcion: "Esmalte sintético", unidad: "l", rendimiento: 0.10 },
    ],
    manoObra: [
      { categoria: "Pintor oficial", jornadaHs: 8, rendimiento: 20 },
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
