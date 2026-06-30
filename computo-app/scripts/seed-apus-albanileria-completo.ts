// Completa los 29 APUs estándar faltantes de Albañilería
// (aplacados, ladrillo de vidrio, buñas, contrapisos, pisos, zócalos,
// revestimientos e impermeabilizaciones) en la base de PRODUCCIÓN.
// Ejecutar: DATABASE_URL="postgresql://..." npx tsx scripts/seed-apus-albanileria-completo.ts

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
    codigo: "6.1.7",
    descripcion: "APLACADO DE MURO CON CHORIZO",
    capituloFallback: "Alba",
    materiales: [
      { descripcion: "Ladrillo tipo chorizo", unidad: "u", rendimiento: 30 },
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 5 },
      { descripcion: "Arena fina (en obra)", unidad: "m3", rendimiento: 0.012 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 6 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 6 },
    ],
  },
  {
    codigo: "6.1.8",
    descripcion: "APLACADO DE MURO CON LADRILLO A ESPEJO",
    capituloFallback: "Alba",
    materiales: [
      { descripcion: "Ladrillo de primera", unidad: "u", rendimiento: 30 },
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 5 },
      { descripcion: "Arena fina (en obra)", unidad: "m3", rendimiento: 0.012 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 5 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 5 },
    ],
  },
  {
    codigo: "6.1.17",
    descripcion: "MURO DE LADRILLO DE VIDRIO DE 19x19X8cm",
    capituloFallback: "Alba",
    materiales: [
      { descripcion: "Ladrillo de vidrio 19x19x8cm", unidad: "u", rendimiento: 25 },
      { descripcion: "Cemento blanco", unidad: "kg", rendimiento: 4 },
      { descripcion: "Varilla de armado para vidrio", unidad: "ml", rendimiento: 2 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 4 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 4 },
    ],
  },
  {
    codigo: "6.1.18",
    descripcion: "ACUÑADO DE MUROS CON POLIURETANO",
    capituloFallback: "Alba",
    materiales: [
      { descripcion: "Espuma de poliuretano en aerosol", unidad: "u", rendimiento: 0.3 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 30 },
    ],
  },
  {
    codigo: "6.2.15",
    descripcion: "BUÑAS",
    capituloFallback: "Alba",
    materiales: [
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 0.5 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 40 },
    ],
  },
  {
    codigo: "6.2.16",
    descripcion: "ARENA Y PORTLAND LUSTRADO PARA TANQUES DE AGUA",
    capituloFallback: "Alba",
    materiales: [
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 6 },
      { descripcion: "Arena fina (en obra)", unidad: "m3", rendimiento: 0.012 },
      { descripcion: "Hidrófugo líquido", unidad: "l", rendimiento: 0.3 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 10 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 10 },
    ],
  },
  {
    codigo: "6.3.3",
    descripcion: "CONTRAPISO SOBRE LOSA DE BAÑO e=20cm",
    capituloFallback: "Alba",
    materiales: [
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 24 },
      { descripcion: "Balasto (en obra)", unidad: "m3", rendimiento: 0.20 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 6 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 6 },
    ],
  },
  {
    codigo: "6.4.2",
    descripcion: "PISO VINÍLICO EN ROLLO",
    capituloFallback: "Alba",
    materiales: [
      { descripcion: "Piso vinílico en rollo", unidad: "m2", rendimiento: 1.10 },
      { descripcion: "Adhesivo para vinílico", unidad: "kg", rendimiento: 0.4 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 18 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 18 },
    ],
  },
  {
    codigo: "6.4.3",
    descripcion: "BALDOSAS VINÍLICAS DE 30X30cm",
    capituloFallback: "Alba",
    materiales: [
      { descripcion: "Baldosa vinílica 30x30cm", unidad: "m2", rendimiento: 1.05 },
      { descripcion: "Adhesivo para vinílico", unidad: "kg", rendimiento: 0.35 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 16 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 16 },
    ],
  },
  {
    codigo: "6.4.5",
    descripcion: "PARQUET COLOCADO",
    capituloFallback: "Alba",
    materiales: [
      { descripcion: "Parquet de madera", unidad: "m2", rendimiento: 1.05 },
      { descripcion: "Adhesivo para parquet", unidad: "kg", rendimiento: 1.2 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 6 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 6 },
    ],
  },
  {
    codigo: "6.4.9",
    descripcion: "ALFOMBRA DE ALTO TRÁNSITO",
    capituloFallback: "Alba",
    materiales: [
      { descripcion: "Alfombra de alto tránsito", unidad: "m2", rendimiento: 1.10 },
      { descripcion: "Adhesivo para alfombra", unidad: "kg", rendimiento: 0.3 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 25 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 25 },
    ],
  },
  {
    codigo: "6.4.11",
    descripcion: "PULIDO DE PISO DE MADERA Y PLASTIFICADO",
    capituloFallback: "Alba",
    materiales: [
      { descripcion: "Sellador para madera", unidad: "l", rendimiento: 0.15 },
      { descripcion: "Plastificado para piso de madera", unidad: "l", rendimiento: 0.1 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 8 },
    ],
  },
  {
    codigo: "6.4.12",
    descripcion: "PULIDO DE PISO DE MONOLÍTICO",
    capituloFallback: "Alba",
    materiales: [
      { descripcion: "Cera selladora para monolítico", unidad: "l", rendimiento: 0.1 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 12 },
    ],
  },
  {
    codigo: "6.4.13",
    descripcion: "UMBRAL DE GRANITO GRIS 0.90x0.30m",
    capituloFallback: "Alba",
    materiales: [
      { descripcion: "Granito gris mesada", unidad: "m2", rendimiento: 1.05 },
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 5 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 4 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 4 },
    ],
  },
  {
    codigo: "6.4.15",
    descripcion: "NARIZ DE MADERA DURA 10x5cm",
    capituloFallback: "Alba",
    materiales: [
      { descripcion: "Madera dura 10x5cm", unidad: "ml", rendimiento: 1.05 },
      { descripcion: "Tornillos y herrajes", unidad: "gl", rendimiento: 0.1 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 25 },
    ],
  },
  {
    codigo: "6.4.16",
    descripcion: "ENTREPUERTA DE MADERA DURA e=2\"",
    capituloFallback: "Alba",
    materiales: [
      { descripcion: "Madera dura e=2 pulgadas", unidad: "ml", rendimiento: 1.05 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 20 },
    ],
  },
  {
    codigo: "6.4.17",
    descripcion: "ENTREPUERTA DE GRANITO GRIS DE 1.50x0.70m",
    capituloFallback: "Alba",
    materiales: [
      { descripcion: "Granito gris mesada", unidad: "m2", rendimiento: 1.05 },
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 5 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 3 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 3 },
    ],
  },
  {
    codigo: "6.4.18",
    descripcion: "ESCALÓN DE GRANITO GRIS",
    capituloFallback: "Alba",
    materiales: [
      { descripcion: "Granito gris mesada", unidad: "m2", rendimiento: 1.05 },
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 5 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 5 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 5 },
    ],
  },
  {
    codigo: "6.4.19",
    descripcion: "ESCALÓN DE MADERA DURA e=2\"",
    capituloFallback: "Alba",
    materiales: [
      { descripcion: "Madera dura e=2 pulgadas", unidad: "ml", rendimiento: 1.05 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 15 },
    ],
  },
  {
    codigo: "6.4.23",
    descripcion: "ZÓCALO DE BALDOSA DE MONOLÍTICA 40x40cm h=12cm",
    capituloFallback: "Alba",
    materiales: [
      { descripcion: "Baldosa monolítica 40x40cm", unidad: "m2", rendimiento: 0.13 },
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 0.6 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 20 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 20 },
    ],
  },
  {
    codigo: "6.5.3",
    descripcion: "PORCELANATO CON TEXTURA Y/O DISEÑO 60X60cm",
    capituloFallback: "Alba",
    materiales: [
      { descripcion: "Porcelanato 60x60cm", unidad: "m2", rendimiento: 1.05 },
      { descripcion: "Pegamento para cerámica", unidad: "kg", rendimiento: 5 },
      { descripcion: "Pastina para juntas", unidad: "kg", rendimiento: 0.5 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 6 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 6 },
    ],
  },
  {
    codigo: "6.5.4",
    descripcion: "CERÁMICA 45x45cm SOBRE RÚSTICO",
    capituloFallback: "Alba",
    materiales: [
      { descripcion: "Baldosa cerámica 50x50cm", unidad: "m2", rendimiento: 1.05 },
      { descripcion: "Pegamento para cerámica", unidad: "kg", rendimiento: 4.5 },
      { descripcion: "Pastina para juntas", unidad: "kg", rendimiento: 0.5 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 9 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 9 },
    ],
  },
  {
    codigo: "6.6.3",
    descripcion: "CONTRAPISO SOBRE LOSA DE HORMIGÓN e=5cm",
    capituloFallback: "Alba",
    materiales: [
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 6 },
      { descripcion: "Arena gruesa (en obra)", unidad: "m3", rendimiento: 0.025 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 22 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 22 },
    ],
  },
  {
    codigo: "6.6.7",
    descripcion: "PAPEL CRAFT",
    capituloFallback: "Alba",
    materiales: [
      { descripcion: "Papel craft", unidad: "m2", rendimiento: 1.10 },
    ],
    manoObra: [
      { categoria: "Peón", jornadaHs: 8, rendimiento: 60 },
    ],
  },
  {
    codigo: "6.6.10",
    descripcion: "IMPRIMACIÓN CON CEPOL",
    capituloFallback: "Alba",
    materiales: [
      { descripcion: "Imprimación asfáltica", unidad: "l", rendimiento: 0.4 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 40 },
    ],
  },
  {
    codigo: "6.6.12",
    descripcion: "IMPERMEABILIZACIÓN HORIZONTAL DE CIMIENTOS",
    capituloFallback: "Alba",
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
    codigo: "6.6.15",
    descripcion: "INFILTRACIÓN DE MUROS DE 15cm BASE ACUOSA",
    capituloFallback: "Alba",
    materiales: [
      { descripcion: "Hidrófugo líquido", unidad: "l", rendimiento: 0.5 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 20 },
    ],
  },
  {
    codigo: "6.6.16",
    descripcion: "INFILTRACIÓN DE MUROS DE 30cm BASE DILUYENTE",
    capituloFallback: "Alba",
    materiales: [
      { descripcion: "Hidrófugo líquido", unidad: "l", rendimiento: 1.0 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 15 },
    ],
  },
  {
    codigo: "6.6.17",
    descripcion: "SUBMURACIÓN CON CORTE DE MURO DE 15cm",
    capituloFallback: "Alba",
    materiales: [
      { descripcion: "Membrana asfáltica con geotextil", unidad: "m2", rendimiento: 1.10 },
      { descripcion: "Cemento Portland", unidad: "kg", rendimiento: 8 },
      { descripcion: "Arena fina (en obra)", unidad: "m3", rendimiento: 0.020 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 3 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 3 },
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
