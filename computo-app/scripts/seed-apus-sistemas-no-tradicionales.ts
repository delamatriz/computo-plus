// Completa los 5 APUs estándar faltantes de Sistemas No Tradicionales
// (steel framing y paneles térmicos) en la base de PRODUCCIÓN.
// Ejecutar: DATABASE_URL="postgresql://..." npx tsx scripts/seed-apus-sistemas-no-tradicionales.ts

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
    codigo: "8.1.1",
    descripcion: "TECHO DE STEEL FRAMING",
    capituloFallback: "Sistemas No Tradicionales",
    materiales: [
      { descripcion: "Perfil galvanizado steel framing", unidad: "ml", rendimiento: 3 },
      { descripcion: "Placa OSB para steel framing", unidad: "m2", rendimiento: 1.05 },
      { descripcion: "Tornillos autoperforantes steel framing", unidad: "u", rendimiento: 20 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 8 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 8 },
    ],
  },
  {
    codigo: "8.1.2",
    descripcion: "PARED DE STEEL FRAMING",
    capituloFallback: "Sistemas No Tradicionales",
    materiales: [
      { descripcion: "Perfil galvanizado steel framing", unidad: "ml", rendimiento: 4 },
      { descripcion: "Placa OSB para steel framing", unidad: "m2", rendimiento: 2.10 },
      { descripcion: "Tornillos autoperforantes steel framing", unidad: "u", rendimiento: 24 },
      { descripcion: "Lana de vidrio aislante", unidad: "m2", rendimiento: 1.0 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 6 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 6 },
    ],
  },
  {
    codigo: "8.2.1",
    descripcion: "ISOPANEL",
    capituloFallback: "Sistemas No Tradicionales",
    materiales: [
      { descripcion: "Panel isopanel para cubierta", unidad: "m2", rendimiento: 1.05 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 16 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 16 },
    ],
  },
  {
    codigo: "8.2.2",
    descripcion: "ISODECK",
    capituloFallback: "Sistemas No Tradicionales",
    materiales: [
      { descripcion: "Panel isodeck", unidad: "m2", rendimiento: 1.05 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 14 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 14 },
    ],
  },
  {
    codigo: "8.2.3",
    descripcion: "MONTAJE DE PANELES DE POLIURETANO EXPANDIDO",
    capituloFallback: "Sistemas No Tradicionales",
    materiales: [
      { descripcion: "Poliuretano expandido e=3cm", unidad: "m2", rendimiento: 1.05 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 25 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 25 },
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
