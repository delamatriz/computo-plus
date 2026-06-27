// Carga los APUs estándar (materiales + mano de obra) de subrubros de
// Instalación Sanitaria, Instalación Eléctrica e Instalación Térmica /
// Aire Acondicionado del rubrado SAU en la base de PRODUCCIÓN.
// Ejecutar: DATABASE_URL="postgresql://..." npx tsx scripts/seed-apus-sanitaria.ts

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
  // ── Instalación Sanitaria ───────────────────────────────────
  {
    codigo: "7.2.1",
    descripcion: "BAÑO COMPLETO",
    capituloFallback: "Instalación Sanitaria",
    materiales: [
      { descripcion: "Caño PVC desagüe 110mm", unidad: "ml", rendimiento: 8 },
      { descripcion: "Caño PVC desagüe 50mm", unidad: "ml", rendimiento: 6 },
      { descripcion: "Caño termofusión 20mm agua fría", unidad: "ml", rendimiento: 10 },
      { descripcion: "Caño termofusión 20mm agua caliente", unidad: "ml", rendimiento: 10 },
      { descripcion: "Accesorios PVC sanitario", unidad: "gl", rendimiento: 1 },
      { descripcion: "Accesorios termofusión", unidad: "gl", rendimiento: 1 },
      { descripcion: "Sellador sanitario", unidad: "gl", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Plomero oficial", jornadaHs: 8, rendimiento: 0.15 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 0.15 },
    ],
  },
  {
    codigo: "7.2.2",
    descripcion: "COCINA COMPLETA",
    capituloFallback: "Instalación Sanitaria",
    materiales: [
      { descripcion: "Caño PVC desagüe 110mm", unidad: "ml", rendimiento: 4 },
      { descripcion: "Caño PVC desagüe 50mm", unidad: "ml", rendimiento: 4 },
      { descripcion: "Caño termofusión 20mm agua fría", unidad: "ml", rendimiento: 6 },
      { descripcion: "Caño termofusión 20mm agua caliente", unidad: "ml", rendimiento: 6 },
      { descripcion: "Accesorios PVC sanitario", unidad: "gl", rendimiento: 1 },
      { descripcion: "Accesorios termofusión", unidad: "gl", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Plomero oficial", jornadaHs: 8, rendimiento: 0.25 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 0.25 },
    ],
  },
  {
    codigo: "7.2.3",
    descripcion: "INODORO CON MOCHILA, BIDET Y LAVABO BLANCO",
    capituloFallback: "Instalación Sanitaria",
    materiales: [
      { descripcion: "Inodoro con mochila blanco", unidad: "u", rendimiento: 1 },
      { descripcion: "Bidet blanco", unidad: "u", rendimiento: 1 },
      { descripcion: "Lavatorio blanco", unidad: "u", rendimiento: 1 },
      { descripcion: "Accesorios de colocación sanitaria", unidad: "gl", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Plomero oficial", jornadaHs: 8, rendimiento: 0.5 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 0.5 },
    ],
  },
  {
    codigo: "7.2.4",
    descripcion: "JUEGO DE GRIFERÍA MONOCOMANDO",
    capituloFallback: "Instalación Sanitaria",
    materiales: [
      { descripcion: "Grifería monocomando lavatorio", unidad: "u", rendimiento: 1 },
      { descripcion: "Grifería monocomando bidet", unidad: "u", rendimiento: 1 },
      { descripcion: "Grifería monocomando ducha", unidad: "u", rendimiento: 1 },
      { descripcion: "Accesorios de colocación grifería", unidad: "gl", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Plomero oficial", jornadaHs: 8, rendimiento: 1.0 },
    ],
  },
  {
    codigo: "7.2.5",
    descripcion: "PILETA Y MEDIA DE COCINA ACERO INOXIDABLE",
    capituloFallback: "Instalación Sanitaria",
    materiales: [
      { descripcion: "Pileta y media acero inoxidable", unidad: "u", rendimiento: 1 },
      { descripcion: "Accesorios de colocación pileta", unidad: "gl", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Plomero oficial", jornadaHs: 8, rendimiento: 2.0 },
    ],
  },
  {
    codigo: "7.2.8",
    descripcion: "CÁMARA DE INSPECCIÓN 60x60cm",
    capituloFallback: "Instalación Sanitaria",
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

  // ── Instalación Eléctrica ────────────────────────────────────
  {
    codigo: "7.2.17",
    descripcion: "VALOR MEDIO PUESTA ELÉCTRICA O DE DATOS",
    capituloFallback: "Instalación Eléctrica",
    materiales: [
      { descripcion: "Caja de embutir rectangular", unidad: "u", rendimiento: 1 },
      { descripcion: "Cable eléctrico 2.5mm", unidad: "ml", rendimiento: 3 },
      { descripcion: "Tomacorriente o interruptor", unidad: "u", rendimiento: 1 },
      { descripcion: "Conduit PVC 20mm", unidad: "ml", rendimiento: 2 },
    ],
    manoObra: [
      { categoria: "Electricista oficial", jornadaHs: 8, rendimiento: 4 },
    ],
  },

  // ── Instalación Térmica / Aire Acondicionado ─────────────────
  {
    codigo: "7.2.19",
    descripcion: "EQUIPO SPLIT 9000BTU INVERTER CON INSTALACIÓN",
    capituloFallback: "Instalación Térmica / Aire Acondicionado",
    materiales: [
      { descripcion: "Equipo split 9000 BTU inverter", unidad: "u", rendimiento: 1 },
      { descripcion: "Caño cobre 1/4 y 3/8", unidad: "ml", rendimiento: 3 },
      { descripcion: "Soporte mural exterior", unidad: "u", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 0.5 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 0.5 },
    ],
  },
  {
    codigo: "7.2.20",
    descripcion: "EQUIPO SPLIT 12000BTU INVERTER CON INSTALACIÓN",
    capituloFallback: "Instalación Térmica / Aire Acondicionado",
    materiales: [
      { descripcion: "Equipo split 12000 BTU inverter", unidad: "u", rendimiento: 1 },
      { descripcion: "Caño cobre 1/4 y 3/8", unidad: "ml", rendimiento: 3 },
      { descripcion: "Soporte mural exterior", unidad: "u", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 0.5 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 0.5 },
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
