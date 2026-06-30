// Completa los 8 APUs estándar faltantes de Instalación Térmica / Aire
// Acondicionado (equipos split, radiador, caldera y pisos radiantes) en
// la base de PRODUCCIÓN.
// Ejecutar: DATABASE_URL="postgresql://..." npx tsx scripts/seed-apus-termica-completo.ts

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
  {
    codigo: "termica-001",
    descripcion: "Equipo split 9000 BTU con instalación",
    capituloFallback: "Térmica",
    materiales: [
      { descripcion: "Equipo split 9000 BTU inverter", unidad: "u", rendimiento: 1 },
      { descripcion: "Caño cobre 1/4 y 3/8", unidad: "ml", rendimiento: 3 },
      { descripcion: "Soporte mural exterior", unidad: "u", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 2.0 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 2.0 },
    ],
  },
  {
    codigo: "termica-002",
    descripcion: "Equipo split 12000 BTU con instalación",
    capituloFallback: "Térmica",
    materiales: [
      { descripcion: "Equipo split 12000 BTU inverter", unidad: "u", rendimiento: 1 },
      { descripcion: "Caño cobre 1/4 y 3/8", unidad: "ml", rendimiento: 3 },
      { descripcion: "Soporte mural exterior", unidad: "u", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 2.0 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 2.0 },
    ],
  },
  {
    codigo: "termica-003",
    descripcion: "Equipo split 18000 BTU con instalación",
    capituloFallback: "Térmica",
    materiales: [
      { descripcion: "Equipo split 18000 BTU inverter", unidad: "u", rendimiento: 1 },
      { descripcion: "Caño cobre 1/4 y 3/8", unidad: "ml", rendimiento: 4 },
      { descripcion: "Soporte mural exterior reforzado", unidad: "u", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 1.5 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 1.5 },
    ],
  },
  {
    codigo: "termica-004",
    descripcion: "Equipo split 24000 BTU con instalación",
    capituloFallback: "Térmica",
    materiales: [
      { descripcion: "Equipo split 24000 BTU inverter", unidad: "u", rendimiento: 1 },
      { descripcion: "Caño cobre 1/4 y 3/8", unidad: "ml", rendimiento: 4 },
      { descripcion: "Soporte mural exterior reforzado", unidad: "u", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 1.2 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 1.2 },
    ],
  },
  {
    codigo: "termica-005",
    descripcion: "Radiador de agua caliente",
    capituloFallback: "Térmica",
    materiales: [
      { descripcion: "Radiador de agua caliente", unidad: "u", rendimiento: 1 },
      { descripcion: "Caño cobre para calefacción", unidad: "ml", rendimiento: 4 },
      { descripcion: "Accesorios instalación radiador", unidad: "gl", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Plomero oficial", jornadaHs: 8, rendimiento: 2.5 },
    ],
  },
  {
    codigo: "termica-006",
    descripcion: "Caldera a gas para calefacción",
    capituloFallback: "Térmica",
    materiales: [
      { descripcion: "Caldera a gas para calefacción", unidad: "u", rendimiento: 1 },
      { descripcion: "Accesorios instalación caldera", unidad: "gl", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Plomero oficial", jornadaHs: 8, rendimiento: 0.5 },
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 0.5 },
    ],
  },
  {
    codigo: "termica-007",
    descripcion: "Piso radiante eléctrico",
    capituloFallback: "Térmica",
    materiales: [
      { descripcion: "Manta calefactora eléctrica para piso", unidad: "m2", rendimiento: 1.05 },
      { descripcion: "Termostato para piso radiante", unidad: "u", rendimiento: 0.05 },
    ],
    manoObra: [
      { categoria: "Electricista oficial", jornadaHs: 8, rendimiento: 12 },
    ],
  },
  {
    codigo: "termica-008",
    descripcion: "Piso radiante hidráulico",
    capituloFallback: "Térmica",
    materiales: [
      { descripcion: "Caño PEX para piso radiante", unidad: "ml", rendimiento: 6 },
      { descripcion: "Colector para piso radiante", unidad: "u", rendimiento: 0.02 },
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 8 },
    ],
    manoObra: [
      { categoria: "Plomero oficial", jornadaHs: 8, rendimiento: 8 },
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 8 },
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
