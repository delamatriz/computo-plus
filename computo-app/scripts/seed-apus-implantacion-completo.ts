// Completa los APUs estándar faltantes de Implantación y Replanteo
// (cartel de obra, cerco, barrera de encofrado, baño químico y container)
// en la base de PRODUCCIÓN.
// Ejecutar: DATABASE_URL="postgresql://..." npx tsx scripts/seed-apus-implantacion-completo.ts

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
    codigo: "1.1",
    descripcion: "CARTEL DE OBRA de 4x3m",
    capituloFallback: "Implantación y Replanteo",
    materiales: [
      { descripcion: "Chapa galvanizada para cartel", unidad: "m2", rendimiento: 12 },
      { descripcion: "Tubo cuadrado acero 25x25x2mm", unidad: "kg", rendimiento: 15 },
      { descripcion: "Pintura anticorrosiva", unidad: "l", rendimiento: 1 },
      { descripcion: "Pintura esmalte sintético", unidad: "l", rendimiento: 2 },
      { descripcion: "Hormigón pobre para bases", unidad: "m3", rendimiento: 0.2 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 0.25 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 0.25 },
    ],
  },
  {
    codigo: "1.3",
    descripcion: "CERCO TEJIDO GALVANIZADO Nº14 H=2.60m",
    capituloFallback: "Implantación y Replanteo",
    materiales: [
      { descripcion: "Tejido galvanizado N°14 H=2.60m", unidad: "ml", rendimiento: 1.05 },
      { descripcion: "Tubo redondo acero 38mm", unidad: "ml", rendimiento: 0.5 },
      { descripcion: "Alambre galvanizado N°14", unidad: "kg", rendimiento: 0.3 },
      { descripcion: "Hormigón pobre para bases", unidad: "m3", rendimiento: 0.02 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 8 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 8 },
    ],
  },
  {
    codigo: "1.5",
    descripcion: "BARRERA H=2.20 CON TABLAS ENCOFRADO",
    capituloFallback: "Implantación y Replanteo",
    materiales: [
      { descripcion: "Madera para encofrado", unidad: "m2", rendimiento: 2.2 },
      { descripcion: "Tornillos y clavos", unidad: "kg", rendimiento: 0.3 },
      { descripcion: "Poste de madera", unidad: "u", rendimiento: 0.5 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 8 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 8 },
    ],
  },
  {
    codigo: "1.6",
    descripcion: "BAÑO QUÍMICO CON LAVAMANOS Y SERVICIO DE BAROMÉTRICA",
    capituloFallback: "Implantación y Replanteo",
    // Servicio subcontratado — el precio viene del proveedor (alquiler mensual),
    // no de un descompuesto de materiales.
    materiales: [],
    manoObra: [
      { categoria: "Peón", jornadaHs: 8, rendimiento: 0.1 },
    ],
  },
  {
    codigo: "1.7",
    descripcion: "ALQUILER CONTAINER DE 20 PIES CON BAÑO",
    capituloFallback: "Implantación y Replanteo",
    // Servicio subcontratado — el precio viene del proveedor.
    materiales: [],
    manoObra: [
      { categoria: "Peón", jornadaHs: 8, rendimiento: 0.1 },
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
