// Crea subrubros nuevos de equipos de obra (andamios, balancín, torre,
// grúa torre, malacate, elevador, silleta, hormigonera, retroexcavadora,
// minicargadora) en el capítulo "Implantación y Replanteo", con sus
// APUEstandar completos (materiales, mano de obra y equipos), en la base
// de PRODUCCIÓN. El precio se resuelve al clonar, desde PrecioEquipo y
// CategoriaLaboral existentes.
// Ejecutar: DATABASE_URL="postgresql://..." npx tsx scripts/seed-apus-equipos-obra.ts

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

type MaterialDef = { descripcion: string; unidad: string; rendimiento: number };
type ManoObraDef = { categoria: string; jornadaHs: number; rendimiento: number };
type EquipoDef = { descripcion: string; unidad: string; rendimiento: number };

type ApuDef = {
  codigo: string;
  descripcion: string;
  unidad: string;
  materiales: MaterialDef[];
  manoObra: ManoObraDef[];
  equipos: EquipoDef[];
};

const CAPITULO = "Implantación y Replanteo";

const APUS: ApuDef[] = [
  {
    codigo: "impl-eq-001",
    descripcion: "ANDAMIO TUBULAR — MONTAJE, ALQUILER Y DESMONTAJE",
    unidad: "M2/MES",
    materiales: [{ descripcion: "Andamio tubular", unidad: "m2/mes", rendimiento: 1 }],
    manoObra: [
      { categoria: "Oficial trabajo en altura", jornadaHs: 8, rendimiento: 8 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 8 },
    ],
    equipos: [],
  },
  {
    codigo: "impl-eq-002",
    descripcion: "BALANCÍN — INSTALACIÓN Y OPERACIÓN",
    unidad: "DÍA",
    materiales: [],
    manoObra: [
      { categoria: "Oficial trabajo en altura", jornadaHs: 8, rendimiento: 1 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 1 },
    ],
    equipos: [{ descripcion: "Balancín", unidad: "hs", rendimiento: 8 }],
  },
  {
    codigo: "impl-eq-003",
    descripcion: "TORRE DE ANDAMIO — MONTAJE Y ALQUILER",
    unidad: "DÍA",
    materiales: [],
    manoObra: [
      { categoria: "Oficial trabajo en altura", jornadaHs: 8, rendimiento: 2 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 2 },
    ],
    equipos: [{ descripcion: "Torre de andamio", unidad: "hs", rendimiento: 8 }],
  },
  {
    codigo: "impl-eq-004",
    descripcion: "GRÚA TORRE — ALQUILER MENSUAL",
    unidad: "MES",
    materiales: [],
    manoObra: [{ categoria: "Oficial maquinista", jornadaHs: 8, rendimiento: 0.04 }],
    equipos: [{ descripcion: "Grúa torre", unidad: "hs", rendimiento: 160 }],
  },
  {
    codigo: "impl-eq-005",
    descripcion: "MALACATE ELÉCTRICO — MONTAJE Y ALQUILER",
    unidad: "MES",
    materiales: [],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 0.2 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 0.2 },
    ],
    equipos: [{ descripcion: "Malacate eléctrico", unidad: "hs", rendimiento: 160 }],
  },
  {
    codigo: "impl-eq-006",
    descripcion: "ELEVADOR DE OBRA — MONTAJE Y ALQUILER",
    unidad: "MES",
    materiales: [],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 0.15 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 0.15 },
    ],
    equipos: [{ descripcion: "Elevador de obra", unidad: "hs", rendimiento: 160 }],
  },
  {
    codigo: "impl-eq-007",
    descripcion: "SILLETA PARA TRABAJO EN ALTURA",
    unidad: "DÍA",
    materiales: [],
    manoObra: [{ categoria: "Oficial trabajo en altura", jornadaHs: 8, rendimiento: 1 }],
    equipos: [{ descripcion: "Balancín", unidad: "hs", rendimiento: 8 }],
  },
  {
    codigo: "impl-eq-008",
    descripcion: "HORMIGONERA 250L — ALQUILER",
    unidad: "DÍA",
    materiales: [],
    manoObra: [],
    equipos: [{ descripcion: "Hormigonera", unidad: "hs", rendimiento: 8 }],
  },
  {
    codigo: "impl-eq-009",
    descripcion: "RETROEXCAVADORA — ALQUILER POR HORA",
    unidad: "HS",
    materiales: [],
    manoObra: [{ categoria: "Oficial maquinista", jornadaHs: 8, rendimiento: 1 }],
    equipos: [{ descripcion: "Retroexcavadora", unidad: "hs", rendimiento: 1 }],
  },
  {
    codigo: "impl-eq-010",
    descripcion: "MINICARGADORA — ALQUILER POR HORA",
    unidad: "HS",
    materiales: [],
    manoObra: [{ categoria: "Oficial maquinista", jornadaHs: 8, rendimiento: 1 }],
    equipos: [{ descripcion: "Minicargadora", unidad: "hs", rendimiento: 1 }],
  },
];

async function main() {
  let subrubrosCreados = 0;
  let apusCreados = 0;
  let apusActualizados = 0;

  for (const def of APUS) {
    let subrubro = await p.subrubroEstandar.findUnique({ where: { codigo: def.codigo } });

    if (!subrubro) {
      subrubro = await p.subrubroEstandar.create({
        data: {
          codigo: def.codigo,
          capitulo: CAPITULO,
          descripcion: def.descripcion,
          unidad: def.unidad,
          precioUY: 0,
          origen: "manual",
        },
      });
      console.log(`+ Creado SubrubroEstandar — ${def.codigo} (${def.descripcion})`);
      subrubrosCreados++;
    } else {
      console.log(`⊘ SubrubroEstandar ya existía — ${def.codigo}`);
    }

    const existente = await p.aPUEstandar.findUnique({ where: { subrubroId: subrubro.id } });

    const apu = existente
      ? await p.aPUEstandar.update({ where: { subrubroId: subrubro.id }, data: {} })
      : await p.aPUEstandar.create({ data: { subrubroId: subrubro.id } });

    // Reemplazar contenido para que el script sea idempotente
    await p.materialAPUEstandar.deleteMany({ where: { apuId: apu.id } });
    await p.manoObraAPUEstandar.deleteMany({ where: { apuId: apu.id } });
    await p.equipoAPUEstandar.deleteMany({ where: { apuId: apu.id } });

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
    for (const eq of def.equipos) {
      await p.equipoAPUEstandar.create({
        data: { apuId: apu.id, descripcion: eq.descripcion, unidad: eq.unidad, rendimiento: eq.rendimiento },
      });
    }

    if (existente) {
      console.log(`↻ APUEstandar actualizado — ${def.codigo}`);
      apusActualizados++;
    } else {
      console.log(`✓ APUEstandar creado — ${def.codigo}`);
      apusCreados++;
    }
  }

  console.log("\n── Resumen ──");
  console.log(`SubrubroEstandar creados: ${subrubrosCreados}`);
  console.log(`APUEstandar creados:      ${apusCreados}`);
  console.log(`APUEstandar actualizados: ${apusActualizados}`);
  console.log(`Total definidos:          ${APUS.length}`);

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
