// Carga los APUs estándar (materiales + mano de obra) de Carpintería
// Metálica y Cubierta Metálica del rubrado SAU en la base de PRODUCCIÓN.
//
// A diferencia de los scripts anteriores, estos subrubros NO existen
// en SubrubroEstandar — se crean primero (idempotente, por código) y
// luego se les carga el APUEstandar. Para los 3 ítems que sí tienen
// equivalente real en la biblioteca (chapa galvanizada acanalada,
// chapa prepintada, bajada pluvial PVC) se reusan sus códigos reales
// "cubierta-004", "cubierta-006" y "cubierta-012" en vez de crear
// duplicados.
//
// Ejecutar: DATABASE_URL="postgresql://..." npx tsx scripts/seed-apus-carpinteria-metalica.ts

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

type MaterialDef = { descripcion: string; unidad: string; rendimiento: number };
type ManoObraDef = { categoria: string; jornadaHs: number; rendimiento: number };

type ApuDef = {
  codigo: string;
  descripcion: string;
  unidad: string;
  capitulo: string;
  crearSubrubro: boolean; // false = el código ya existe en SubrubroEstandar (reuso real)
  materiales: MaterialDef[];
  manoObra: ManoObraDef[];
};

const APUS: ApuDef[] = [
  // ── Carpintería metálica — sin equivalente real, se crea el subrubro ──
  {
    codigo: "carpmet-001",
    descripcion: "PUERTA METÁLICA CHAPA PLEGADA 0.90x2.10m",
    unidad: "UNI",
    capitulo: "Subcontratos - Carpinterías",
    crearSubrubro: true,
    materiales: [
      { descripcion: "Puerta metálica chapa plegada 0.90x2.10m", unidad: "u", rendimiento: 1 },
      { descripcion: "Tornillos y herrajes metálicos", unidad: "gl", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 1.0 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 1.0 },
    ],
  },
  {
    codigo: "carpmet-002",
    descripcion: "VENTANA METÁLICA CORREDIZA 1.20x1.10m",
    unidad: "UNI",
    capitulo: "Subcontratos - Carpinterías",
    crearSubrubro: true,
    materiales: [
      { descripcion: "Ventana metálica corrediza 1.20x1.10m", unidad: "u", rendimiento: 1 },
      { descripcion: "Silicona para ventanas", unidad: "u", rendimiento: 1 },
      { descripcion: "Tornillos y herrajes metálicos", unidad: "gl", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 1.5 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 1.5 },
    ],
  },
  {
    codigo: "carpmet-003",
    descripcion: "VENTANA METÁLICA CORREDIZA 1.50x1.10m",
    unidad: "UNI",
    capitulo: "Subcontratos - Carpinterías",
    crearSubrubro: true,
    materiales: [
      { descripcion: "Ventana metálica corrediza 1.50x1.10m", unidad: "u", rendimiento: 1 },
      { descripcion: "Silicona para ventanas", unidad: "u", rendimiento: 1 },
      { descripcion: "Tornillos y herrajes metálicos", unidad: "gl", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 1.5 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 1.5 },
    ],
  },
  {
    codigo: "carpmet-004",
    descripcion: "PORTÓN METÁLICO CORREDIZO 3.00x2.10m",
    unidad: "UNI",
    capitulo: "Subcontratos - Carpinterías",
    crearSubrubro: true,
    materiales: [
      { descripcion: "Portón metálico corredizo 3.00x2.10m", unidad: "u", rendimiento: 1 },
      { descripcion: "Riel y guía para portón corredizo", unidad: "u", rendimiento: 1 },
      { descripcion: "Tornillos y herrajes metálicos", unidad: "gl", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 0.5 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 0.5 },
    ],
  },
  {
    codigo: "carpmet-005",
    descripcion: "REJA METÁLICA TUBULAR",
    unidad: "M2",
    capitulo: "Subcontratos - Carpinterías",
    crearSubrubro: true,
    materiales: [
      { descripcion: "Tubo cuadrado acero 25x25x2mm", unidad: "kg", rendimiento: 8 },
      { descripcion: "Pintura anticorrosiva", unidad: "l", rendimiento: 0.3 },
      { descripcion: "Electrodos de soldadura", unidad: "u", rendimiento: 5 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 2.0 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 2.0 },
    ],
  },
  {
    codigo: "carpmet-006",
    descripcion: "BARANDA METÁLICA TUBULAR",
    unidad: "ML",
    capitulo: "Subcontratos - Carpinterías",
    crearSubrubro: true,
    materiales: [
      { descripcion: "Tubo redondo acero 38mm", unidad: "ml", rendimiento: 2.5 },
      { descripcion: "Pintura anticorrosiva", unidad: "l", rendimiento: 0.15 },
      { descripcion: "Electrodos de soldadura", unidad: "u", rendimiento: 3 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 4.0 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 4.0 },
    ],
  },

  // ── Cubierta metálica — sin equivalente real, se crea el subrubro ──
  {
    codigo: "cubierta-013",
    descripcion: "ESTRUCTURA METÁLICA PARA CUBIERTA",
    unidad: "KG",
    capitulo: "Cubierta / Techos",
    crearSubrubro: true,
    materiales: [
      { descripcion: "Perfil metálico para estructura", unidad: "kg", rendimiento: 1.05 },
      { descripcion: "Pintura anticorrosiva", unidad: "l", rendimiento: 0.05 },
      { descripcion: "Electrodos de soldadura", unidad: "u", rendimiento: 0.3 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 30 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 30 },
    ],
  },
  {
    codigo: "cubierta-014",
    descripcion: "CANALÓN DE CHAPA GALVANIZADA",
    unidad: "ML",
    capitulo: "Cubierta / Techos",
    crearSubrubro: true,
    materiales: [
      { descripcion: "Canalón de chapa galvanizada", unidad: "ml", rendimiento: 1.05 },
      { descripcion: "Soporte para canalón", unidad: "u", rendimiento: 0.5 },
      { descripcion: "Sellador para canalones", unidad: "u", rendimiento: 0.2 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 15 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 15 },
    ],
  },

  // ── Cubierta — con equivalente real, se reusa el código existente ──
  {
    codigo: "cubierta-004",
    descripcion: "Cubierta de chapa galvanizada acanalada",
    unidad: "M2",
    capitulo: "Cubierta / Techos",
    crearSubrubro: false,
    materiales: [
      { descripcion: "Chapa acanalada galvanizada N°27", unidad: "m2", rendimiento: 1.10 },
      { descripcion: "Tornillos autoperforantes para chapa", unidad: "u", rendimiento: 8 },
      { descripcion: "Bulon con arandela de goma", unidad: "u", rendimiento: 4 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 12 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 12 },
    ],
  },
  {
    codigo: "cubierta-006",
    descripcion: "Cubierta de chapa prepintada",
    unidad: "M2",
    capitulo: "Cubierta / Techos",
    crearSubrubro: false,
    materiales: [
      { descripcion: "Chapa acanalada prepintada N°27", unidad: "m2", rendimiento: 1.10 },
      { descripcion: "Tornillos autoperforantes para chapa", unidad: "u", rendimiento: 8 },
      { descripcion: "Bulon con arandela de goma", unidad: "u", rendimiento: 4 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 12 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 12 },
    ],
  },
  {
    codigo: "cubierta-012",
    descripcion: "Bajada pluvial de PVC ø110mm",
    unidad: "ML",
    capitulo: "Cubierta / Techos",
    crearSubrubro: false,
    materiales: [
      { descripcion: "Caño PVC bajada pluvial 110mm", unidad: "ml", rendimiento: 1.05 },
      { descripcion: "Abrazadera para bajada PVC", unidad: "u", rendimiento: 0.5 },
      { descripcion: "Accesorios PVC pluvial", unidad: "gl", rendimiento: 0.1 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 20 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 20 },
    ],
  },
];

async function main() {
  let subrubrosCreados = 0;
  let creados = 0;
  let actualizados = 0;
  let noEncontrados = 0;

  for (const def of APUS) {
    let subrubro = await p.subrubroEstandar.findUnique({ where: { codigo: def.codigo } });

    if (!subrubro && def.crearSubrubro) {
      subrubro = await p.subrubroEstandar.create({
        data: {
          codigo: def.codigo,
          capitulo: def.capitulo,
          descripcion: def.descripcion,
          unidad: def.unidad,
          precioUY: 0,
          origen: "manual",
        },
      });
      console.log(`+ Creado SubrubroEstandar — ${def.codigo} (${def.descripcion})`);
      subrubrosCreados++;
    }

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
  console.log(`SubrubroEstandar creados: ${subrubrosCreados}`);
  console.log(`APUEstandar creados:      ${creados}`);
  console.log(`APUEstandar actualizados: ${actualizados}`);
  console.log(`No encontrados:           ${noEncontrados}`);
  console.log(`Total definidos:          ${APUS.length}`);

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
