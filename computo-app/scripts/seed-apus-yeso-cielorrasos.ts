// Carga los APUs estándar (materiales + mano de obra) de Yeso y
// Cielorrasos del rubrado SAU en la base de PRODUCCIÓN.
//
// El capítulo real en SubrubroEstandar se llama "Subcontratos - Yeso"
// (no "Yeso y Cielorrasos") y ya tiene 4 subrubros con códigos 7.6.1
// a 7.6.4 (emplacado con perfil omega, muro de yeso con aislación
// acústica, cielorraso de panel de yeso genérico, lana de roca). Ninguno
// coincide de forma confiable con los 5 ítems pedidos aquí — son
// técnicas/materiales distintos (durlock específico, PVC, yeso liso
// enlucido, moldura) — así que se crean como SubrubroEstandar nuevos
// en vez de forzar un match aproximado por descripción (lección del
// incidente con seed-apus-carpinteria-metalica.ts, donde un match por
// código exacto contaminó subrubros de otro capítulo).
//
// Ejecutar: DATABASE_URL="postgresql://..." npx tsx scripts/seed-apus-yeso-cielorrasos.ts

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
  materiales: MaterialDef[];
  manoObra: ManoObraDef[];
};

const APUS: ApuDef[] = [
  {
    codigo: "yeso-001",
    descripcion: "CIELORRASO DE YESO LISO",
    unidad: "M2",
    capitulo: "Subcontratos - Yeso",
    materiales: [
      { descripcion: "Yeso blanco", unidad: "kg", rendimiento: 1.5 },
      { descripcion: "Arena fina (en obra)", unidad: "m3", rendimiento: 0.003 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 8 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 8 },
    ],
  },
  {
    codigo: "yeso-002",
    descripcion: "CIELORRASO DE DURLOCK 9.5mm ESTRUCTURA METÁLICA",
    unidad: "M2",
    capitulo: "Subcontratos - Yeso",
    materiales: [
      { descripcion: "Placa Durlock 9.5mm", unidad: "m2", rendimiento: 1.05 },
      { descripcion: "Perfil metálico para cielorraso", unidad: "ml", rendimiento: 2.5 },
      { descripcion: "Tornillos autoperforantes Durlock", unidad: "u", rendimiento: 12 },
      { descripcion: "Masilla para juntas Durlock", unidad: "kg", rendimiento: 0.5 },
      { descripcion: "Cinta para juntas Durlock", unidad: "ml", rendimiento: 0.5 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 6 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 6 },
    ],
  },
  {
    codigo: "yeso-003",
    descripcion: "TABIQUE DE DURLOCK 9.5mm DOBLE PLACA",
    unidad: "M2",
    capitulo: "Subcontratos - Yeso",
    materiales: [
      { descripcion: "Placa Durlock 9.5mm", unidad: "m2", rendimiento: 2.10 },
      { descripcion: "Perfil metálico para tabique", unidad: "ml", rendimiento: 3.0 },
      { descripcion: "Tornillos autoperforantes Durlock", unidad: "u", rendimiento: 24 },
      { descripcion: "Masilla para juntas Durlock", unidad: "kg", rendimiento: 1.0 },
      { descripcion: "Cinta para juntas Durlock", unidad: "ml", rendimiento: 1.0 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 5 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 5 },
    ],
  },
  {
    codigo: "yeso-004",
    descripcion: "CIELORRASO PVC",
    unidad: "M2",
    capitulo: "Subcontratos - Yeso",
    materiales: [
      { descripcion: "Panel cielorraso PVC", unidad: "m2", rendimiento: 1.05 },
      { descripcion: "Perfil omega PVC", unidad: "ml", rendimiento: 1.5 },
      { descripcion: "Tornillos y tacos", unidad: "u", rendimiento: 6 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 8 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 8 },
    ],
  },
  {
    codigo: "yeso-005",
    descripcion: "MOLDURA DE YESO",
    unidad: "ML",
    capitulo: "Subcontratos - Yeso",
    materiales: [
      { descripcion: "Yeso blanco", unidad: "kg", rendimiento: 0.3 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 20 },
    ],
  },
];

async function main() {
  let subrubrosCreados = 0;
  let creados = 0;
  let actualizados = 0;

  for (const def of APUS) {
    let subrubro = await p.subrubroEstandar.findUnique({ where: { codigo: def.codigo } });

    if (!subrubro) {
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
  console.log(`Total definidos:          ${APUS.length}`);

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
