// Completa los APUs estándar faltantes de Estructura
// (pilares curvos, losas prefabricadas Stalton, hormigón premezclado,
// antepecho, dintel, tanque de agua y losa de escalera) en la base de
// PRODUCCIÓN.
// Ejecutar: DATABASE_URL="postgresql://..." npx tsx scripts/seed-apus-estructura-completo.ts

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
    codigo: "5.1.2",
    descripcion: "PILARES CURVOS (140kg de hierro/m3)",
    capituloFallback: "Estructura",
    materiales: [
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 350 },
      { descripcion: "Arena gruesa (en obra)", unidad: "m3", rendimiento: 0.55 },
      { descripcion: "Balasto (en obra)", unidad: "m3", rendimiento: 0.85 },
      { descripcion: "Hierro para hormigón armado", unidad: "kg", rendimiento: 140 },
      { descripcion: "Madera para encofrado", unidad: "m2", rendimiento: 7.0 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 0.5 },
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 0.5 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 0.5 },
    ],
  },
  {
    codigo: "5.2.2",
    descripcion: "LOSA PREFABRICADA STALTON CON BOVEDILLA H=15cm",
    capituloFallback: "Estructura",
    materiales: [
      { descripcion: "Losa Stalton H=15cm", unidad: "m2", rendimiento: 1.05 },
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 14 },
      { descripcion: "Arena gruesa (en obra)", unidad: "m3", rendimiento: 0.018 },
      { descripcion: "Hierro para hormigón armado", unidad: "kg", rendimiento: 4 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 7 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 7 },
    ],
  },
  {
    codigo: "5.2.3",
    descripcion: "LOSA PREFABRICADA STALTON CON BOVEDILLA H=19cm",
    capituloFallback: "Estructura",
    materiales: [
      { descripcion: "Losa Stalton H=19cm", unidad: "m2", rendimiento: 1.05 },
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 16 },
      { descripcion: "Arena gruesa (en obra)", unidad: "m3", rendimiento: 0.02 },
      { descripcion: "Hierro para hormigón armado", unidad: "kg", rendimiento: 5 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 6 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 6 },
    ],
  },
  {
    codigo: "5.3.2",
    descripcion: "HORMIGÓN PREMEZCLADO VOLCADO C20",
    capituloFallback: "Estructura",
    materiales: [
      { descripcion: "Hormigón premezclado C20", unidad: "m3", rendimiento: 1.05 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 5.0 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 5.0 },
    ],
  },
  {
    codigo: "5.3.3",
    descripcion: "ANTEPECHO DE HORMIGÓN ARMADO (80kg de hierro/m3)",
    capituloFallback: "Estructura",
    materiales: [
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 300 },
      { descripcion: "Arena gruesa (en obra)", unidad: "m3", rendimiento: 0.55 },
      { descripcion: "Balasto (en obra)", unidad: "m3", rendimiento: 0.85 },
      { descripcion: "Hierro para hormigón armado", unidad: "kg", rendimiento: 80 },
      { descripcion: "Madera para encofrado", unidad: "m2", rendimiento: 6.0 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 0.8 },
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 0.8 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 0.8 },
    ],
  },
  {
    codigo: "5.3.4",
    descripcion: "DINTEL DE HORMIGÓN ARMADO (80kg de hierro/m3)",
    capituloFallback: "Estructura",
    materiales: [
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 25 },
      { descripcion: "Arena gruesa (en obra)", unidad: "m3", rendimiento: 0.045 },
      { descripcion: "Balasto (en obra)", unidad: "m3", rendimiento: 0.07 },
      { descripcion: "Hierro para hormigón armado", unidad: "kg", rendimiento: 6 },
      { descripcion: "Madera para encofrado", unidad: "m2", rendimiento: 0.5 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 6 },
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 6 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 6 },
    ],
  },
  {
    codigo: "5.3.5",
    descripcion: "TANQUE DE AGUA (80kg de hierro/m3)",
    capituloFallback: "Estructura",
    materiales: [
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 350 },
      { descripcion: "Arena gruesa (en obra)", unidad: "m3", rendimiento: 0.55 },
      { descripcion: "Balasto (en obra)", unidad: "m3", rendimiento: 0.85 },
      { descripcion: "Hierro para hormigón armado", unidad: "kg", rendimiento: 80 },
      { descripcion: "Madera para encofrado", unidad: "m2", rendimiento: 5.0 },
      { descripcion: "Hidrófugo líquido", unidad: "l", rendimiento: 0.5 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 0.7 },
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 0.7 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 0.7 },
    ],
  },
  {
    codigo: "5.3.6",
    descripcion: "LOSA DE ESCALERA RECTA (80kg de hierro/m3)",
    capituloFallback: "Estructura",
    materiales: [
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 300 },
      { descripcion: "Arena gruesa (en obra)", unidad: "m3", rendimiento: 0.55 },
      { descripcion: "Balasto (en obra)", unidad: "m3", rendimiento: 0.85 },
      { descripcion: "Hierro para hormigón armado", unidad: "kg", rendimiento: 80 },
      { descripcion: "Madera para encofrado", unidad: "m2", rendimiento: 8.0 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 0.6 },
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 0.6 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 0.6 },
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
