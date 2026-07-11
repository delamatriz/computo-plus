// Agrega a la biblioteca estándar de Albañilería dos códigos nuevos de
// revoque monocapa premezclado (URUMIX), como ALTERNATIVA a los revoques
// tradicionales existentes — no los reemplaza ni los modifica:
//   6.2.4  REVOQUE GRUESO MURO INTERIOR      — sin tocar
//   6.2.5  REVOQUE FINO MURO INTERIOR        — sin tocar
//   6.2.9  REVOQUE GRUESO MURO EXTERIOR      — sin tocar
//   6.2.10 REVOQUE FINO MURO EXTERIOR        — sin tocar
//
// Códigos nuevos — mismo subcapítulo que su contraparte tradicional, PERO
// además con sufijo alfabético (mismo patrón ya usado en la biblioteca
// para "7.3.17b") en vez del siguiente número libre (6.2.17/6.2.18):
// "Ver subrubros típicos" ordena por código como STRING, no numérico, así
// que 6.2.17/6.2.18 habrían caído entre 6.2.16 y 6.2.2 — lejos de
// 6.2.4/6.2.5/6.2.9/6.2.10, incumpliendo el pedido de que se vean
// agrupados como alternativa clara. Con sufijo "b" quedan ordenados
// justo a continuación de su combo grueso+fino tradicional:
//   6.2.5b  REVOQUE MONOCAPA INTERIOR 2 EN 1 (PREMEZCLADO) — Revoques —
//           Muros Interiores (ordena justo después de 6.2.4/6.2.5)
//   6.2.10b REVOQUE MONOCAPA EXTERIOR 3 EN 1 (PREMEZCLADO) — Revoques —
//           Muros Exteriores (ordena justo después de 6.2.9/6.2.10)
//
// Fuente: fichas técnicas de fabricante (URUMIX) + precios relevados de
// mercado. Mano de obra: reducción del 33% (dato de fábrica confirmado
// para el 3en1, EXTRAPOLADO por analogía al 2en1 — no es dato de
// fabricante confirmado para ese producto puntual, dejarlo marcado como
// estimación) sobre la mano de obra combinada grueso+fino ya validada en
// biblioteca:
//   Interior: (6.2.4 0,5714 + 6.2.5 0,4000) x 0,67 = 0,6508 hs/m2
//   Exterior: (6.2.9 0,6667 + 6.2.10 0,5000) x 0,67 = 0,7817 hs/m2
//
// NOTA PENDIENTE — Malla de fibra de vidrio: se usa en encuentros entre
// materiales distintos (mampostería-hormigón), no en toda la superficie.
// Pendiente decidir si se modela como línea opcional o subrubro aparte
// — no incluida en este código base.
//
// No toca ningún código existente. Idempotente vía upsert.
//
// Ejecutar: npx tsx scripts/seed-revoque-monocapa-urumix.ts

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

const FECHA_LISTA = "2026-07";

const PRECIOS_MTOP_NUEVOS = [
  { codigo: "MAT-REVOQUE-2EN1", descripcion: "Revoque premezclado 2 en 1 (bolsa 25kg)", unidad: "bolsa", precioUnitario: 305.75 },
  { codigo: "MAT-REVOQUE-3EN1", descripcion: "Revoque premezclado 3 en 1 (bolsa 25kg)", unidad: "bolsa", precioUnitario: 320.0 },
];

type MaterialDef = { descripcion: string; unidad: string; rendimiento: number };
type ManoObraDef = { categoria: string; jornadaHs: number; rendimiento: number };

const HS_M2_INTERIOR = 0.6508;
const HS_M2_EXTERIOR = 0.7817;

const CODIGOS: {
  codigo: string;
  descripcion: string;
  subcapitulo: string;
  materiales: MaterialDef[];
  manoObra: ManoObraDef[];
}[] = [
  {
    codigo: "6.2.5b",
    descripcion: "REVOQUE MONOCAPA INTERIOR 2 EN 1 (PREMEZCLADO)",
    subcapitulo: "Revoques — Muros Interiores",
    materiales: [
      { descripcion: "Revoque premezclado 2 en 1 (bolsa 25kg)", unidad: "bolsa", rendimiento: 1.0 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 8 / HS_M2_INTERIOR },
      { categoria: "Ayudante", jornadaHs: 8, rendimiento: 8 / HS_M2_INTERIOR },
    ],
  },
  {
    codigo: "6.2.10b",
    descripcion: "REVOQUE MONOCAPA EXTERIOR 3 EN 1 (PREMEZCLADO)",
    subcapitulo: "Revoques — Muros Exteriores",
    materiales: [
      { descripcion: "Revoque premezclado 3 en 1 (bolsa 25kg)", unidad: "bolsa", rendimiento: 1.2 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 8 / HS_M2_EXTERIOR },
      { categoria: "Ayudante", jornadaHs: 8, rendimiento: 8 / HS_M2_EXTERIOR },
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
          subcapitulo: def.subcapitulo,
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

    console.log(`  ✓ APUEstandar de ${def.codigo}: ${def.materiales.length} material(es), ${def.manoObra.length} líneas de MO`);
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
