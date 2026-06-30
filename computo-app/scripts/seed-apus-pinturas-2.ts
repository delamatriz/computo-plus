// Completa los 7 APUs estándar faltantes de Subcontratos - Pinturas
// (preparación de superficies, cielorrasos y muros exteriores) en la
// base de PRODUCCIÓN.
// Ejecutar: DATABASE_URL="postgresql://..." npx tsx scripts/seed-apus-pinturas-2.ts

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
    codigo: "7.1.2",
    descripcion: "APLICACIÓN DE ENDUIDO PLASTICO EN TECHOS EXTERIORES",
    capituloFallback: "Pinturas",
    materiales: [
      { descripcion: "Enduido plástico exterior", unidad: "kg", rendimiento: 0.4 },
    ],
    manoObra: [
      { categoria: "Pintor oficial", jornadaHs: 8, rendimiento: 22 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 22 },
    ],
  },
  {
    codigo: "7.1.4",
    descripcion: "APLICACIÓN DE ENDUIDO PLASTICO EN MUROS EXTERIORES",
    capituloFallback: "Pinturas",
    materiales: [
      { descripcion: "Enduido plástico exterior", unidad: "kg", rendimiento: 0.35 },
    ],
    manoObra: [
      { categoria: "Pintor oficial", jornadaHs: 8, rendimiento: 25 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 25 },
    ],
  },
  {
    codigo: "7.1.7",
    descripcion: "APLICACIÓN DE FONDO PARA MADERA",
    capituloFallback: "Pinturas",
    materiales: [
      { descripcion: "Fondo selladora para madera", unidad: "l", rendimiento: 0.12 },
    ],
    manoObra: [
      { categoria: "Pintor oficial", jornadaHs: 8, rendimiento: 35 },
    ],
  },
  {
    codigo: "7.1.8",
    descripcion: "APLICACIÓN DE ANTIÓXIDO PARA HIERRO",
    capituloFallback: "Pinturas",
    materiales: [
      { descripcion: "Pintura anticorrosiva", unidad: "l", rendimiento: 0.15 },
    ],
    manoObra: [
      { categoria: "Pintor oficial", jornadaHs: 8, rendimiento: 30 },
    ],
  },
  {
    codigo: "7.1.10",
    descripcion: "PINTURA A LA CAL EN CIELORRASOS",
    capituloFallback: "Pinturas",
    materiales: [
      { descripcion: "Cal hidratada", unidad: "kg", rendimiento: 0.25 },
    ],
    manoObra: [
      { categoria: "Pintor oficial", jornadaHs: 8, rendimiento: 35 },
    ],
  },
  {
    codigo: "7.1.16",
    descripcion: "IMPERMEABILIZANTE A BASE DE SILICONAS HIDROREPELENTE",
    capituloFallback: "Pinturas",
    materiales: [
      { descripcion: "Impermeabilizante siliconado hidrorepelente", unidad: "l", rendimiento: 0.2 },
    ],
    manoObra: [
      { categoria: "Pintor oficial", jornadaHs: 8, rendimiento: 25 },
    ],
  },
  {
    codigo: "7.1.18",
    descripcion: "BARNIZ",
    capituloFallback: "Pinturas",
    materiales: [
      { descripcion: "Barniz para madera", unidad: "l", rendimiento: 0.1 },
    ],
    manoObra: [
      { categoria: "Pintor oficial", jornadaHs: 8, rendimiento: 22 },
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
