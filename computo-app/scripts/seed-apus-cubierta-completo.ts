// Completa los 9 APUs estándar faltantes de Cubierta / Techos (tejas,
// chapa galvanizada, policarbonato, isopanel, membrana asfáltica,
// estructura de madera y canaleta) en la base de PRODUCCIÓN.
// Ejecutar: DATABASE_URL="postgresql://..." npx tsx scripts/seed-apus-cubierta-completo.ts

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
    codigo: "cubierta-001",
    descripcion: "Cubierta de teja colonial sobre estructura de madera",
    capituloFallback: "Cubierta",
    materiales: [
      { descripcion: "Teja colonial", unidad: "u", rendimiento: 16 },
      { descripcion: "Listón de madera para teja", unidad: "ml", rendimiento: 3 },
      { descripcion: "Clavos para teja", unidad: "kg", rendimiento: 0.1 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 10 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 10 },
    ],
  },
  {
    codigo: "cubierta-002",
    descripcion: "Cubierta de teja colonial sobre losa",
    capituloFallback: "Cubierta",
    materiales: [
      { descripcion: "Teja colonial", unidad: "u", rendimiento: 16 },
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 3 },
      { descripcion: "Arena fina (en obra)", unidad: "m3", rendimiento: 0.008 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 10 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 10 },
    ],
  },
  {
    codigo: "cubierta-003",
    descripcion: "Cubierta de teja francesa sobre estructura de madera",
    capituloFallback: "Cubierta",
    materiales: [
      { descripcion: "Teja francesa", unidad: "u", rendimiento: 14 },
      { descripcion: "Listón de madera para teja", unidad: "ml", rendimiento: 3 },
      { descripcion: "Clavos para teja", unidad: "kg", rendimiento: 0.1 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 9 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 9 },
    ],
  },
  {
    codigo: "cubierta-005",
    descripcion: "Cubierta de chapa galvanizada trapezoidal",
    capituloFallback: "Cubierta",
    materiales: [
      { descripcion: "Chapa trapezoidal galvanizada", unidad: "m2", rendimiento: 1.10 },
      { descripcion: "Tornillos autoperforantes para chapa", unidad: "u", rendimiento: 8 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 14 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 14 },
    ],
  },
  {
    codigo: "cubierta-007",
    descripcion: "Cubierta de policarbonato alveolar",
    capituloFallback: "Cubierta",
    materiales: [
      { descripcion: "Plancha policarbonato alveolar", unidad: "m2", rendimiento: 1.10 },
      { descripcion: "Perfil de unión para policarbonato", unidad: "ml", rendimiento: 1.0 },
      { descripcion: "Tornillos autoperforantes para chapa", unidad: "u", rendimiento: 6 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 12 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 12 },
    ],
  },
  {
    codigo: "cubierta-008",
    descripcion: "Cubierta de isopanel",
    capituloFallback: "Cubierta",
    materiales: [
      { descripcion: "Panel isopanel para cubierta", unidad: "m2", rendimiento: 1.05 },
      { descripcion: "Tornillos autoperforantes para chapa", unidad: "u", rendimiento: 6 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 16 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 16 },
    ],
  },
  {
    codigo: "cubierta-009",
    descripcion: "Membrana asfáltica sobre losa",
    capituloFallback: "Cubierta",
    materiales: [
      { descripcion: "Membrana asfáltica con geotextil", unidad: "m2", rendimiento: 1.10 },
      { descripcion: "Imprimación asfáltica", unidad: "l", rendimiento: 0.3 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 18 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 18 },
    ],
  },
  {
    codigo: "cubierta-010",
    descripcion: "Estructura de madera para techo (pares, cumbreras, correas)",
    capituloFallback: "Cubierta",
    materiales: [
      { descripcion: "Madera para estructura de techo", unidad: "m2", rendimiento: 0.04 },
      { descripcion: "Clavos para estructura", unidad: "kg", rendimiento: 0.15 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 12 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 12 },
    ],
  },
  {
    codigo: "cubierta-011",
    descripcion: "Canaleta de zinc desarrollado 50cm",
    capituloFallback: "Cubierta",
    materiales: [
      { descripcion: "Canalón de chapa galvanizada", unidad: "ml", rendimiento: 1.05 },
      { descripcion: "Soporte para canalón", unidad: "u", rendimiento: 0.5 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 15 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 15 },
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
