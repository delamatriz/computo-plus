// Agrega a la biblioteca estándar de Albañilería tres códigos nuevos de
// membranas líquidas impermeabilizantes, nuevo subcapítulo "Membranas
// Líquidas" — agrupados juntos, mismo patrón que "Puentes de Adherencia"
// (6.8.x). No tocan ningún código existente (6.2.x, 6.7.x, 6.8.x).
//
//   6.9.1 MEMBRANA LÍQUIDA SIKAFILL ELÁSTICO (TECHOS/TERRAZAS)
//   6.9.2 MEMBRANA LÍQUIDA SIKALASTIC-560 SISTEMA COMPLETO (CON
//         REFUERZO SIKA TEX-TRAMA)
//   6.9.3 MEMBRANA LÍQUIDA SIKALASTIC-560 BÁSICO (SIN REFUERZO)
//
// NOTA — Sika Tex-TRAMA (código 6.9.2): a diferencia de las otras
// mallas pendientes de este radar (fibra de vidrio del revoque 3en1
// 6.2.10b, Tejido-107 del SikaTop Seal-107 6.8.3), que son refuerzo
// PUNTUAL en encuentros de materiales, ésta es parte del sistema
// estándar recomendado oficialmente por Sika para el 560 — por eso SÍ
// se incluye como línea de material en este código (no como pendiente
// aparte). Rendimiento: 1,1 m2/m2 (1 m2 de malla por m2 de superficie,
// + 10% de margen por solape entre tiras — mismo criterio conservador
// usado en el resto de la sesión). El PRECIO sigue en 0 — pendiente de
// relevar precio de mercado (no se inventa ningún valor).
//
// Idempotente vía upsert.
//
// Ejecutar: npx tsx scripts/seed-membranas-liquidas-sika.ts

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

const FECHA_LISTA = "2026-07";

const PRECIOS_MTOP_NUEVOS = [
  { codigo: "MAT-SIKAFILL-ELASTICO", descripcion: "SikaFill Elástico (balde 20kg)", unidad: "kg", precioUnitario: 237.9 },
  { codigo: "MAT-SIKALASTIC-560", descripcion: "Sikalastic-560 (balde 20kg)", unidad: "kg", precioUnitario: 264.95 },
  // Sika Tex-TRAMA: sin precio de referencia relevado a propósito — no se agrega a PrecioMTOP.
];

type MaterialDef = { descripcion: string; unidad: string; rendimiento: number };
type ManoObraDef = { categoria: string; jornadaHs: number; rendimiento: number };

const CODIGOS: {
  codigo: string;
  descripcion: string;
  materiales: MaterialDef[];
  manoObra: ManoObraDef[];
}[] = [
  {
    codigo: "6.9.1",
    descripcion: "MEMBRANA LÍQUIDA SIKAFILL ELÁSTICO (TECHOS/TERRAZAS)",
    materiales: [
      { descripcion: "SikaFill Elástico (balde 20kg)", unidad: "kg", rendimiento: 3.0 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 8 / 0.3 },
    ],
  },
  {
    codigo: "6.9.2",
    descripcion: "MEMBRANA LÍQUIDA SIKALASTIC-560 SISTEMA COMPLETO (CON REFUERZO SIKA TEX-TRAMA)",
    materiales: [
      { descripcion: "Sikalastic-560 (balde 20kg)", unidad: "kg", rendimiento: 2.8 },
      { descripcion: "Sika Tex-TRAMA (rollo, refuerzo de malla)", unidad: "m2", rendimiento: 1.1 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 8 / 0.4 },
    ],
  },
  {
    codigo: "6.9.3",
    descripcion: "MEMBRANA LÍQUIDA SIKALASTIC-560 BÁSICO (SIN REFUERZO)",
    materiales: [
      { descripcion: "Sikalastic-560 (balde 20kg)", unidad: "kg", rendimiento: 2.0 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 8 / 0.3 },
    ],
  },
];

async function seedPreciosMTOP() {
  for (const precio of PRECIOS_MTOP_NUEVOS) {
    const existente = await p.precioMTOP.findUnique({ where: { codigo: precio.codigo } });
    if (existente) {
      console.log(`= PrecioMTOP ${precio.codigo} ya existe ($${existente.precioUnitario})`);
      continue;
    }
    await p.precioMTOP.create({
      data: {
        codigo: precio.codigo,
        descripcion: precio.descripcion,
        cantidadUnidad: `1 ${precio.unidad}`,
        unidad: precio.unidad,
        cantidad: 1,
        precioConIva: precio.precioUnitario,
        precioUnitario: precio.precioUnitario,
        numeroLista: 0,
        fechaLista: FECHA_LISTA,
      },
    });
    console.log(`+ PrecioMTOP creado: ${precio.codigo} — ${precio.descripcion} ($${precio.precioUnitario}/${precio.unidad})`);
  }
}

async function seedCodigosBiblioteca() {
  for (const def of CODIGOS) {
    let subrubro = await p.subrubroEstandar.findUnique({ where: { codigo: def.codigo } });

    if (!subrubro) {
      subrubro = await p.subrubroEstandar.create({
        data: {
          codigo: def.codigo,
          capitulo: "Albañilería",
          subcapitulo: "Membranas Líquidas",
          descripcion: def.descripcion,
          unidad: "M2",
          precioUY: 0,
          origen: "manual",
        },
      });
      console.log(`+ SubrubroEstandar creado — ${def.codigo} (${def.descripcion})`);
    } else {
      console.log(`= SubrubroEstandar ${def.codigo} ya existe`);
    }

    const apuExistente = await p.aPUEstandar.findUnique({ where: { subrubroId: subrubro.id } });
    const apu = apuExistente
      ? await p.aPUEstandar.update({ where: { subrubroId: subrubro.id }, data: {} })
      : await p.aPUEstandar.create({ data: { subrubroId: subrubro.id } });

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

    console.log(`  ✓ APUEstandar de ${def.codigo}: ${def.materiales.length} material(es), ${def.manoObra.length} línea(s) de MO`);
  }
}

async function main() {
  await seedPreciosMTOP();
  await seedCodigosBiblioteca();
  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
