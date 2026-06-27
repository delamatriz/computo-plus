// Carga los APUs estándar (materiales + mano de obra) de los subrubros de
// Impermeabilizaciones y Aislaciones, y Pisos/Revestimientos del rubrado
// SAU en la base de PRODUCCIÓN.
// Ejecutar: DATABASE_URL="postgresql://..." npx tsx scripts/seed-apus-impermeabilizaciones-pisos.ts

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
  // ── Impermeabilizaciones y Aislaciones ──────────────────────
  {
    codigo: "6.6.1",
    descripcion: "CONFORMACIÓN DE MEDIA CAÑA",
    capituloFallback: "Impermeabilizaciones y Aislaciones",
    materiales: [
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 0.8 },
      { descripcion: "Arena fina (en obra)", unidad: "m3", rendimiento: 0.002 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 30 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 30 },
    ],
  },
  {
    codigo: "6.6.2",
    descripcion: "CAPA ALISADO DE ARENA Y PORTLAND 2cm",
    capituloFallback: "Impermeabilizaciones y Aislaciones",
    materiales: [
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 5 },
      { descripcion: "Arena fina (en obra)", unidad: "m3", rendimiento: 0.012 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 16 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 16 },
    ],
  },
  {
    codigo: "6.6.4",
    descripcion: "BARRERA DE VAPOR (POLIETILENO 100 MICRONES)",
    capituloFallback: "Impermeabilizaciones y Aislaciones",
    materiales: [
      { descripcion: "Polietileno 100 micrones", unidad: "m2", rendimiento: 1.10 },
    ],
    manoObra: [
      { categoria: "Peón", jornadaHs: 8, rendimiento: 80 },
    ],
  },
  {
    codigo: "6.6.8",
    descripcion: "MEMBRANA CON GEOTEXTIL",
    capituloFallback: "Impermeabilizaciones y Aislaciones",
    materiales: [
      { descripcion: "Membrana asfáltica con geotextil", unidad: "m2", rendimiento: 1.10 },
      { descripcion: "Imprimación asfáltica", unidad: "l", rendimiento: 0.30 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 20 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 20 },
    ],
  },
  {
    codigo: "6.6.9",
    descripcion: "MEMBRANA CON ALUMINIO DE 4mm SOBRE ARENA Y PORTLAND",
    capituloFallback: "Impermeabilizaciones y Aislaciones",
    materiales: [
      { descripcion: "Membrana asfáltica aluminizada 4mm", unidad: "m2", rendimiento: 1.10 },
      { descripcion: "Imprimación asfáltica", unidad: "l", rendimiento: 0.30 },
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 3 },
      { descripcion: "Arena fina (en obra)", unidad: "m3", rendimiento: 0.008 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 16 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 16 },
    ],
  },
  {
    codigo: "6.6.11",
    descripcion: "IMPERMEABILIZACIÓN DE BAÑO EN PLANTA ALTA CON HIDRÓFUGO",
    capituloFallback: "Impermeabilizaciones y Aislaciones",
    materiales: [
      { descripcion: "Hidrófugo líquido", unidad: "l", rendimiento: 0.5 },
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 4 },
      { descripcion: "Arena fina (en obra)", unidad: "m3", rendimiento: 0.010 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 20 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 20 },
    ],
  },

  // ── Pisos y revestimientos ──────────────────────────────────
  {
    codigo: "6.4.6",
    descripcion: "PORCELANATO 60x60cm",
    capituloFallback: "Pisos, Zócalos y Revestimientos",
    materiales: [
      { descripcion: "Porcelanato 60x60cm", unidad: "m2", rendimiento: 1.05 },
      { descripcion: "Pegamento para cerámica", unidad: "kg", rendimiento: 5 },
      { descripcion: "Pastina para juntas", unidad: "kg", rendimiento: 0.5 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 8 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 8 },
    ],
  },
  {
    codigo: "6.4.7",
    descripcion: "BALDOSA CERÁMICA 50x50cm",
    capituloFallback: "Pisos, Zócalos y Revestimientos",
    materiales: [
      { descripcion: "Baldosa cerámica 50x50cm", unidad: "m2", rendimiento: 1.05 },
      { descripcion: "Pegamento para cerámica", unidad: "kg", rendimiento: 4.5 },
      { descripcion: "Pastina para juntas", unidad: "kg", rendimiento: 0.5 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 10 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 10 },
    ],
  },
  {
    codigo: "6.4.10",
    descripcion: "BALDOSA DE VEREDA 20x20cm",
    capituloFallback: "Pisos, Zócalos y Revestimientos",
    materiales: [
      { descripcion: "Baldosa de vereda 20x20cm", unidad: "m2", rendimiento: 1.05 },
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 6 },
      { descripcion: "Arena fina (en obra)", unidad: "m3", rendimiento: 0.015 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 12 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 12 },
    ],
  },
  {
    codigo: "6.5.1",
    descripcion: "PORCELANATO PULIDO 60X60",
    capituloFallback: "Pisos, Zócalos y Revestimientos",
    materiales: [
      { descripcion: "Porcelanato 60x60cm", unidad: "m2", rendimiento: 1.05 },
      { descripcion: "Pegamento para cerámica", unidad: "kg", rendimiento: 5 },
      { descripcion: "Pastina para juntas", unidad: "kg", rendimiento: 0.5 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 7 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 7 },
    ],
  },
  {
    codigo: "6.5.2",
    descripcion: "PORCELANATO MATE BLANCO 30X60",
    capituloFallback: "Pisos, Zócalos y Revestimientos",
    materiales: [
      { descripcion: "Porcelanato 30x60cm", unidad: "m2", rendimiento: 1.05 },
      { descripcion: "Pegamento para cerámica", unidad: "kg", rendimiento: 5 },
      { descripcion: "Pastina para juntas", unidad: "kg", rendimiento: 0.5 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 7 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 7 },
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
