// Completa los 20 APUs estándar faltantes de Instalación Sanitaria
// (cañerías de agua fría/caliente, desagües, artefactos, cámaras de
// inspección, bombas y calefones) en la base de PRODUCCIÓN.
// Ejecutar: DATABASE_URL="postgresql://..." npx tsx scripts/seed-apus-sanitaria-completo.ts

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
    codigo: "sanitaria-001",
    descripcion: "Cañería de agua fría PVC ø20mm",
    capituloFallback: "Sanitaria",
    materiales: [
      { descripcion: "Caño PVC presión 20mm", unidad: "ml", rendimiento: 1.10 },
      { descripcion: "Accesorios PVC sanitario", unidad: "gl", rendimiento: 0.05 },
    ],
    manoObra: [
      { categoria: "Plomero oficial", jornadaHs: 8, rendimiento: 20 },
    ],
  },
  {
    codigo: "sanitaria-002",
    descripcion: "Cañería de agua fría termofusión PPR ø20mm",
    capituloFallback: "Sanitaria",
    materiales: [
      { descripcion: "Caño termofusión 20mm agua fría", unidad: "ml", rendimiento: 1.10 },
      { descripcion: "Accesorios termofusión", unidad: "gl", rendimiento: 0.05 },
    ],
    manoObra: [
      { categoria: "Plomero oficial", jornadaHs: 8, rendimiento: 18 },
    ],
  },
  {
    codigo: "sanitaria-003",
    descripcion: "Cañería de agua caliente termofusión PPR ø20mm",
    capituloFallback: "Sanitaria",
    materiales: [
      { descripcion: "Caño termofusión 20mm agua caliente", unidad: "ml", rendimiento: 1.10 },
      { descripcion: "Accesorios termofusión", unidad: "gl", rendimiento: 0.05 },
    ],
    manoObra: [
      { categoria: "Plomero oficial", jornadaHs: 8, rendimiento: 18 },
    ],
  },
  {
    codigo: "sanitaria-004",
    descripcion: "Cañería de acero galvanizado ø1/2\"",
    capituloFallback: "Sanitaria",
    materiales: [
      { descripcion: "Caño acero galvanizado 1/2 pulgada", unidad: "ml", rendimiento: 1.10 },
      { descripcion: "Accesorios PVC sanitario", unidad: "gl", rendimiento: 0.08 },
    ],
    manoObra: [
      { categoria: "Plomero oficial", jornadaHs: 8, rendimiento: 12 },
    ],
  },
  {
    codigo: "sanitaria-005",
    descripcion: "Cañería de acero galvanizado ø3/4\"",
    capituloFallback: "Sanitaria",
    materiales: [
      { descripcion: "Caño acero galvanizado 3/4 pulgada", unidad: "ml", rendimiento: 1.10 },
      { descripcion: "Accesorios PVC sanitario", unidad: "gl", rendimiento: 0.08 },
    ],
    manoObra: [
      { categoria: "Plomero oficial", jornadaHs: 8, rendimiento: 10 },
    ],
  },
  {
    codigo: "sanitaria-006",
    descripcion: "Cañería de desagüe PVC ø110mm",
    capituloFallback: "Sanitaria",
    materiales: [
      { descripcion: "Caño PVC desagüe 110mm", unidad: "ml", rendimiento: 1.10 },
      { descripcion: "Accesorios PVC sanitario", unidad: "gl", rendimiento: 0.06 },
    ],
    manoObra: [
      { categoria: "Plomero oficial", jornadaHs: 8, rendimiento: 14 },
    ],
  },
  {
    codigo: "sanitaria-007",
    descripcion: "Cañería de desagüe PVC ø50mm",
    capituloFallback: "Sanitaria",
    materiales: [
      { descripcion: "Caño PVC desagüe 50mm", unidad: "ml", rendimiento: 1.10 },
      { descripcion: "Accesorios PVC sanitario", unidad: "gl", rendimiento: 0.05 },
    ],
    manoObra: [
      { categoria: "Plomero oficial", jornadaHs: 8, rendimiento: 18 },
    ],
  },
  {
    codigo: "sanitaria-008",
    descripcion: "Inodoro con mochila instalado",
    capituloFallback: "Sanitaria",
    materiales: [
      { descripcion: "Inodoro con mochila blanco", unidad: "u", rendimiento: 1 },
      { descripcion: "Accesorios de colocación sanitaria", unidad: "gl", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Plomero oficial", jornadaHs: 8, rendimiento: 4 },
    ],
  },
  {
    codigo: "sanitaria-009",
    descripcion: "Inodoro sin mochila con cisterna embutida",
    capituloFallback: "Sanitaria",
    materiales: [
      { descripcion: "Inodoro sin mochila", unidad: "u", rendimiento: 1 },
      { descripcion: "Cisterna embutida", unidad: "u", rendimiento: 1 },
      { descripcion: "Accesorios de colocación sanitaria", unidad: "gl", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Plomero oficial", jornadaHs: 8, rendimiento: 2.5 },
    ],
  },
  {
    codigo: "sanitaria-010",
    descripcion: "Inodoro sin mochila con cisterna de sobreponer",
    capituloFallback: "Sanitaria",
    materiales: [
      { descripcion: "Inodoro sin mochila", unidad: "u", rendimiento: 1 },
      { descripcion: "Cisterna de sobreponer", unidad: "u", rendimiento: 1 },
      { descripcion: "Accesorios de colocación sanitaria", unidad: "gl", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Plomero oficial", jornadaHs: 8, rendimiento: 3 },
    ],
  },
  {
    codigo: "sanitaria-011",
    descripcion: "Lavatorio instalado con grifería monocomando",
    capituloFallback: "Sanitaria",
    materiales: [
      { descripcion: "Lavatorio blanco", unidad: "u", rendimiento: 1 },
      { descripcion: "Mezcladora monocomando cocina", unidad: "u", rendimiento: 1 },
      { descripcion: "Accesorios de colocación sanitaria", unidad: "gl", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Plomero oficial", jornadaHs: 8, rendimiento: 4 },
    ],
  },
  {
    codigo: "sanitaria-012",
    descripcion: "Ducha con grifería monocomando",
    capituloFallback: "Sanitaria",
    materiales: [
      { descripcion: "Grifería monocomando ducha", unidad: "u", rendimiento: 1 },
      { descripcion: "Accesorios de colocación grifería", unidad: "gl", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Plomero oficial", jornadaHs: 8, rendimiento: 5 },
    ],
  },
  {
    codigo: "sanitaria-013",
    descripcion: "Bañera instalada con grifería",
    capituloFallback: "Sanitaria",
    materiales: [
      { descripcion: "Bañera estándar", unidad: "u", rendimiento: 1 },
      { descripcion: "Grifería monocomando ducha", unidad: "u", rendimiento: 1 },
      { descripcion: "Accesorios de colocación sanitaria", unidad: "gl", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Plomero oficial", jornadaHs: 8, rendimiento: 1.5 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 1.5 },
    ],
  },
  {
    codigo: "sanitaria-014",
    descripcion: "Cámara de inspección 60x60cm con sifón desconector",
    capituloFallback: "Sanitaria",
    materiales: [
      { descripcion: "Ladrillo común", unidad: "u", rendimiento: 80 },
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 15 },
      { descripcion: "Arena fina (en obra)", unidad: "m3", rendimiento: 0.04 },
      { descripcion: "Tapa y contratapa hierro fundido 60x60cm", unidad: "u", rendimiento: 1 },
      { descripcion: "Sifón desconector", unidad: "u", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 0.4 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 0.4 },
    ],
  },
  {
    codigo: "sanitaria-015",
    descripcion: "Cámara de inspección 60x60cm sin sifón",
    capituloFallback: "Sanitaria",
    materiales: [
      { descripcion: "Ladrillo común", unidad: "u", rendimiento: 80 },
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 15 },
      { descripcion: "Arena fina (en obra)", unidad: "m3", rendimiento: 0.04 },
      { descripcion: "Tapa y contratapa hierro fundido 60x60cm", unidad: "u", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 0.5 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 0.5 },
    ],
  },
  {
    codigo: "sanitaria-016",
    descripcion: "Bomba eléctrica de agua 1HP",
    capituloFallback: "Sanitaria",
    materiales: [
      { descripcion: "Bomba eléctrica de agua 1HP", unidad: "u", rendimiento: 1 },
      { descripcion: "Accesorios instalación bomba", unidad: "gl", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Plomero oficial", jornadaHs: 8, rendimiento: 1.5 },
      { categoria: "Electricista oficial", jornadaHs: 8, rendimiento: 1.5 },
    ],
  },
  {
    codigo: "sanitaria-017",
    descripcion: "Bomba eléctrica de agua 2HP",
    capituloFallback: "Sanitaria",
    materiales: [
      { descripcion: "Bomba eléctrica de agua 2HP", unidad: "u", rendimiento: 1 },
      { descripcion: "Accesorios instalación bomba", unidad: "gl", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Plomero oficial", jornadaHs: 8, rendimiento: 1.2 },
      { categoria: "Electricista oficial", jornadaHs: 8, rendimiento: 1.2 },
    ],
  },
  {
    codigo: "sanitaria-018",
    descripcion: "Tanque de agua 500L",
    capituloFallback: "Sanitaria",
    materiales: [
      { descripcion: "Tanque de agua 500 litros", unidad: "u", rendimiento: 1 },
      { descripcion: "Accesorios instalación tanque", unidad: "gl", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Plomero oficial", jornadaHs: 8, rendimiento: 2 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 2 },
    ],
  },
  {
    codigo: "sanitaria-019",
    descripcion: "Calefón a gas 10L",
    capituloFallback: "Sanitaria",
    materiales: [
      { descripcion: "Calefón a gas 10 litros", unidad: "u", rendimiento: 1 },
      { descripcion: "Accesorios instalación calefón", unidad: "gl", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Plomero oficial", jornadaHs: 8, rendimiento: 1.2 },
    ],
  },
  {
    codigo: "sanitaria-020",
    descripcion: "Calefón eléctrico 50L",
    capituloFallback: "Sanitaria",
    materiales: [
      { descripcion: "Termotanque eléctrico 80 litros", unidad: "u", rendimiento: 1 },
      { descripcion: "Accesorios instalación termotanque", unidad: "gl", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Plomero oficial", jornadaHs: 8, rendimiento: 1.0 },
      { categoria: "Electricista oficial", jornadaHs: 8, rendimiento: 1.0 },
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
