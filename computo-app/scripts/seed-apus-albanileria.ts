// Carga los APUs estándar (materiales + mano de obra) de los subrubros de
// Albañilería del rubrado SAU en la base de PRODUCCIÓN.
// Ejecutar: DATABASE_URL="postgresql://..." npx tsx scripts/seed-apus-albanileria.ts

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

type MaterialDef = { descripcion: string; unidad: string; rendimiento: number };
type ManoObraDef = { categoria: string; jornadaHs: number; rendimiento: number };

type ApuDef = {
  codigo: string;
  descripcion: string; // usada como fallback de búsqueda si no hay match por código
  materiales: MaterialDef[];
  manoObra: ManoObraDef[];
};

const APUS: ApuDef[] = [
  // ── Muros de ticholo ──────────────────────────────────────
  {
    codigo: "6.1.9",
    descripcion: "MURO e=8cm (8x25x25cm)",
    materiales: [
      { descripcion: "Ticholo 8x25x25", unidad: "u", rendimiento: 16 },
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 4 },
      { descripcion: "Arena fina (en obra)", unidad: "m3", rendimiento: 0.008 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 16 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 16 },
    ],
  },
  {
    codigo: "6.1.10",
    descripcion: "MURO e=12cm (12x25x25cm)",
    materiales: [
      { descripcion: "Ticholo 12x25x25", unidad: "u", rendimiento: 16 },
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 5 },
      { descripcion: "Arena fina (en obra)", unidad: "m3", rendimiento: 0.010 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 14 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 14 },
    ],
  },
  {
    codigo: "6.1.11",
    descripcion: "MURO e=17cm (17x25x25)",
    materiales: [
      { descripcion: "Ticholo 17x25x25", unidad: "u", rendimiento: 16 },
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 6 },
      { descripcion: "Arena fina (en obra)", unidad: "m3", rendimiento: 0.012 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 12 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 12 },
    ],
  },
  {
    codigo: "6.1.12",
    descripcion: "MURO e=25cm (12x25x25cm doble)",
    materiales: [
      { descripcion: "Ticholo 12x25x25", unidad: "u", rendimiento: 32 },
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 8 },
      { descripcion: "Arena fina (en obra)", unidad: "m3", rendimiento: 0.016 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 10 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 10 },
    ],
  },

  // ── Muros con bloque de hormigón armado vibrado ───────────
  {
    codigo: "6.1.13",
    descripcion: "MURO e=20cm (19x19x39cm)",
    materiales: [
      { descripcion: "Bloque hormigón 19x19x39", unidad: "u", rendimiento: 12.5 },
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 8 },
      { descripcion: "Arena gruesa (en obra)", unidad: "m3", rendimiento: 0.025 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 10 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 10 },
    ],
  },
  {
    codigo: "6.1.14",
    descripcion: "MURO e=20cm DOS CARAS VISTAS (19x19x39cm)",
    materiales: [
      { descripcion: "Bloque hormigón 19x19x39", unidad: "u", rendimiento: 12.5 },
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 8 },
      { descripcion: "Arena gruesa (en obra)", unidad: "m3", rendimiento: 0.025 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 8 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 8 },
    ],
  },
  {
    codigo: "6.1.15",
    descripcion: "MURO e=12cm (12x19x39cm)",
    materiales: [
      { descripcion: "Bloque hormigón 12x19x39", unidad: "u", rendimiento: 12.5 },
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 6 },
      { descripcion: "Arena gruesa (en obra)", unidad: "m3", rendimiento: 0.018 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 12 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 12 },
    ],
  },
  {
    codigo: "6.1.16",
    descripcion: "MURO e=12cm DOS CARAS VISTAS (12x19x39cm)",
    materiales: [
      { descripcion: "Bloque hormigón 12x19x39", unidad: "u", rendimiento: 12.5 },
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 6 },
      { descripcion: "Arena gruesa (en obra)", unidad: "m3", rendimiento: 0.018 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 10 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 10 },
    ],
  },

  // ── Muros de ladrillo ──────────────────────────────────────
  {
    codigo: "6.1.1",
    descripcion: "MURO DOBLE e=30cm CON 1 CARA VISTA",
    materiales: [
      { descripcion: "Ladrillo común", unidad: "u", rendimiento: 60 },
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 12 },
      { descripcion: "Arena fina (en obra)", unidad: "m3", rendimiento: 0.030 },
      { descripcion: "Cal hidratada", unidad: "kg", rendimiento: 8 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 6 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 6 },
    ],
  },
  {
    codigo: "6.1.2",
    descripcion: "MURO e=25cm A REVOCAR",
    materiales: [
      { descripcion: "Ladrillo común", unidad: "u", rendimiento: 48 },
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 10 },
      { descripcion: "Arena fina (en obra)", unidad: "m3", rendimiento: 0.025 },
      { descripcion: "Cal hidratada", unidad: "kg", rendimiento: 6 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 8 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 8 },
    ],
  },
  {
    codigo: "6.1.3",
    descripcion: "MURO e=19cm A REVOCAR",
    materiales: [
      { descripcion: "Ladrillo común", unidad: "u", rendimiento: 36 },
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 8 },
      { descripcion: "Arena fina (en obra)", unidad: "m3", rendimiento: 0.020 },
      { descripcion: "Cal hidratada", unidad: "kg", rendimiento: 5 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 10 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 10 },
    ],
  },
  {
    codigo: "6.1.4",
    descripcion: "MURO e=12cm CON 1 CARA VISTA",
    materiales: [
      { descripcion: "Ladrillo común", unidad: "u", rendimiento: 24 },
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 6 },
      { descripcion: "Arena fina (en obra)", unidad: "m3", rendimiento: 0.015 },
      { descripcion: "Cal hidratada", unidad: "kg", rendimiento: 4 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 12 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 12 },
    ],
  },
  {
    codigo: "6.1.5",
    descripcion: "MURO e=12cm A REVOCAR",
    materiales: [
      { descripcion: "Ladrillo común", unidad: "u", rendimiento: 24 },
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 5 },
      { descripcion: "Arena fina (en obra)", unidad: "m3", rendimiento: 0.013 },
      { descripcion: "Cal hidratada", unidad: "kg", rendimiento: 3.5 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 14 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 14 },
    ],
  },
  {
    codigo: "6.1.6",
    descripcion: "MURO e=5.5cm A REVOCAR",
    materiales: [
      { descripcion: "Ladrillo común", unidad: "u", rendimiento: 12 },
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 3 },
      { descripcion: "Arena fina (en obra)", unidad: "m3", rendimiento: 0.008 },
      { descripcion: "Cal hidratada", unidad: "kg", rendimiento: 2 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 18 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 18 },
    ],
  },

  // ── Revoques ───────────────────────────────────────────────
  {
    codigo: "6.2.1",
    descripcion: "AZOTADA Y REVOQUE GRUESO PARA CIELORRASO",
    materiales: [
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 8 },
      { descripcion: "Arena fina (en obra)", unidad: "m3", rendimiento: 0.020 },
      { descripcion: "Cal hidratada", unidad: "kg", rendimiento: 3 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 10 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 10 },
    ],
  },
  {
    codigo: "6.2.2",
    descripcion: "REVOQUE FINO PARA CIELORRASO",
    materiales: [
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 4 },
      { descripcion: "Arena fina (en obra)", unidad: "m3", rendimiento: 0.008 },
      { descripcion: "Cal hidratada", unidad: "kg", rendimiento: 5 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 18 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 18 },
    ],
  },
  {
    codigo: "6.2.4",
    descripcion: "REVOQUE GRUESO MURO INTERIOR",
    materiales: [
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 6 },
      { descripcion: "Arena fina (en obra)", unidad: "m3", rendimiento: 0.015 },
      { descripcion: "Cal hidratada", unidad: "kg", rendimiento: 3 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 14 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 14 },
    ],
  },
  {
    codigo: "6.2.5",
    descripcion: "REVOQUE FINO MURO INTERIOR",
    materiales: [
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 3 },
      { descripcion: "Arena fina (en obra)", unidad: "m3", rendimiento: 0.006 },
      { descripcion: "Cal hidratada", unidad: "kg", rendimiento: 4 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 20 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 20 },
    ],
  },
  {
    codigo: "6.2.9",
    descripcion: "REVOQUE GRUESO MURO EXTERIOR",
    materiales: [
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 7 },
      { descripcion: "Arena fina (en obra)", unidad: "m3", rendimiento: 0.018 },
      { descripcion: "Cal hidratada", unidad: "kg", rendimiento: 3 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 12 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 12 },
    ],
  },
  {
    codigo: "6.2.10",
    descripcion: "REVOQUE FINO MURO EXTERIOR",
    materiales: [
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 4 },
      { descripcion: "Arena fina (en obra)", unidad: "m3", rendimiento: 0.008 },
      { descripcion: "Cal hidratada", unidad: "kg", rendimiento: 5 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 16 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 16 },
    ],
  },

  // ── Contrapisos ────────────────────────────────────────────
  {
    codigo: "6.3.1",
    descripcion: "CONTRAPISO SOBRE TIERRA DE BALASTO 10cm",
    materiales: [
      { descripcion: "Balasto (en obra)", unidad: "m3", rendimiento: 0.12 },
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 5 },
      { descripcion: "Arena gruesa (en obra)", unidad: "m3", rendimiento: 0.030 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 18 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 18 },
    ],
  },
  {
    codigo: "6.3.2",
    descripcion: "CONTRAPISO SOBRE LOSA DE HORMIGÓN e=5cm",
    materiales: [
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 6 },
      { descripcion: "Arena gruesa (en obra)", unidad: "m3", rendimiento: 0.025 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 22 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 22 },
    ],
  },
];

async function buscarSubrubro(def: ApuDef) {
  const porCodigo = await p.subrubroEstandar.findUnique({ where: { codigo: def.codigo } });
  if (porCodigo) return porCodigo;

  return p.subrubroEstandar.findFirst({
    where: {
      capitulo: { contains: "Alba", mode: "insensitive" },
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
