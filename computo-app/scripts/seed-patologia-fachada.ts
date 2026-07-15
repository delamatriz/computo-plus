// Agrega a la biblioteca estándar el subcapítulo "Patología de Fachada"
// (Albañilería) — cubre el flujo real de patología de fachada de punta a
// punta: Hidrolavado (diagnóstico/limpieza previa) → Saneado (retiro de
// partes flojas) → Tratamiento de hierros expuestos → Limpieza final de
// obra. Subcapítulo nuevo, no toca ningún código existente. Siguiente
// numeración libre después de 6.9 (Membranas Líquidas).
//
//   6.10.1 HIDROLAVADO DE FACHADA (previo a saneado/pintura)
//   6.10.2 SANEADO DE REVOQUES Y HORMIGONES EN FACHADA
//   6.10.3 TRATAMIENTO DE HIERROS EXPUESTOS (SikaTop Armatec-108)
//   6.10.4 LIMPIEZA FINAL DE OBRA (entrega)
//
// Todos los rendimientos de mano de obra y equipos son estimaciones
// cruzadas con fichas técnicas/precios de mercado, NO datos de la Lista
// MTOP (no existen en ese documento) — mismo criterio que los productos
// Sika de sesiones anteriores (ver seed-puentes-adherencia-sika.ts,
// seed-puente-impermeabilizacion-sika.ts).
//
// Notas de decisión (confirmadas con el usuario antes de implementar):
// - 6.10.2 (Saneado): la línea de Peón usa la categoría "Peón" (jornal
//   normal), NO "Peón trabajo en altura" — esa categoría no existe en el
//   convenio SUNCA (ver seed-jornales-sunca-2025.ts: el recargo de 10%
//   por altura aplica solo a Oficial y Medio oficial). La nota del código
//   ya aclara que la tarea es en altura.
// - 6.10.2: sin equipos cargados en el subrubro base — silleta con
//   arnés/andamio/balancín se agregan aparte según la obra, vía el
//   buscador de equipos ya disponible en el catálogo.
// - 6.10.4 (Limpieza final): insumos cargados como una sola línea
//   genérica "Insumos de limpieza final" ($17,50/m2, punto medio del
//   rango $15-20), sin desglosar en bolsas/limpiavidrios/paños.
//
// PASO 0 (pre-requisito): agrega "Hidrolavadora" al catálogo PrecioEquipo
// ($1.200/día, referencia Uruguay, equipo semi-profesional tipo Karcher
// HD 6/15).
//
// Idempotente vía upsert.
//
// Ejecutar: npx tsx scripts/seed-patologia-fachada.ts

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

const FECHA_LISTA = "2026-07";
const SUBCAPITULO = "Patología de Fachada";

// ── Paso 0 — Equipo nuevo ───────────────────────────────────────────────

const HIDROLAVADORA = {
  codigo: "EQ-HIDROLAVADORA",
  descripcion: "Hidrolavadora",
  unidad: "día",
  precioHora: 1200, // referencia UY, equipo semi-profesional tipo Karcher HD 6/15
};

async function seedEquipoHidrolavadora() {
  const existente = await p.precioEquipo.findUnique({ where: { codigo: HIDROLAVADORA.codigo } });
  await p.precioEquipo.upsert({
    where: { codigo: HIDROLAVADORA.codigo },
    update: {
      descripcion: HIDROLAVADORA.descripcion,
      unidad: HIDROLAVADORA.unidad,
      precioHora: HIDROLAVADORA.precioHora,
    },
    create: HIDROLAVADORA,
  });
  console.log(
    existente
      ? `= PrecioEquipo ${HIDROLAVADORA.codigo} ya existía — actualizado ($${HIDROLAVADORA.precioHora}/${HIDROLAVADORA.unidad})`
      : `+ PrecioEquipo creado: ${HIDROLAVADORA.codigo} — ${HIDROLAVADORA.descripcion} ($${HIDROLAVADORA.precioHora}/${HIDROLAVADORA.unidad})`
  );
}

// ── Precios MTOP nuevos (materiales) ────────────────────────────────────

const PRECIOS_MTOP_NUEVOS = [
  {
    codigo: "MAT-SIKATOP-ARMATEC108",
    descripcion: "SikaTop Armatec-108 (kit 5kg)",
    unidad: "kg",
    precioUnitario: 810.0, // $4.050/kit 5kg
  },
  {
    codigo: "MAT-INSUMOS-LIMPIEZA-FINAL",
    descripcion: "Insumos de limpieza final (bolsas de residuos + líquido limpiavidrios + paños)",
    unidad: "m2",
    precioUnitario: 17.5, // punto medio del rango $15-20/m2
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

// ── Códigos de biblioteca ───────────────────────────────────────────────

type MaterialDef = { descripcion: string; unidad: string; rendimiento: number };
type ManoObraDef = { categoria: string; jornadaHs: number; rendimiento: number };
type EquipoDef = { descripcion: string; unidad: string; rendimiento: number };

const CODIGOS: {
  codigo: string;
  descripcion: string;
  unidad: string;
  materiales: MaterialDef[];
  manoObra: ManoObraDef[];
  equipos: EquipoDef[];
}[] = [
  {
    codigo: "6.10.1",
    descripcion: "HIDROLAVADO DE FACHADA (previo a saneado/pintura)",
    unidad: "M2",
    materiales: [],
    manoObra: [
      { categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 8 / 0.0727 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 8 / 0.0727 },
    ],
    equipos: [
      { descripcion: HIDROLAVADORA.descripcion, unidad: HIDROLAVADORA.unidad, rendimiento: 1 / 110 },
    ],
  },
  {
    codigo: "6.10.2",
    descripcion: "SANEADO DE REVOQUES Y HORMIGONES EN FACHADA",
    unidad: "M2",
    materiales: [],
    manoObra: [
      { categoria: "Oficial trabajo en altura", jornadaHs: 8, rendimiento: 8 / 0.4571 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 8 / 0.4571 },
    ],
    equipos: [],
  },
  {
    codigo: "6.10.3",
    descripcion: "TRATAMIENTO DE HIERROS EXPUESTOS (SikaTop Armatec-108)",
    unidad: "ML",
    materiales: [
      { descripcion: PRECIOS_MTOP_NUEVOS[0].descripcion, unidad: "kg", rendimiento: 0.17 },
    ],
    manoObra: [{ categoria: "Oficial albañil", jornadaHs: 8, rendimiento: 8 / 0.175 }],
    equipos: [],
  },
  {
    codigo: "6.10.4",
    descripcion: "LIMPIEZA FINAL DE OBRA (entrega)",
    unidad: "M2",
    materiales: [
      { descripcion: PRECIOS_MTOP_NUEVOS[1].descripcion, unidad: "m2", rendimiento: 1 },
    ],
    manoObra: [{ categoria: "Peón", jornadaHs: 8, rendimiento: 8 / 0.1778 }],
    equipos: [],
  },
];

async function seedCodigosBiblioteca() {
  for (const def of CODIGOS) {
    let subrubro = await p.subrubroEstandar.findUnique({ where: { codigo: def.codigo } });

    if (!subrubro) {
      subrubro = await p.subrubroEstandar.create({
        data: {
          codigo: def.codigo,
          capitulo: "Albañilería",
          subcapitulo: SUBCAPITULO,
          descripcion: def.descripcion,
          unidad: def.unidad,
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

    console.log(
      `  ✓ APUEstandar de ${def.codigo}: ${def.materiales.length} material(es), ${def.manoObra.length} línea(s) de MO, ${def.equipos.length} equipo(s)`
    );
  }
}

async function main() {
  await seedEquipoHidrolavadora();
  await seedPreciosMTOP();
  await seedCodigosBiblioteca();
  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
