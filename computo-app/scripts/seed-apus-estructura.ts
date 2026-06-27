// Carga los APUs estándar (materiales + mano de obra) de los subrubros de
// Cimentaciones y Estructura de Hormigón Armado del rubrado SAU en la base
// de PRODUCCIÓN.
// Ejecutar: DATABASE_URL="postgresql://..." npx tsx scripts/seed-apus-estructura.ts

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
  // ── Cimentaciones ──────────────────────────────────────────
  {
    codigo: "4.1.1",
    descripcion: "HORMIGÓN CICLÓPEO ENCOFRADO EN UN LADO",
    capituloFallback: "Cimentaciones",
    materiales: [
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 200 },
      { descripcion: "Arena gruesa (en obra)", unidad: "m3", rendimiento: 0.50 },
      { descripcion: "Balasto (en obra)", unidad: "m3", rendimiento: 0.80 },
      { descripcion: "Piedra bruta", unidad: "m3", rendimiento: 0.30 },
      { descripcion: "Madera para encofrado", unidad: "m2", rendimiento: 1.20 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 1.5 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 1.5 },
    ],
  },
  {
    codigo: "4.1.2",
    descripcion: "HORMIGÓN CICLÓPEO ENCOFRADO DOS LADOS",
    capituloFallback: "Cimentaciones",
    materiales: [
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 200 },
      { descripcion: "Arena gruesa (en obra)", unidad: "m3", rendimiento: 0.50 },
      { descripcion: "Balasto (en obra)", unidad: "m3", rendimiento: 0.80 },
      { descripcion: "Piedra bruta", unidad: "m3", rendimiento: 0.30 },
      { descripcion: "Madera para encofrado", unidad: "m2", rendimiento: 2.40 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 1.2 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 1.2 },
    ],
  },
  {
    codigo: "4.1.3",
    descripcion: "HORMIGÓN ARMADO ENCOFRADO DOS LADOS",
    capituloFallback: "Cimentaciones",
    materiales: [
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 350 },
      { descripcion: "Arena gruesa (en obra)", unidad: "m3", rendimiento: 0.55 },
      { descripcion: "Balasto (en obra)", unidad: "m3", rendimiento: 0.85 },
      { descripcion: "Hierro para hormigón armado", unidad: "kg", rendimiento: 140 },
      { descripcion: "Madera para encofrado", unidad: "m2", rendimiento: 2.40 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 0.8 },
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 0.8 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 0.8 },
    ],
  },
  {
    codigo: "4.2.1",
    descripcion: "HORMIGÓN POBRE 200K",
    capituloFallback: "Cimentaciones",
    materiales: [
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 200 },
      { descripcion: "Arena gruesa (en obra)", unidad: "m3", rendimiento: 0.60 },
      { descripcion: "Balasto (en obra)", unidad: "m3", rendimiento: 0.90 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 2.5 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 2.5 },
    ],
  },
  {
    codigo: "4.2.3",
    descripcion: "ZAPATA CORRIDA HORMIGÓN ARMADO",
    capituloFallback: "Cimentaciones",
    materiales: [
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 300 },
      { descripcion: "Arena gruesa (en obra)", unidad: "m3", rendimiento: 0.55 },
      { descripcion: "Balasto (en obra)", unidad: "m3", rendimiento: 0.85 },
      { descripcion: "Hierro para hormigón armado", unidad: "kg", rendimiento: 80 },
      { descripcion: "Madera para encofrado", unidad: "m2", rendimiento: 1.50 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 1.0 },
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 1.0 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 1.0 },
    ],
  },
  {
    codigo: "4.2.7",
    descripcion: "PLATEA HORMIGÓN ARMADO",
    capituloFallback: "Cimentaciones",
    materiales: [
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 300 },
      { descripcion: "Arena gruesa (en obra)", unidad: "m3", rendimiento: 0.55 },
      { descripcion: "Balasto (en obra)", unidad: "m3", rendimiento: 0.85 },
      { descripcion: "Hierro para hormigón armado", unidad: "kg", rendimiento: 80 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 1.2 },
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 1.2 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 1.2 },
    ],
  },

  // ── Estructura de hormigón armado ──────────────────────────
  {
    codigo: "5.1.1",
    descripcion: "PILARES Y PANTALLAS",
    capituloFallback: "Estructura de Hormigón Armado",
    materiales: [
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 350 },
      { descripcion: "Arena gruesa (en obra)", unidad: "m3", rendimiento: 0.55 },
      { descripcion: "Balasto (en obra)", unidad: "m3", rendimiento: 0.85 },
      { descripcion: "Hierro para hormigón armado", unidad: "kg", rendimiento: 140 },
      { descripcion: "Madera para encofrado", unidad: "m2", rendimiento: 5.00 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 0.6 },
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 0.6 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 0.6 },
    ],
  },
  {
    codigo: "5.1.3",
    descripcion: "VIGAS Y CARRERAS",
    capituloFallback: "Estructura de Hormigón Armado",
    materiales: [
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 320 },
      { descripcion: "Arena gruesa (en obra)", unidad: "m3", rendimiento: 0.55 },
      { descripcion: "Balasto (en obra)", unidad: "m3", rendimiento: 0.85 },
      { descripcion: "Hierro para hormigón armado", unidad: "kg", rendimiento: 120 },
      { descripcion: "Madera para encofrado", unidad: "m2", rendimiento: 3.50 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 0.7 },
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 0.7 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 0.7 },
    ],
  },
  {
    codigo: "5.2.1",
    descripcion: "LOSA PREFABRICADA STALTON CON BOVEDILLA H=10cm",
    capituloFallback: "Estructura de Hormigón Armado",
    materiales: [
      { descripcion: "Losa Stalton H=10cm", unidad: "m2", rendimiento: 1.05 },
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 12 },
      { descripcion: "Arena gruesa (en obra)", unidad: "m3", rendimiento: 0.015 },
      { descripcion: "Hierro para hormigón armado", unidad: "kg", rendimiento: 3 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 8 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 8 },
    ],
  },
  {
    codigo: "5.2.4",
    descripcion: "LOSA HORMIGÓN ARMADO e=15cm",
    capituloFallback: "Estructura de Hormigón Armado",
    materiales: [
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 300 },
      { descripcion: "Arena gruesa (en obra)", unidad: "m3", rendimiento: 0.55 },
      { descripcion: "Balasto (en obra)", unidad: "m3", rendimiento: 0.85 },
      { descripcion: "Hierro para hormigón armado", unidad: "kg", rendimiento: 80 },
      { descripcion: "Madera para encofrado", unidad: "m2", rendimiento: 7.00 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 0.8 },
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 0.8 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 0.8 },
    ],
  },
  {
    codigo: "5.3.1",
    descripcion: "HORMIGÓN PREMEZCLADO BOMBEADO C20",
    capituloFallback: "Estructura de Hormigón Armado",
    materiales: [
      { descripcion: "Hormigón premezclado C20", unidad: "m3", rendimiento: 1.05 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 4.0 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 4.0 },
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
