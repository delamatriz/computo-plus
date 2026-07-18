// Expansión de biblioteca — Ascensor (capacidades adicionales + ítems que
// rodean al ascensor: foso, sala de máquinas, habilitación UNIT,
// mantenimiento).
//
// NO crea un CapituloCatalogo nuevo — reusa "Ascensor" (ya existe, 2
// SubrubroEstandar activos: 7.2.30/7.2.31).
//
// Códigos de capacidad (7.2.32 a 7.2.36): mismo patrón llave en mano que
// 7.2.30/7.2.31 (1 línea de material "ascensor completo instalado" + MO
// simbólica de Oficial especializado rendimiento 0.02). Precio de
// referencia escalado con un modelo lineal exacto (precio = k1×personas +
// k2×paradas) resuelto a partir de los 2 puntos conocidos (7.2.30 y
// 7.2.31) — no son valores inventados sueltos.
//
// A diferencia de 7.2.30/7.2.31 (que NO tienen PrecioMTOP asociado, así
// que su material clona a $0 en un rubro real — bug preexistente, fuera
// de alcance, NO se toca acá), estos 5 códigos nuevos SÍ tienen su propio
// PrecioMTOP para que el material resuelva correctamente al clonar.
//
// Ítems que rodean al ascensor (ascensor-001 a 004): patrón APU completo
// como gas/incendio. ascensor-001 reusa el material "Membrana asfáltica
// con geotextil" (PrecioMTOP código 270) ya usado en 6.6.8/6.6.9/6.6.12/
// cubierta-009. ascensor-002 reusa "Revoque premezclado 2 en 1" (código
// MAT-REVOQUE-2EN1). Ninguno de los dos crea un material nuevo.
// ascensor-003 (habilitación UNIT) y ascensor-004 (mantenimiento anual)
// son costos externos/de gestión, no mano de obra propia — se modelan
// como 1 línea de material "servicio" con su propio PrecioMTOP de
// referencia (mismo criterio que gas-008 de dejar un precio de
// referencia a verificar, aplicado acá vía material en vez de MO porque
// no es trabajo de cuadrilla propia).
//
// precioUY se calcula acá con la MISMA fórmula que clonar-apu
// (costoDirecto × (1+GG%) × (1+Util%), GG=15/Util=10 defaults).
//
// aportesSociales queda en su default (0) — mismo criterio que el resto
// de la biblioteca agregada en esta sesión (Sika, Aberturas, gas/
// incendio): campo vestigial del import SAU 2022, no se usa en ningún
// cálculo activo.
//
// Idempotente (upsert por código). Ejecutar:
//   Dry-run: npx tsx scripts/seed-ascensor.ts
//   Real:    npx tsx scripts/seed-ascensor.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;
const CAPITULO_NOMBRE = "Ascensor";

// Modelo de escalado — resuelto de forma exacta a partir de 7.2.30 (8p/12par,
// $1.853.258,40) y 7.2.31 (6p/5par, $1.340.463,60):
//   8·k1 + 12·k2 = 1853258.40
//   6·k1 +  5·k2 = 1340463.60
const K1_POR_PERSONA = 213102.225;
const K2_POR_PARADA = 12370.05;

const OFICIAL_ESPECIALIZADO_RENDIMIENTO = 0.02; // igual que 7.2.30/7.2.31

// ── PrecioMTOP nuevos ─────────────────────────────────────────────────
// Los 5 primeros (ascensor completo instalado) se calculan más abajo,
// despejando el precio de material a partir del precioUY objetivo del
// modelo de escalado, para que el redondeo sea exacto y trazable.
// Los últimos 2 (habilitación/mantenimiento) son precio de referencia de
// mercado — Uruguay, 2026-07, marcados a verificar.
type CapacidadDef = { codigo: string; descripcion: string; personas: number; paradas: number; precioCodigoMTOP: string };

const CAPACIDADES: CapacidadDef[] = [
  { codigo: "7.2.32", descripcion: "ASCENSOR PARA 4 PERSONAS 4 PARADAS", personas: 4, paradas: 4, precioCodigoMTOP: "MAT-ASC-4P-4PAR" },
  { codigo: "7.2.33", descripcion: "ASCENSOR PARA 6 PERSONAS 8 PARADAS", personas: 6, paradas: 8, precioCodigoMTOP: "MAT-ASC-6P-8PAR" },
  { codigo: "7.2.34", descripcion: "ASCENSOR PARA 8 PERSONAS 6 PARADAS", personas: 8, paradas: 6, precioCodigoMTOP: "MAT-ASC-8P-6PAR" },
  { codigo: "7.2.35", descripcion: "ASCENSOR PARA 10 PERSONAS 8 PARADAS", personas: 10, paradas: 8, precioCodigoMTOP: "MAT-ASC-10P-8PAR" },
  { codigo: "7.2.36", descripcion: "ASCENSOR CAMILLERO 10 PERSONAS 6 PARADAS (USO HOSPITALARIO/PH)", personas: 10, paradas: 6, precioCodigoMTOP: "MAT-ASC-CAMILLERO-10P-6PAR" },
];

const PRECIO_HABILITACION_BASE = 18000; // referencia de mercado, antes de GG/Util
const PRECIO_MANTENIMIENTO_BASE = 35000; // referencia de mercado anual, antes de GG/Util

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);

  // ── 0. Resolver capituloId de "Ascensor" (ya existe, no se crea) ─────
  const capitulo = await db.capituloCatalogo.findUnique({ where: { nombre: CAPITULO_NOMBRE } });
  if (!capitulo) {
    console.error(`No existe CapituloCatalogo "${CAPITULO_NOMBRE}" — abortando.`);
    await db.$disconnect();
    process.exit(1);
  }
  console.log(`── CapituloCatalogo "${CAPITULO_NOMBRE}" ya existe [id=${capitulo.id}] — no se crea uno nuevo.\n`);

  // ── 1. Jornales (para MO) ────────────────────────────────────────────
  const categoriasLaborales = await db.categoriaLaboral.findMany();
  const jornalPorNombre = (nombre: string) =>
    categoriasLaborales.find((c) => c.nombre.trim().toLowerCase() === nombre.trim().toLowerCase())?.jornal ?? 0;
  const jornalOficialEspecializado = jornalPorNombre("Oficial especializado");

  // ── 2. Calcular PrecioMTOP de los 5 códigos de capacidad ─────────────
  // Despeje: precioUY = (P + jornal/rend) × 1.265  ⇒  P = precioUY/1.265 - jornal/rend
  const MO_COST_ESPECIALIZADO = jornalOficialEspecializado / OFICIAL_ESPECIALIZADO_RENDIMIENTO;
  console.log(`── Modelo de escalado (k1=$${K1_POR_PERSONA}/persona, k2=$${K2_POR_PARADA}/parada) ──`);
  console.log(`MO simbólica (Oficial especializado, rend. ${OFICIAL_ESPECIALIZADO_RENDIMIENTO}): $${MO_COST_ESPECIALIZADO.toFixed(2)} constante en costoDirecto de los 5 códigos.\n`);

  const precioMTOPNuevos: { codigo: string; descripcion: string; unidad: string; precioUnitario: number }[] = [];
  const capacidadResultados: { def: CapacidadDef; precioUYTarget: number; materialPrecio: number; precioUYRecalculado: number }[] = [];

  for (const def of CAPACIDADES) {
    const precioUYTarget = Math.round((K1_POR_PERSONA * def.personas + K2_POR_PARADA * def.paradas) * 100) / 100;
    const materialPrecio = Math.round((precioUYTarget / ((1 + GG_PCT / 100) * (1 + UTIL_PCT / 100)) - MO_COST_ESPECIALIZADO) * 100) / 100;
    const precioUYRecalculado = Math.round((materialPrecio + MO_COST_ESPECIALIZADO) * (1 + GG_PCT / 100) * (1 + UTIL_PCT / 100) * 100) / 100;

    precioMTOPNuevos.push({
      codigo: def.precioCodigoMTOP,
      descripcion: `Ascensor ${def.descripcion.replace(/^ASCENSOR (PARA )?/, "").toLowerCase()} (instalado)`,
      unidad: "gl",
      precioUnitario: materialPrecio,
    });
    capacidadResultados.push({ def, precioUYTarget, materialPrecio, precioUYRecalculado });
  }

  // ── 3. Ítems de servicio (habilitación / mantenimiento) ──────────────
  precioMTOPNuevos.push({
    codigo: "MAT-ASC-HABILITACION-UNIT",
    descripcion: "Trámite de habilitación y certificación UNIT de ascensor (técnico matriculado)",
    unidad: "gl",
    precioUnitario: PRECIO_HABILITACION_BASE,
  });
  precioMTOPNuevos.push({
    codigo: "MAT-ASC-MANTENIMIENTO-ANUAL",
    descripcion: "Contrato de mantenimiento anual básico — ascensor residencial (referencia de mercado)",
    unidad: "gl",
    precioUnitario: PRECIO_MANTENIMIENTO_BASE,
  });

  console.log("── PrecioMTOP nuevos (materiales) ──");
  for (const p of precioMTOPNuevos) {
    const existente = await db.precioMTOP.findUnique({ where: { codigo: p.codigo } });
    console.log(`  ${existente ? "= ya existe" : "+ nuevo"} — ${p.codigo} — ${p.descripcion} ($${p.precioUnitario}/${p.unidad})`);
    if (aplicar) {
      await db.precioMTOP.upsert({
        where: { codigo: p.codigo },
        create: {
          codigo: p.codigo,
          descripcion: p.descripcion,
          cantidadUnidad: `1 ${p.unidad}`,
          unidad: p.unidad,
          cantidad: 1,
          precioConIva: p.precioUnitario,
          precioUnitario: p.precioUnitario,
          numeroLista: 0,
          fechaLista: FECHA,
        },
        update: { precioUnitario: p.precioUnitario, precioConIva: p.precioUnitario },
      });
    }
  }

  console.log(`\nTotal PrecioMTOP nuevos: ${precioMTOPNuevos.length} (5 capacidad + 1 habilitación + 1 mantenimiento)\n`);

  // ── 4. Definición de los 9 SubrubroEstandar nuevos ───────────────────
  type MaterialDef = { descripcion: string; unidad: string; rendimiento: number; precioUnitario: number };
  type ManoObraDef = { categoria: string; rendimiento: number };
  type SubrubroDef = {
    codigo: string;
    descripcion: string;
    unidad: string;
    materiales: MaterialDef[];
    manoObra: ManoObraDef[];
  };

  const materialPrecioMTOPPorCodigo = new Map(precioMTOPNuevos.map((p) => [p.codigo, p]));

  const CODIGOS: SubrubroDef[] = [
    ...capacidadResultados.map(({ def }) => {
      const p = materialPrecioMTOPPorCodigo.get(def.precioCodigoMTOP)!;
      return {
        codigo: def.codigo,
        descripcion: def.descripcion,
        unidad: "GL",
        materiales: [{ descripcion: p.descripcion, unidad: p.unidad, rendimiento: 1, precioUnitario: p.precioUnitario }],
        manoObra: [{ categoria: "Oficial especializado", rendimiento: OFICIAL_ESPECIALIZADO_RENDIMIENTO }],
      };
    }),
    {
      codigo: "ascensor-001",
      descripcion: "Impermeabilización de foso de ascensor",
      unidad: "GL",
      materiales: [{ descripcion: "Membrana asfáltica con geotextil", unidad: "m2", rendimiento: 6.6, precioUnitario: 1665.05 }],
      manoObra: [{ categoria: "Oficial albañil", rendimiento: 1 }],
    },
    {
      codigo: "ascensor-002",
      descripcion: "Terminación de sala de máquinas (revoque y piso básico)",
      unidad: "GL",
      materiales: [{ descripcion: "Revoque premezclado 2 en 1 (bolsa 25kg)", unidad: "bolsa", rendimiento: 4, precioUnitario: 305.75 }],
      manoObra: [
        { categoria: "Oficial albañil", rendimiento: 1 },
        { categoria: "Ayudante", rendimiento: 1 },
      ],
    },
    {
      codigo: "ascensor-003",
      descripcion: "Habilitación y certificación UNIT del ascensor",
      unidad: "GL",
      materiales: [{ descripcion: "Trámite de habilitación y certificación UNIT de ascensor (técnico matriculado)", unidad: "gl", rendimiento: 1, precioUnitario: PRECIO_HABILITACION_BASE }],
      manoObra: [],
    },
    {
      codigo: "ascensor-004",
      descripcion: "Contrato de mantenimiento anual — línea opcional, gasto recurrente post-entrega, no parte del costo de construcción",
      unidad: "GL",
      materiales: [{ descripcion: "Contrato de mantenimiento anual básico — ascensor residencial (referencia de mercado)", unidad: "gl", rendimiento: 1, precioUnitario: PRECIO_MANTENIMIENTO_BASE }],
      manoObra: [],
    },
  ];

  console.log("── SubrubroEstandar + APUEstandar ──");
  let creados = 0;
  let actualizados = 0;
  for (const def of CODIGOS) {
    const sumMat = def.materiales.reduce((s, m) => s + m.rendimiento * m.precioUnitario, 0);
    const sumMO = def.manoObra.reduce((s, mo) => s + jornalPorNombre(mo.categoria) / mo.rendimiento, 0);
    const costoDirecto = sumMat + sumMO;
    const precioUY = Math.round(costoDirecto * (1 + GG_PCT / 100) * (1 + UTIL_PCT / 100) * 100) / 100;

    const yaExiste = await db.subrubroEstandar.findUnique({ where: { codigo: def.codigo } });
    console.log(
      `  ${yaExiste ? "= actualiza" : "+ crea"} ${def.codigo} — ${def.descripcion} (${def.unidad}) — $${precioUY}/${def.unidad} (${def.materiales.length} material(es), ${def.manoObra.length} línea(s) MO)`
    );
    def.materiales.forEach((m) => console.log(`      material: ${m.descripcion} — rendimiento ${m.rendimiento} ${m.unidad} — $${m.precioUnitario}/${m.unidad}`));
    def.manoObra.forEach((mo) => console.log(`      MO: ${mo.categoria} — rendimiento ${mo.rendimiento} ${def.unidad}/jornada — jornal $${jornalPorNombre(mo.categoria)}`));

    if (!aplicar) continue;

    const subrubro = await db.subrubroEstandar.upsert({
      where: { codigo: def.codigo },
      create: {
        codigo: def.codigo,
        descripcion: def.descripcion,
        unidad: def.unidad,
        precioUY,
        fechaBase: FECHA,
        origen: "manual",
        capituloId: capitulo.id,
      },
      update: {
        descripcion: def.descripcion,
        unidad: def.unidad,
        precioUY,
        fechaBase: FECHA,
        capituloId: capitulo.id,
      },
    });
    if (yaExiste) actualizados++;
    else creados++;

    const apuExistente = await db.aPUEstandar.findUnique({ where: { subrubroId: subrubro.id } });
    const apu = apuExistente
      ? await db.aPUEstandar.update({ where: { subrubroId: subrubro.id }, data: {} })
      : await db.aPUEstandar.create({ data: { subrubroId: subrubro.id } });

    await db.materialAPUEstandar.deleteMany({ where: { apuId: apu.id } });
    await db.manoObraAPUEstandar.deleteMany({ where: { apuId: apu.id } });

    for (const m of def.materiales) {
      await db.materialAPUEstandar.create({
        data: { apuId: apu.id, descripcion: m.descripcion, unidad: m.unidad, rendimiento: m.rendimiento },
      });
    }
    for (const mo of def.manoObra) {
      await db.manoObraAPUEstandar.create({
        data: { apuId: apu.id, categoria: mo.categoria, jornadaHs: 8, rendimiento: mo.rendimiento },
      });
    }
  }

  console.log("\n── Resumen ──");
  console.log(`Modo: ${aplicar ? "APLICADO A PRODUCCIÓN" : "DRY RUN (nada escrito)"}`);
  if (aplicar) {
    console.log(`SubrubroEstandar creados: ${creados}, actualizados: ${actualizados}`);
    const totalAscensor = await db.subrubroEstandar.count({ where: { capituloId: capitulo.id, activo: true } });
    console.log(`Total SubrubroEstandar activos en "Ascensor": ${totalAscensor}`);
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
