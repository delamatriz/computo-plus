// Completa los 4 APUs estándar faltantes de Subcontratos - Yeso
// (emplacado, muro con aislación acústica, cielorraso de panel de
// yeso y lana de roca) en la base de PRODUCCIÓN.
// Ejecutar: DATABASE_URL="postgresql://..." npx tsx scripts/seed-apus-yeso-2.ts

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
    codigo: "7.6.1",
    descripcion: "EMPLACADO DE YESO PERFIL OMEGA + PLACA",
    capituloFallback: "Yeso",
    materiales: [
      { descripcion: "Placa Durlock 9.5mm", unidad: "m2", rendimiento: 1.05 },
      { descripcion: "Perfil metálico para cielorraso", unidad: "ml", rendimiento: 2.0 },
      { descripcion: "Tornillos autoperforantes Durlock", unidad: "u", rendimiento: 10 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 7 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 7 },
    ],
  },
  {
    codigo: "7.6.2",
    descripcion: "MURO DE YESO DE 10cm CON AISLACIÓN ACÚSTICA",
    capituloFallback: "Yeso",
    materiales: [
      { descripcion: "Placa Durlock 9.5mm", unidad: "m2", rendimiento: 2.10 },
      { descripcion: "Perfil metálico para tabique", unidad: "ml", rendimiento: 3.0 },
      { descripcion: "Lana de vidrio aislante", unidad: "m2", rendimiento: 1.0 },
      { descripcion: "Tornillos autoperforantes Durlock", unidad: "u", rendimiento: 24 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 4.5 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 4.5 },
    ],
  },
  {
    codigo: "7.6.3",
    descripcion: "CIELORRASO DE PANEL DE YESO",
    capituloFallback: "Yeso",
    materiales: [
      { descripcion: "Placa Durlock 9.5mm", unidad: "m2", rendimiento: 1.05 },
      { descripcion: "Perfil metálico para cielorraso", unidad: "ml", rendimiento: 2.5 },
      { descripcion: "Tornillos autoperforantes Durlock", unidad: "u", rendimiento: 12 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 6 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 6 },
    ],
  },
  {
    codigo: "7.6.4",
    descripcion: "LANA DE ROCA AISLANTE ACÚSTICO e=5mm",
    capituloFallback: "Yeso",
    materiales: [
      { descripcion: "Lana de roca aislante", unidad: "m2", rendimiento: 1.05 },
    ],
    manoObra: [
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
