// Completa los 16 APUs estándar faltantes de Subcontratos -
// Acondicionamientos (mesadas en piedra, piso técnico, cortinas, césped
// artificial, deck, baldosas, piscina, toldo y ascensores) en la base
// de PRODUCCIÓN.
// Ejecutar: DATABASE_URL="postgresql://..." npx tsx scripts/seed-apus-acondicionamientos-completo.ts

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
    codigo: "7.2.12",
    descripcion: "MÁRMOL TRAVERTINO MESADA",
    capituloFallback: "Acondicionamientos",
    materiales: [
      { descripcion: "Mármol travertino mesada", unidad: "m2", rendimiento: 1.05 },
      { descripcion: "Sellador para granito", unidad: "l", rendimiento: 0.2 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 2.5 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 2.5 },
    ],
  },
  {
    codigo: "7.2.13",
    descripcion: "MÁRMOL BLANCO CARRARA MESADA",
    capituloFallback: "Acondicionamientos",
    materiales: [
      { descripcion: "Mármol blanco Carrara mesada", unidad: "m2", rendimiento: 1.05 },
      { descripcion: "Sellador para granito", unidad: "l", rendimiento: 0.2 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 2.5 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 2.5 },
    ],
  },
  {
    codigo: "7.2.14",
    descripcion: "SILESTONE BLANCO MESADA",
    capituloFallback: "Acondicionamientos",
    materiales: [
      { descripcion: "Silestone blanco mesada", unidad: "m2", rendimiento: 1.05 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 3.0 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 3.0 },
    ],
  },
  {
    codigo: "7.2.15",
    descripcion: "DEKTON NATURA MESADA",
    capituloFallback: "Acondicionamientos",
    materiales: [
      { descripcion: "Dekton Natura mesada", unidad: "m2", rendimiento: 1.05 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 3.0 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 3.0 },
    ],
  },
  {
    codigo: "7.2.18",
    descripcion: "PISO TÉCNICO CON COLOCACIÓN",
    capituloFallback: "Acondicionamientos",
    materiales: [
      { descripcion: "Panel piso técnico", unidad: "m2", rendimiento: 1.05 },
      { descripcion: "Pedestal regulable para piso técnico", unidad: "u", rendimiento: 4 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 8 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 8 },
    ],
  },
  {
    codigo: "7.2.21",
    descripcion: "CORTINA TIPO BLACKOUT MANUAL",
    capituloFallback: "Acondicionamientos",
    materiales: [
      { descripcion: "Cortina blackout manual", unidad: "m2", rendimiento: 1.05 },
      { descripcion: "Riel para cortina", unidad: "ml", rendimiento: 0.8 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 8 },
    ],
  },
  {
    codigo: "7.2.22",
    descripcion: "CORTINA VENECIANA PARA INTERIOR MANUAL",
    capituloFallback: "Acondicionamientos",
    materiales: [
      { descripcion: "Cortina veneciana interior", unidad: "m2", rendimiento: 1.05 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 10 },
    ],
  },
  {
    codigo: "7.2.23",
    descripcion: "CÉSPED ARTIFICIAL H=20MM",
    capituloFallback: "Acondicionamientos",
    materiales: [
      { descripcion: "Césped artificial h=20mm", unidad: "m2", rendimiento: 1.10 },
      { descripcion: "Arena de sílice para relleno", unidad: "kg", rendimiento: 5 },
    ],
    manoObra: [
      { categoria: "Peón", jornadaHs: 8, rendimiento: 15 },
    ],
  },
  {
    codigo: "7.2.24",
    descripcion: "DECK DE MADERA",
    capituloFallback: "Acondicionamientos",
    materiales: [
      { descripcion: "Tabla de deck de madera", unidad: "m2", rendimiento: 1.10 },
      { descripcion: "Estructura de soporte para deck", unidad: "ml", rendimiento: 2.5 },
      { descripcion: "Tornillos para deck", unidad: "u", rendimiento: 20 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 6 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 6 },
    ],
  },
  {
    codigo: "7.2.25",
    descripcion: "BALDOSAS GREEN BLOCK",
    capituloFallback: "Acondicionamientos",
    materiales: [
      { descripcion: "Baldosa Green Block", unidad: "m2", rendimiento: 1.05 },
      { descripcion: "Arena gruesa (en obra)", unidad: "m3", rendimiento: 0.03 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 12 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 12 },
    ],
  },
  {
    codigo: "7.2.26",
    descripcion: "BALDOSA DE CAUCHO RECICLADO 50X50cm",
    capituloFallback: "Acondicionamientos",
    materiales: [
      { descripcion: "Baldosa de caucho reciclado 50x50cm", unidad: "m2", rendimiento: 1.05 },
      { descripcion: "Adhesivo para caucho", unidad: "kg", rendimiento: 0.5 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 14 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 14 },
    ],
  },
  {
    codigo: "7.2.27",
    descripcion: "PISCINA DE 7.5x3.5x1.4m DE POLIESTER",
    capituloFallback: "Acondicionamientos",
    materiales: [
      { descripcion: "Piscina de poliéster 7.5x3.5x1.4m", unidad: "u", rendimiento: 1 },
      { descripcion: "Equipo de filtrado para piscina", unidad: "u", rendimiento: 1 },
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 400 },
      { descripcion: "Balasto (en obra)", unidad: "m3", rendimiento: 2 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 0.05 },
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 0.05 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 0.05 },
    ],
  },
  {
    codigo: "7.2.28",
    descripcion: "TOLDO VERTICAL EXTERIOR MANUAL",
    capituloFallback: "Acondicionamientos",
    materiales: [
      { descripcion: "Toldo vertical manual", unidad: "m2", rendimiento: 1.05 },
      { descripcion: "Soporte para toldo", unidad: "u", rendimiento: 0.3 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 6 },
    ],
  },
  {
    codigo: "7.2.29",
    descripcion: "CORTINA VENECIANA PARA EXTERIOR MANUAL",
    capituloFallback: "Acondicionamientos",
    materiales: [
      { descripcion: "Cortina veneciana exterior", unidad: "m2", rendimiento: 1.05 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 8 },
    ],
  },
  {
    codigo: "7.2.30",
    descripcion: "ASCENSOR PARA 8 PERSONAS 12 PARADAS",
    capituloFallback: "Acondicionamientos",
    materiales: [
      { descripcion: "Ascensor 8 personas 12 paradas", unidad: "gl", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 0.02 },
    ],
  },
  {
    codigo: "7.2.31",
    descripcion: "ASCENSOR PARA 6 PERSONAS 5 PARADAS",
    capituloFallback: "Acondicionamientos",
    materiales: [
      { descripcion: "Ascensor 6 personas 5 paradas", unidad: "gl", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 0.02 },
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
