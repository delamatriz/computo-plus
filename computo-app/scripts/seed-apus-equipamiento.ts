// Carga los APUs estándar (materiales + mano de obra) de Equipamiento
// del rubrado SAU en la base de PRODUCCIÓN.
//
// No existe capítulo "Equipamiento" / "Cocina" en SubrubroEstandar —
// se reusan códigos reales de "Subcontratos - Acondicionamientos" y
// "Subcontratos - Carpinterías" donde la descripción coincide
// exactamente, y se crean SubrubroEstandar nuevos (equip-001..003)
// para calefón, termotanque y extractor de cocina, que no tienen
// equivalente real.
//
// Ejecutar: DATABASE_URL="postgresql://..." npx tsx scripts/seed-apus-equipamiento.ts

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
  crearSubrubro: boolean; // true = el código no existe, se crea nuevo
  materiales: MaterialDef[];
  manoObra: ManoObraDef[];
};

const APUS: ApuDef[] = [
  // ── Códigos reales existentes ───────────────────────────────
  {
    codigo: "7.2.6",
    descripcion: "MEZCLADORA COCINA",
    unidad: "GL",
    capitulo: "Subcontratos - Acondicionamientos",
    crearSubrubro: false,
    materiales: [
      { descripcion: "Mezcladora monocomando cocina", unidad: "u", rendimiento: 1 },
      { descripcion: "Accesorios de colocación grifería", unidad: "gl", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Plomero oficial", jornadaHs: 8, rendimiento: 4.0 },
    ],
  },
  {
    codigo: "7.2.10",
    descripcion: "GRANITO GRIS MESADA",
    unidad: "M2",
    capitulo: "Subcontratos - Acondicionamientos",
    crearSubrubro: false,
    materiales: [
      { descripcion: "Granito gris mesada", unidad: "m2", rendimiento: 1.05 },
      { descripcion: "Sellador para granito", unidad: "l", rendimiento: 0.2 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 3.0 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 3.0 },
    ],
  },
  {
    codigo: "7.2.11",
    descripcion: "GRANITO NEGRO ABSOLUTO MESADA",
    unidad: "M2",
    capitulo: "Subcontratos - Acondicionamientos",
    crearSubrubro: false,
    materiales: [
      { descripcion: "Granito negro absoluto mesada", unidad: "m2", rendimiento: 1.05 },
      { descripcion: "Sellador para granito", unidad: "l", rendimiento: 0.2 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 3.0 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 3.0 },
    ],
  },
  {
    codigo: "7.2.16",
    descripcion: "AMURE DE MESADA",
    unidad: "M2",
    capitulo: "Subcontratos - Acondicionamientos",
    crearSubrubro: false,
    materiales: [
      { descripcion: "Perfil de aluminio para amure", unidad: "ml", rendimiento: 3.0 },
      { descripcion: "Sellador silicona", unidad: "u", rendimiento: 0.5 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 5.0 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 5.0 },
    ],
  },
  {
    codigo: "7.3.9",
    descripcion: "MUEBLE DE BAÑO CON BACHA 0.75x0.50x0.65m",
    unidad: "UNI",
    capitulo: "Subcontratos - Carpinterías",
    crearSubrubro: false,
    materiales: [
      { descripcion: "Mueble de baño con bacha 0.75x0.50x0.65m", unidad: "u", rendimiento: 1 },
      { descripcion: "Accesorios de colocación mueble", unidad: "gl", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 1.0 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 1.0 },
    ],
  },
  {
    codigo: "7.3.10",
    descripcion: "MUEBLE COCINA MODULADO METRO LINEAL",
    unidad: "UNI",
    capitulo: "Subcontratos - Carpinterías",
    crearSubrubro: false,
    materiales: [
      { descripcion: "Mueble cocina modulado ml", unidad: "u", rendimiento: 1 },
      { descripcion: "Tornillos y herrajes mueble", unidad: "gl", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Oficial especializado", jornadaHs: 8, rendimiento: 1.5 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 1.5 },
    ],
  },

  // ── Sin equivalente real, se crea el SubrubroEstandar ─────────
  {
    codigo: "equip-001",
    descripcion: "CALEFÓN A GAS 13L",
    unidad: "UNI",
    capitulo: "Subcontratos - Acondicionamientos",
    crearSubrubro: true,
    materiales: [
      { descripcion: "Calefón a gas 13 litros", unidad: "u", rendimiento: 1 },
      { descripcion: "Accesorios instalación calefón", unidad: "gl", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Plomero oficial", jornadaHs: 8, rendimiento: 1.0 },
    ],
  },
  {
    codigo: "equip-002",
    descripcion: "TERMOTANQUE ELÉCTRICO 80L",
    unidad: "UNI",
    capitulo: "Subcontratos - Acondicionamientos",
    crearSubrubro: true,
    materiales: [
      { descripcion: "Termotanque eléctrico 80 litros", unidad: "u", rendimiento: 1 },
      { descripcion: "Accesorios instalación termotanque", unidad: "gl", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Plomero oficial", jornadaHs: 8, rendimiento: 1.0 },
      { categoria: "Electricista oficial", jornadaHs: 8, rendimiento: 1.0 },
    ],
  },
  {
    codigo: "equip-003",
    descripcion: "EXTRACTOR DE COCINA",
    unidad: "UNI",
    capitulo: "Subcontratos - Acondicionamientos",
    crearSubrubro: true,
    materiales: [
      { descripcion: "Extractor de cocina", unidad: "u", rendimiento: 1 },
      { descripcion: "Caño PVC ventilación 110mm", unidad: "ml", rendimiento: 2 },
    ],
    manoObra: [
      { categoria: "Electricista oficial", jornadaHs: 8, rendimiento: 2.0 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 2.0 },
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
