// Completa los APUs estándar faltantes de Excavaciones y Movimiento de Tierra
// (excavación a máquina, relleno de pozos a mano, compactación con plancha)
// en la base de PRODUCCIÓN.
// Ejecutar: DATABASE_URL="postgresql://..." npx tsx scripts/seed-apus-excavaciones-completo.ts

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

type MaterialDef = { descripcion: string; unidad: string; rendimiento: number };
type ManoObraDef = { categoria: string; jornadaHs: number; rendimiento: number };
type EquipoDef = { descripcion: string; unidad: string; rendimiento: number };

type ApuDef = {
  codigo: string;
  descripcion: string; // usada como fallback de búsqueda si no hay match por código
  capituloFallback: string;
  materiales: MaterialDef[];
  equipos: EquipoDef[];
  manoObra: ManoObraDef[];
};

const APUS: ApuDef[] = [
  {
    codigo: "2.4",
    descripcion: "EXCAVACIÓN A MAQUINA SIN RETIRO",
    capituloFallback: "Excavaciones y Movimientos de Tierra",
    materiales: [],
    equipos: [
      { descripcion: "Retroexcavadora", unidad: "hs", rendimiento: 0.15 },
    ],
    manoObra: [
      { categoria: "Oficial maquinista", jornadaHs: 8, rendimiento: 0.15 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 0.5 },
    ],
  },
  {
    codigo: "2.6",
    descripcion: "RELLENO DE POZOS A MANO",
    capituloFallback: "Excavaciones y Movimientos de Tierra",
    materiales: [],
    equipos: [],
    manoObra: [
      { categoria: "Peón", jornadaHs: 8, rendimiento: 1.5 },
    ],
  },
  {
    codigo: "2.7",
    descripcion: "COMPACTACIÓN C/PLANCHA VIBRADORA",
    capituloFallback: "Excavaciones y Movimientos de Tierra",
    materiales: [],
    equipos: [
      { descripcion: "Plancha vibradora", unidad: "hs", rendimiento: 0.05 },
    ],
    manoObra: [
      { categoria: "Peón", jornadaHs: 8, rendimiento: 30 },
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

    // Reemplazar materiales, equipos y MO para que el script sea idempotente
    await p.materialAPUEstandar.deleteMany({ where: { apuId: apu.id } });
    await p.equipoAPUEstandar.deleteMany({ where: { apuId: apu.id } });
    await p.manoObraAPUEstandar.deleteMany({ where: { apuId: apu.id } });

    for (const m of def.materiales) {
      await p.materialAPUEstandar.create({
        data: { apuId: apu.id, descripcion: m.descripcion, unidad: m.unidad, rendimiento: m.rendimiento },
      });
    }
    for (const eq of def.equipos) {
      await p.equipoAPUEstandar.create({
        data: { apuId: apu.id, descripcion: eq.descripcion, unidad: eq.unidad, rendimiento: eq.rendimiento },
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
