// Completa los APUs estándar faltantes de Cimentaciones
// (bloque cementicio armado, dado de hormigón ciclópeo, patín, viga y pilar
// de fundación, descalce de vigas) en la base de PRODUCCIÓN.
// Ejecutar: DATABASE_URL="postgresql://..." npx tsx scripts/seed-apus-cimentaciones-completo.ts

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
    codigo: "4.1.4",
    descripcion: "BLOQUE CEMENTICIO ARMADO e=20cm",
    capituloFallback: "Cimentaciones",
    materiales: [
      { descripcion: "Bloque hormigón 19x19x39", unidad: "u", rendimiento: 12.5 },
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 8 },
      { descripcion: "Arena gruesa (en obra)", unidad: "m3", rendimiento: 0.025 },
      { descripcion: "Hierro para hormigón armado", unidad: "kg", rendimiento: 4 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 8 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 8 },
    ],
  },
  {
    codigo: "4.2.2",
    descripcion: "DADO DE HORMIGÓN CICLÓPEO",
    capituloFallback: "Cimentaciones",
    materiales: [
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 200 },
      { descripcion: "Arena gruesa (en obra)", unidad: "m3", rendimiento: 0.5 },
      { descripcion: "Balasto (en obra)", unidad: "m3", rendimiento: 0.8 },
      { descripcion: "Piedra bruta", unidad: "m3", rendimiento: 0.25 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 1.5 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 1.5 },
    ],
  },
  {
    codigo: "4.2.4",
    descripcion: "PATÍN DE HORMIGÓN ARMADO (80kg de hierro/m3)",
    capituloFallback: "Cimentaciones",
    materiales: [
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 300 },
      { descripcion: "Arena gruesa (en obra)", unidad: "m3", rendimiento: 0.55 },
      { descripcion: "Balasto (en obra)", unidad: "m3", rendimiento: 0.85 },
      { descripcion: "Hierro para hormigón armado", unidad: "kg", rendimiento: 80 },
      { descripcion: "Madera para encofrado", unidad: "m2", rendimiento: 1.2 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 1.0 },
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 1.0 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 1.0 },
    ],
  },
  {
    codigo: "4.2.5",
    descripcion: "VIGA DE FUNDACIÓN DE HORMIGÓN ARMADO (80kg de hierro/m3)",
    capituloFallback: "Cimentaciones",
    materiales: [
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 300 },
      { descripcion: "Arena gruesa (en obra)", unidad: "m3", rendimiento: 0.55 },
      { descripcion: "Balasto (en obra)", unidad: "m3", rendimiento: 0.85 },
      { descripcion: "Hierro para hormigón armado", unidad: "kg", rendimiento: 80 },
      { descripcion: "Madera para encofrado", unidad: "m2", rendimiento: 2.0 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 0.8 },
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 0.8 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 0.8 },
    ],
  },
  {
    codigo: "4.2.6",
    descripcion: "PILAR DE FUNDACIÓN DE HORMIGÓN ARMADO (140kg de hierro/m3)",
    capituloFallback: "Cimentaciones",
    materiales: [
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 350 },
      { descripcion: "Arena gruesa (en obra)", unidad: "m3", rendimiento: 0.55 },
      { descripcion: "Balasto (en obra)", unidad: "m3", rendimiento: 0.85 },
      { descripcion: "Hierro para hormigón armado", unidad: "kg", rendimiento: 140 },
      { descripcion: "Madera para encofrado", unidad: "m2", rendimiento: 4.0 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 0.6 },
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 0.6 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 0.6 },
    ],
  },
  {
    codigo: "4.2.8",
    descripcion: "DESCALCE DE VIGAS DE FUNDACIÓN CON ARENA",
    capituloFallback: "Cimentaciones",
    materiales: [
      { descripcion: "Arena fina (en obra)", unidad: "m3", rendimiento: 1.1 },
    ],
    manoObra: [
      { categoria: "Peón", jornadaHs: 8, rendimiento: 1.0 },
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
