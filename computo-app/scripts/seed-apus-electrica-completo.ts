// Completa los 12 APUs estándar faltantes de Instalación Eléctrica
// (puestas, tableros, cañerías, luminarias, alarma, cámaras IP, DVR/NVR
// y porteros eléctricos) en la base de PRODUCCIÓN.
// Ejecutar: DATABASE_URL="postgresql://..." npx tsx scripts/seed-apus-electrica-completo.ts

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
    codigo: "electrica-001",
    descripcion: "Puesta eléctrica completa (toma + interruptor)",
    capituloFallback: "Eléctrica",
    materiales: [
      { descripcion: "Caja de embutir rectangular", unidad: "u", rendimiento: 1 },
      { descripcion: "Cable eléctrico 2.5mm", unidad: "ml", rendimiento: 4 },
      { descripcion: "Tomacorriente o interruptor", unidad: "u", rendimiento: 1 },
      { descripcion: "Conduit PVC 20mm", unidad: "ml", rendimiento: 3 },
    ],
    manoObra: [
      { categoria: "Electricista oficial", jornadaHs: 8, rendimiento: 3.5 },
    ],
  },
  {
    codigo: "electrica-002",
    descripcion: "Tablero eléctrico 12 circuitos",
    capituloFallback: "Eléctrica",
    materiales: [
      { descripcion: "Tablero eléctrico 12 circuitos", unidad: "u", rendimiento: 1 },
      { descripcion: "Térmicas y diferenciales", unidad: "gl", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Electricista oficial", jornadaHs: 8, rendimiento: 1.0 },
    ],
  },
  {
    codigo: "electrica-003",
    descripcion: "Tablero eléctrico 24 circuitos",
    capituloFallback: "Eléctrica",
    materiales: [
      { descripcion: "Tablero eléctrico 24 circuitos", unidad: "u", rendimiento: 1 },
      { descripcion: "Térmicas y diferenciales", unidad: "gl", rendimiento: 1.5 },
    ],
    manoObra: [
      { categoria: "Electricista oficial", jornadaHs: 8, rendimiento: 0.7 },
    ],
  },
  {
    codigo: "electrica-004",
    descripcion: "Cañería eléctrica embutida ø20mm",
    capituloFallback: "Eléctrica",
    materiales: [
      { descripcion: "Conduit PVC 20mm", unidad: "ml", rendimiento: 1.10 },
    ],
    manoObra: [
      { categoria: "Electricista oficial", jornadaHs: 8, rendimiento: 25 },
    ],
  },
  {
    codigo: "electrica-005",
    descripcion: "Luminaria embutida LED",
    capituloFallback: "Eléctrica",
    materiales: [
      { descripcion: "Luminaria embutida LED", unidad: "u", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Electricista oficial", jornadaHs: 8, rendimiento: 10 },
    ],
  },
  {
    codigo: "electrica-006",
    descripcion: "Luminaria colgante",
    capituloFallback: "Eléctrica",
    materiales: [
      { descripcion: "Luminaria colgante", unidad: "u", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Electricista oficial", jornadaHs: 8, rendimiento: 6 },
    ],
  },
  {
    codigo: "electrica-007",
    descripcion: "Sistema de alarma perimetral",
    capituloFallback: "Eléctrica",
    materiales: [
      { descripcion: "Central de alarma", unidad: "u", rendimiento: 1 },
      { descripcion: "Sensores de movimiento", unidad: "u", rendimiento: 4 },
      { descripcion: "Cable para alarma", unidad: "ml", rendimiento: 40 },
    ],
    manoObra: [
      { categoria: "Electricista oficial", jornadaHs: 8, rendimiento: 0.5 },
    ],
  },
  {
    codigo: "electrica-008",
    descripcion: "Cámara de seguridad IP exterior",
    capituloFallback: "Eléctrica",
    materiales: [
      { descripcion: "Cámara IP exterior", unidad: "u", rendimiento: 1 },
      { descripcion: "Cable UTP", unidad: "ml", rendimiento: 15 },
    ],
    manoObra: [
      { categoria: "Electricista oficial", jornadaHs: 8, rendimiento: 2 },
    ],
  },
  {
    codigo: "electrica-009",
    descripcion: "Cámara de seguridad IP interior",
    capituloFallback: "Eléctrica",
    materiales: [
      { descripcion: "Cámara IP interior", unidad: "u", rendimiento: 1 },
      { descripcion: "Cable UTP", unidad: "ml", rendimiento: 10 },
    ],
    manoObra: [
      { categoria: "Electricista oficial", jornadaHs: 8, rendimiento: 2.5 },
    ],
  },
  {
    codigo: "electrica-010",
    descripcion: "DVR/NVR 4 canales con instalación",
    capituloFallback: "Eléctrica",
    materiales: [
      { descripcion: "DVR/NVR 4 canales", unidad: "u", rendimiento: 1 },
      { descripcion: "Disco duro para DVR", unidad: "u", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Electricista oficial", jornadaHs: 8, rendimiento: 1.5 },
    ],
  },
  {
    codigo: "electrica-011",
    descripcion: "Portero eléctrico con videocámara",
    capituloFallback: "Eléctrica",
    materiales: [
      { descripcion: "Portero eléctrico con videocámara", unidad: "u", rendimiento: 1 },
      { descripcion: "Cable para portero", unidad: "ml", rendimiento: 10 },
    ],
    manoObra: [
      { categoria: "Electricista oficial", jornadaHs: 8, rendimiento: 1.5 },
    ],
  },
  {
    codigo: "electrica-012",
    descripcion: "Portero eléctrico simple",
    capituloFallback: "Eléctrica",
    materiales: [
      { descripcion: "Portero eléctrico simple", unidad: "u", rendimiento: 1 },
      { descripcion: "Cable para portero", unidad: "ml", rendimiento: 10 },
    ],
    manoObra: [
      { categoria: "Electricista oficial", jornadaHs: 8, rendimiento: 2.5 },
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
