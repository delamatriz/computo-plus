// Carga los APUs estándar (materiales + mano de obra) de los subrubros de
// Implantación y Replanteo, Excavaciones y Movimiento de Tierra, y
// Demoliciones y Picados del rubrado SAU en la base de PRODUCCIÓN.
// Ejecutar: DATABASE_URL="postgresql://..." npx tsx scripts/seed-apus-excavaciones-demoliciones.ts

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
  // ── Implantación y Replanteo ───────────────────────────────
  {
    codigo: "1.2",
    descripcion: "LIMPIEZA TERRENO SIN RETIRO DE ÁRBOLES",
    capituloFallback: "Implantación y Replanteo",
    materiales: [],
    manoObra: [
      { categoria: "Peón", jornadaHs: 8, rendimiento: 80 },
    ],
  },
  {
    codigo: "1.4",
    descripcion: "REPLANTEO GRAL DE OBRA",
    capituloFallback: "Implantación y Replanteo",
    materiales: [
      { descripcion: "Estacas de madera", unidad: "u", rendimiento: 0.5 },
      { descripcion: "Hilo de nylon", unidad: "m", rendimiento: 1.5 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 100 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 100 },
    ],
  },

  // ── Excavaciones y Movimiento de Tierra ────────────────────
  {
    codigo: "2.1",
    descripcion: "DESMONTE Y LIMPIEZA A MANO",
    capituloFallback: "Excavaciones y Movimiento de Tierra",
    materiales: [],
    manoObra: [
      { categoria: "Peón", jornadaHs: 8, rendimiento: 3.0 },
    ],
  },
  {
    codigo: "2.2",
    descripcion: "EXCAVACIÓN ZANJAS HASTA 1.5M",
    capituloFallback: "Excavaciones y Movimiento de Tierra",
    materiales: [],
    manoObra: [
      { categoria: "Peón", jornadaHs: 8, rendimiento: 1.5 },
    ],
  },
  {
    codigo: "2.3",
    descripcion: "EXCAVACIÓN EN TIERRA HASTA 2M",
    capituloFallback: "Excavaciones y Movimiento de Tierra",
    materiales: [],
    manoObra: [
      { categoria: "Peón", jornadaHs: 8, rendimiento: 1.0 },
    ],
  },
  {
    codigo: "2.5",
    descripcion: "RELLENO DE ZANJAS A MANO",
    capituloFallback: "Excavaciones y Movimiento de Tierra",
    materiales: [],
    manoObra: [
      { categoria: "Peón", jornadaHs: 8, rendimiento: 2.0 },
    ],
  },
  {
    codigo: "2.8",
    descripcion: "CARGA A MANO CAMIÓN O VOLQUETA",
    capituloFallback: "Excavaciones y Movimiento de Tierra",
    materiales: [],
    manoObra: [
      { categoria: "Peón", jornadaHs: 8, rendimiento: 2.5 },
    ],
  },

  // ── Demoliciones y Picados ──────────────────────────────────
  {
    codigo: "3.1",
    descripcion: "DEMOLICIÓN DE LOSA DE HORMIGÓN ARMADO",
    capituloFallback: "Demoliciones y Picados",
    materiales: [],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 0.5 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 0.5 },
    ],
  },
  {
    codigo: "3.2",
    descripcion: "DEMOLICIÓN DE VIGAS Y PILARES DE HORMIGÓN ARMADO",
    capituloFallback: "Demoliciones y Picados",
    materiales: [],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 0.4 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 0.4 },
    ],
  },
  {
    codigo: "3.3",
    descripcion: "DEMOLICIÓN DE MURO DE HORMIGÓN ARMADO",
    capituloFallback: "Demoliciones y Picados",
    materiales: [],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 0.35 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 0.35 },
    ],
  },
  {
    codigo: "3.4",
    descripcion: "DEMOLICIÓN DE MURO MACIZO",
    capituloFallback: "Demoliciones y Picados",
    materiales: [],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 0.8 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 0.8 },
    ],
  },
  {
    codigo: "3.5",
    descripcion: "RETIRO DE ABERTURAS",
    capituloFallback: "Demoliciones y Picados",
    materiales: [],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 8 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 8 },
    ],
  },
  {
    codigo: "3.6",
    descripcion: "PICADO DE REVOQUES EN MUROS",
    capituloFallback: "Demoliciones y Picados",
    materiales: [],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 12 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 12 },
    ],
  },
  {
    codigo: "3.7",
    descripcion: "DEMOLICIÓN DE PAVIMENTOS e=10cm",
    capituloFallback: "Demoliciones y Picados",
    materiales: [],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 6 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 6 },
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
