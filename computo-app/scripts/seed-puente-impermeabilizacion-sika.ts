// Agrega a la biblioteca estándar de Albañilería un código nuevo de
// puente de impermeabilización, agrupado en el mismo subcapítulo
// "Puentes de Adherencia" que ya tiene 6.8.1 (SikaTop Modul) y 6.8.2
// (Sikadur 32 Gel) — no los toca.
//
//   6.8.3 PUENTE DE IMPERMEABILIZACIÓN (SikaTop Seal-107) — aplicación a
//         llana (2 capas, dentada + lisa), presión normal de agua (fosos
//         de ascensor, muros de contención, subsuelos residenciales — no
//         aplica a tanques bajo alta columna de agua, que necesitarían
//         más consumo).
//
// Fuente: ficha técnica oficial Sika Uruguay + precios relevados de
// mercado (rango $4.583-6.291 según proveedor, se usa $4.750 como
// referencia media-baja, conservadora).
//
// NOTAS PENDIENTES (documentadas acá, no cubiertas por este código):
// - Aplicación con pinceleta es alternativa válida para superficies
//   chicas o retoques, con consumo de material similar por fórmula
//   (2 kg/m2 por mm de espesor) pero mano de obra distinta — no
//   modelado como código aparte.
// - Malla Tejido-107 (refuerzo específico de este sistema): se usa en
//   encuentros de planos (bandas de 30-40cm), no en toda la superficie
//   — sin precio de referencia relevado. Pendiente de decisión de
//   diseño, mismo criterio que la malla de fibra de vidrio del revoque
//   3en1 (ver nota en código 6.2.10b) — ambas mallas quedan como un
//   solo pendiente consolidado en CURRENT_SPRINT.md.
//
// Idempotente vía upsert.
//
// Ejecutar: npx tsx scripts/seed-puente-impermeabilizacion-sika.ts

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

const FECHA_LISTA = "2026-07";

const PRECIO_MTOP_NUEVO = {
  codigo: "MAT-SIKATOP-SEAL107",
  descripcion: "SikaTop Seal-107 (bolsa 25kg, dos componentes predosificados)",
  unidad: "kg",
  precioUnitario: 190.0, // $4.750/bolsa 25kg
};

const CODIGO = "6.8.3";
const DESCRIPCION = "PUENTE DE IMPERMEABILIZACIÓN (SikaTop Seal-107)";
const RENDIMIENTO_MO = 8 / 0.5; // 16 m2/jornada (0,5 hs/m2)

async function seedPrecioMTOP() {
  const existente = await p.precioMTOP.findUnique({ where: { codigo: PRECIO_MTOP_NUEVO.codigo } });
  if (existente) {
    console.log(`= PrecioMTOP ${PRECIO_MTOP_NUEVO.codigo} ya existe ($${existente.precioUnitario})`);
    return;
  }
  await p.precioMTOP.create({
    data: {
      codigo: PRECIO_MTOP_NUEVO.codigo,
      descripcion: PRECIO_MTOP_NUEVO.descripcion,
      cantidadUnidad: `1 ${PRECIO_MTOP_NUEVO.unidad}`,
      unidad: PRECIO_MTOP_NUEVO.unidad,
      cantidad: 1,
      precioConIva: PRECIO_MTOP_NUEVO.precioUnitario,
      precioUnitario: PRECIO_MTOP_NUEVO.precioUnitario,
      numeroLista: 0,
      fechaLista: FECHA_LISTA,
    },
  });
  console.log(`+ PrecioMTOP creado: ${PRECIO_MTOP_NUEVO.codigo} — ${PRECIO_MTOP_NUEVO.descripcion} ($${PRECIO_MTOP_NUEVO.precioUnitario}/kg)`);
}

async function seedCodigoBiblioteca() {
  let subrubro = await p.subrubroEstandar.findUnique({ where: { codigo: CODIGO } });

  if (!subrubro) {
    subrubro = await p.subrubroEstandar.create({
      data: {
        codigo: CODIGO,
        capitulo: "Albañilería",
        subcapitulo: "Puentes de Adherencia",
        descripcion: DESCRIPCION,
        unidad: "M2",
        precioUY: 0,
        origen: "manual",
      },
    });
    console.log(`+ SubrubroEstandar creado — ${CODIGO} (${DESCRIPCION})`);
  } else {
    console.log(`= SubrubroEstandar ${CODIGO} ya existe`);
  }

  const apuExistente = await p.aPUEstandar.findUnique({ where: { subrubroId: subrubro.id } });
  const apu = apuExistente
    ? await p.aPUEstandar.update({ where: { subrubroId: subrubro.id }, data: {} })
    : await p.aPUEstandar.create({ data: { subrubroId: subrubro.id } });

  await p.materialAPUEstandar.deleteMany({ where: { apuId: apu.id } });
  await p.manoObraAPUEstandar.deleteMany({ where: { apuId: apu.id } });

  await p.materialAPUEstandar.create({
    data: { apuId: apu.id, descripcion: PRECIO_MTOP_NUEVO.descripcion, unidad: "kg", rendimiento: 3 },
  });
  await p.manoObraAPUEstandar.create({
    data: { apuId: apu.id, categoria: "Oficial albañil", jornadaHs: 8, rendimiento: RENDIMIENTO_MO },
  });

  console.log(`  ✓ APUEstandar de ${CODIGO}: 1 material, 1 línea de MO`);
}

async function main() {
  await seedPrecioMTOP();
  await seedCodigoBiblioteca();
  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
