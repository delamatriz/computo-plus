// Agrega a la biblioteca estándar de Albañilería dos códigos nuevos de
// puente de adherencia — dos productos distintos para dos usos distintos,
// NO variantes de lo mismo:
//
//   6.8.1 PUENTE DE ADHERENCIA PARA MORTERO (SikaTop Modul) — adhiere
//         mortero nuevo sobre mortero/superficie vieja (revoques,
//         carpetas, reparaciones de borde). Método "lechada": pinceleta
//         sobre la superficie vieja antes del mortero nuevo.
//
//   6.8.2 PUENTE DE ADHERENCIA PARA HORMIGÓN (Sikadur 32 Gel) — adhiere
//         hormigón nuevo sobre hormigón estructural existente, unión
//         monolítica (reparaciones estructurales, continuidad de
//         hormigonado). Superficies más acotadas que el anterior
//         (reparaciones puntuales, no superficies grandes).
//
// Nuevo subcapítulo "Puentes de Adherencia" en Albañilería — no existía
// ninguno de estos dos productos antes. No tocan ningún código existente.
//
// NOTAS PENDIENTES (documentadas acá, no cubiertas por estos códigos):
// - SikaTop Modul también puede usarse como aditivo en el agua de
//   amasado del mortero nuevo (dosificación por volumen de mezcla, no
//   por m2 de superficie) — no cubierto por este código, evaluar como
//   ítem aparte si se necesita.
// - Sikadur 32 Gel: usar en superficies acotadas de reparación
//   estructural, no como puente de adherencia general de grandes
//   superficies — para eso usar el código de SikaTop Modul.
//
// Idempotente vía upsert.
//
// Ejecutar: npx tsx scripts/seed-puentes-adherencia-sika.ts

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

const FECHA_LISTA = "2026-07";

const PRECIOS_MTOP_NUEVOS = [
  { codigo: "MAT-SIKATOP-MODUL", descripcion: "SikaTop Modul (bolsa 5kg)", unidad: "kg", precioUnitario: 299.8 },
  { codigo: "MAT-SIKADUR-32GEL", descripcion: "Sikadur 32 Gel (kit 1kg, dos componentes)", unidad: "kg", precioUnitario: 2003.0 },
];

type MaterialDef = { descripcion: string; unidad: string; rendimiento: number };
type ManoObraDef = { categoria: string; jornadaHs: number; rendimiento: number };

const RENDIMIENTO_MO = 8 / 0.15; // 53,3333 m2/jornada (0,15 hs/m2, igual para ambos)

const CODIGOS: {
  codigo: string;
  descripcion: string;
  materiales: MaterialDef[];
  manoObra: ManoObraDef[];
}[] = [
  {
    codigo: "6.8.1",
    descripcion: "PUENTE DE ADHERENCIA PARA MORTERO (SikaTop Modul)",
    materiales: [
      { descripcion: "SikaTop Modul (bolsa 5kg)", unidad: "kg", rendimiento: 0.2 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: RENDIMIENTO_MO },
    ],
  },
  {
    codigo: "6.8.2",
    descripcion: "PUENTE DE ADHERENCIA PARA HORMIGÓN (Sikadur 32 Gel)",
    materiales: [
      { descripcion: "Sikadur 32 Gel (kit 1kg, dos componentes)", unidad: "kg", rendimiento: 0.5 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: RENDIMIENTO_MO },
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
          subcapitulo: "Puentes de Adherencia",
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
