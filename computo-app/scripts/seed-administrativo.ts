// Expansión de biblioteca — bloque Administrativo: Honorarios
// Profesionales, Permisos y Trámites Municipales, Estudios Técnicos,
// Conexiones de Servicios.
//
// CapituloCatalogo nuevo "Gastos Administrativos y Conexiones" (orden 22)
// con 4 SubcapituloCatalogo (ver nota en el chat: se pidieron 5, solo se
// definieron 4 — pendiente de confirmar el 5to antes de aplicar).
//
// admin-001 a 012 (Honorarios Profesionales): precioUY = $0 EXPLÍCITO
// (no estimado) — el arancel SAU es % del costo de obra, cualquier monto
// fijo sería engañoso. Llevan APUEstandar MÍNIMO (1 material a $0, sin
// MO) — confirmado en page.tsx:2799 que un SubrubroEstandar SIN
// APUEstandar y con precioUY=0 dispara sugerencia de IA al agregarlo a
// un proyecto (sugerir-apu), que inventaría materiales sin sentido para
// un honorario. Con APUEstandar mínimo, tieneApuEstandar=true → toma el
// camino normal de clonar-apu (funciona, da $0, el usuario completa a
// mano). El panel muestra "—" en vez de "$0" (fmtMonedaDecimal), esto es
// intencional y correcto, no un bug.
//
// admin-013 a 020: precio de referencia real donde se encontró fuente
// pública (OSE, MontevideoGas, catastro, generador de precios CYPE
// Uruguay para estudio de suelos) — marcado con la fuente en el
// comentario de cada uno. Donde no hay tarifa publicada fija (permiso de
// construcción IM es % de valor catastral variable, final de obra, UTE)
// se deja como estimación gruesa, marcada explícitamente.
//
// Fórmula: costoDirecto × (1+GG%) × (1+Util%), GG=15/Util=10, sin capa de
// leyes sociales (mismo criterio que toda esta expansión).
//
// Ejecutar (dry-run): npx tsx scripts/seed-administrativo.ts
// Ejecutar (real):     npx tsx scripts/seed-administrativo.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;
const TCU = 42.5; // mismo tipo de cambio de referencia que usa page.tsx (precioDesdeSubrubro)
const UR = 1922.68; // valor UR vigente julio 2026 (DGI/INE)

const NOMBRE_CAPITULO = "Gastos Administrativos y Conexiones";
const ORDEN_CAPITULO = 22;

const SUB_HONORARIOS = "Honorarios Profesionales";
const SUB_PERMISOS = "Permisos y Trámites Municipales";
const SUB_ESTUDIOS = "Estudios Técnicos";
const SUB_CONEXIONES = "Conexiones de Servicios";

const ADVERTENCIA_SAU = "Honorario según arancel SAU vigente — % del costo de obra, completar manualmente. No usar precio de referencia fijo.";

type SubrubroDef = {
  codigo: string;
  descripcion: string;
  unidad: string;
  subcapitulo: string;
  precioBase: number | null; // null = $0 explícito (honorarios), sin material real
  fuente: string;
};

const HONORARIOS: SubrubroDef[] = [
  { codigo: "admin-001", descripcion: `Anteproyecto — ${ADVERTENCIA_SAU}`, unidad: "GL", subcapitulo: SUB_HONORARIOS, precioBase: null, fuente: "N/A — % arancel SAU" },
  { codigo: "admin-002", descripcion: `Proyecto arquitectónico — ${ADVERTENCIA_SAU}`, unidad: "GL", subcapitulo: SUB_HONORARIOS, precioBase: null, fuente: "N/A — % arancel SAU" },
  { codigo: "admin-003", descripcion: `Proyecto ejecutivo — ${ADVERTENCIA_SAU}`, unidad: "GL", subcapitulo: SUB_HONORARIOS, precioBase: null, fuente: "N/A — % arancel SAU" },
  { codigo: "admin-004", descripcion: `Dirección de obra — ${ADVERTENCIA_SAU}`, unidad: "GL", subcapitulo: SUB_HONORARIOS, precioBase: null, fuente: "N/A — % arancel SAU" },
  { codigo: "admin-005", descripcion: `Supervisión de obra — ${ADVERTENCIA_SAU}`, unidad: "GL", subcapitulo: SUB_HONORARIOS, precioBase: null, fuente: "N/A — % arancel SAU" },
  { codigo: "admin-006", descripcion: `Jefe de obra — ${ADVERTENCIA_SAU}`, unidad: "GL", subcapitulo: SUB_HONORARIOS, precioBase: null, fuente: "N/A — % arancel SAU" },
  { codigo: "admin-007", descripcion: `Asesoramiento profesional — ${ADVERTENCIA_SAU}`, unidad: "GL", subcapitulo: SUB_HONORARIOS, precioBase: null, fuente: "N/A — % arancel SAU" },
  { codigo: "admin-008", descripcion: `Relevamiento de obra — ${ADVERTENCIA_SAU}`, unidad: "GL", subcapitulo: SUB_HONORARIOS, precioBase: null, fuente: "N/A — % arancel SAU" },
  { codigo: "admin-009", descripcion: `Metrajes / cómputo métrico — ${ADVERTENCIA_SAU}`, unidad: "GL", subcapitulo: SUB_HONORARIOS, precioBase: null, fuente: "N/A — % arancel SAU" },
  { codigo: "admin-010", descripcion: `Presupuesto — ${ADVERTENCIA_SAU}`, unidad: "GL", subcapitulo: SUB_HONORARIOS, precioBase: null, fuente: "N/A — % arancel SAU" },
  { codigo: "admin-011", descripcion: `Estudio y plan de seguridad (técnico prevencionista) — ${ADVERTENCIA_SAU}`, unidad: "GL", subcapitulo: SUB_HONORARIOS, precioBase: null, fuente: "N/A — % arancel SAU" },
  { codigo: "admin-012", descripcion: `Control / fiscalización de obra — ${ADVERTENCIA_SAU}`, unidad: "GL", subcapitulo: SUB_HONORARIOS, precioBase: null, fuente: "N/A — % arancel SAU" },
];

const RESTO: SubrubroDef[] = [
  {
    codigo: "admin-013",
    descripcion: "Permiso de construcción municipal",
    unidad: "GL",
    subcapitulo: SUB_PERMISOS,
    precioBase: 45000,
    fuente: "ESTIMACIÓN GRUESA A VERIFICAR — IM cobra 1-1.5% del valor venal catastral (variable por padrón), no un monto fijo. No hay tarifa fija publicada aplicable de forma general.",
  },
  {
    codigo: "admin-014",
    descripcion: "Empadronamiento / catastro",
    unidad: "GL",
    subcapitulo: SUB_PERMISOS,
    precioBase: 918,
    fuente: "Tasa Catastral (cédula catastral informada), Dirección Nacional de Catastro — $918 valor publicado. Nota: el empadronamiento completo puede incluir honorarios de agrimensor no cubiertos por esta tasa.",
  },
  {
    codigo: "admin-015",
    descripcion: "Final de obra / habilitación municipal",
    unidad: "GL",
    subcapitulo: SUB_PERMISOS,
    precioBase: 15000,
    fuente: "ESTIMACIÓN GRUESA A VERIFICAR — no se encontró tarifa fija publicada por la IM para este trámite específico.",
  },
  {
    codigo: "admin-016",
    descripcion: "Estudio de suelos (sondeo + informe de capacidad portante)",
    unidad: "GL",
    subcapitulo: SUB_ESTUDIOS,
    precioBase: 59780.63,
    fuente: "Generador de precios CYPE Uruguay — Estudio geotécnico, suelo medio (arcillas, margas), incluye trabajo de campo + laboratorio.",
  },
  {
    codigo: "admin-017",
    descripcion: "Conexión OSE — agua potable",
    unidad: "GL",
    subcapitulo: SUB_CONEXIONES,
    precioBase: 5 * UR,
    fuente: `OSE — Conexión domiciliaria 12,5-13mm vivienda unifamiliar = 5 UR × $${UR} (valor UR julio 2026, DGI/INE) = $${(5 * UR).toFixed(2)}.`,
  },
  {
    codigo: "admin-018",
    descripcion: "Conexión OSE — saneamiento",
    unidad: "GL",
    subcapitulo: SUB_CONEXIONES,
    precioBase: 17 * UR,
    fuente: `OSE — Conexión de saneamiento 110mm (diámetro residencial estándar) = 17 UR × $${UR} = $${(17 * UR).toFixed(2)}.`,
  },
  {
    codigo: "admin-019",
    descripcion: "Conexión UTE — energía eléctrica",
    unidad: "GL",
    subcapitulo: SUB_CONEXIONES,
    precioBase: 18000,
    fuente: "ESTIMACIÓN GRUESA A VERIFICAR — el Pliego Tarifario UTE define conceptos (Tasa de Conexión, Garantías, Cargo por expansión de Red) pero no se encontró un monto fijo publicado para vivienda unifamiliar estándar.",
  },
  {
    codigo: "admin-020",
    descripcion: "Conexión Gas del Estado / ANCAP",
    unidad: "GL",
    subcapitulo: SUB_CONEXIONES,
    precioBase: 276 * TCU,
    fuente: `MontevideoGas (distribuidor, gas de ANCAP) — cargo de conexión residencial USD 276 con IVA incluido (medidor hasta 6m³/h, incluye gabinete/regulador) × TC $${TCU} = $${(276 * TCU).toFixed(2)}.`,
  },
];

// PrecioMTOP nuevos para los 8 códigos de precio real — mismo criterio
// que el resto de esta expansión (Ascensor/Impermeabilización/Jardín):
// sin esto, el material clonaría a $0 al usar clonar-apu en un proyecto
// real, aunque el precioUY de biblioteca sí esté bien calculado.
const PRECIOS_MTOP_RESTO = RESTO.map((def) => ({
  codigo: `MAT-${def.codigo.toUpperCase()}`,
  descripcion: def.descripcion,
  unidad: "gl",
  precioUnitario: def.precioBase!,
}));

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);

  // ── 1. CapituloCatalogo ────────────────────────────────────────────
  const existente = await db.capituloCatalogo.findUnique({ where: { nombre: NOMBRE_CAPITULO } });
  console.log(`── CapituloCatalogo ──\n  ${existente ? "= ya existe" : "+ nuevo"} — "${NOMBRE_CAPITULO}" (orden ${ORDEN_CAPITULO})`);
  let capituloId = existente?.id;
  if (aplicar && !existente) {
    const creado = await db.capituloCatalogo.create({ data: { nombre: NOMBRE_CAPITULO, orden: ORDEN_CAPITULO, activo: true } });
    capituloId = creado.id;
  }

  // ── 2. Subcapítulos ────────────────────────────────────────────────
  console.log("\n── SubcapituloCatalogo (4 — ver nota: se pidieron 5) ──");
  const nombresSub = [SUB_HONORARIOS, SUB_PERMISOS, SUB_ESTUDIOS, SUB_CONEXIONES];
  const subIds: Record<string, string | undefined> = {};
  for (let i = 0; i < nombresSub.length; i++) {
    const nombre = nombresSub[i];
    const existenteSub = capituloId
      ? await db.subcapituloCatalogo.findUnique({ where: { capituloCatalogoId_nombre: { capituloCatalogoId: capituloId, nombre } } })
      : null;
    console.log(`  ${existenteSub ? "= ya existe" : "+ nuevo"} — "${nombre}" (orden ${i + 1})`);
    subIds[nombre] = existenteSub?.id;
    if (aplicar && capituloId && !existenteSub) {
      const creado = await db.subcapituloCatalogo.create({ data: { capituloCatalogoId: capituloId, nombre, orden: i + 1 } });
      subIds[nombre] = creado.id;
    }
  }

  // ── 3. Honorarios (precioUY = $0 explícito, APU mínimo) ─────────────
  console.log("\n── Honorarios Profesionales (12, precioUY=$0 explícito) ──");
  let creados = 0;
  let actualizados = 0;
  for (const def of HONORARIOS) {
    console.log(`  + crea ${def.codigo} — ${def.descripcion.split(" — ")[0]} (${def.unidad}) — $0/${def.unidad} (1 material a $0, sin MO)`);
    if (!aplicar) continue;
    const subcapituloId = subIds[def.subcapitulo];
    const yaExiste = await db.subrubroEstandar.findUnique({ where: { codigo: def.codigo } });
    const subrubro = await db.subrubroEstandar.upsert({
      where: { codigo: def.codigo },
      create: { codigo: def.codigo, descripcion: def.descripcion, unidad: def.unidad, precioUY: 0, fechaBase: FECHA, origen: "manual", capituloId, subcapituloId },
      update: { descripcion: def.descripcion, unidad: def.unidad, precioUY: 0, fechaBase: FECHA, capituloId, subcapituloId },
    });
    if (yaExiste) actualizados++;
    else creados++;
    const apuExistente = await db.aPUEstandar.findUnique({ where: { subrubroId: subrubro.id } });
    const apu = apuExistente
      ? await db.aPUEstandar.update({ where: { subrubroId: subrubro.id }, data: {} })
      : await db.aPUEstandar.create({ data: { subrubroId: subrubro.id } });
    await db.materialAPUEstandar.deleteMany({ where: { apuId: apu.id } });
    await db.manoObraAPUEstandar.deleteMany({ where: { apuId: apu.id } });
    await db.materialAPUEstandar.create({
      data: { apuId: apu.id, descripcion: "Honorario profesional — a completar manualmente según arancel SAU vigente", unidad: "gl", rendimiento: 1 },
    });
  }

  // ── 4. PrecioMTOP nuevos (8) ─────────────────────────────────────────
  console.log("\n── PrecioMTOP nuevos ──");
  for (const p of PRECIOS_MTOP_RESTO) {
    const existenteP = await db.precioMTOP.findUnique({ where: { codigo: p.codigo } });
    console.log(`  ${existenteP ? "= ya existe" : "+ nuevo"} — ${p.codigo} — ${p.descripcion} ($${p.precioUnitario.toFixed(2)}/${p.unidad})`);
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

  // ── 5. Permisos / Estudios / Conexiones (precio de referencia) ──────
  console.log("\n── Permisos, Estudios y Conexiones (8, con precio de referencia) ──");
  for (const def of RESTO) {
    const precioUY = Math.round(def.precioBase! * (1 + GG_PCT / 100) * (1 + UTIL_PCT / 100) * 100) / 100;
    console.log(`  + crea ${def.codigo} — ${def.descripcion} (${def.unidad}) — $${precioUY}/${def.unidad}`);
    console.log(`      base: $${def.precioBase!.toFixed(2)} × 1.265 (GG 15% + Util 10%)`);
    console.log(`      fuente: ${def.fuente}`);
    if (!aplicar) continue;
    const subcapituloId = subIds[def.subcapitulo];
    const yaExiste = await db.subrubroEstandar.findUnique({ where: { codigo: def.codigo } });
    const subrubro = await db.subrubroEstandar.upsert({
      where: { codigo: def.codigo },
      create: { codigo: def.codigo, descripcion: def.descripcion, unidad: def.unidad, precioUY, fechaBase: FECHA, origen: "manual", capituloId, subcapituloId },
      update: { descripcion: def.descripcion, unidad: def.unidad, precioUY, fechaBase: FECHA, capituloId, subcapituloId },
    });
    if (yaExiste) actualizados++;
    else creados++;
    const apuExistente = await db.aPUEstandar.findUnique({ where: { subrubroId: subrubro.id } });
    const apu = apuExistente
      ? await db.aPUEstandar.update({ where: { subrubroId: subrubro.id }, data: {} })
      : await db.aPUEstandar.create({ data: { subrubroId: subrubro.id } });
    await db.materialAPUEstandar.deleteMany({ where: { apuId: apu.id } });
    await db.manoObraAPUEstandar.deleteMany({ where: { apuId: apu.id } });
    await db.materialAPUEstandar.create({
      data: { apuId: apu.id, descripcion: def.descripcion, unidad: "gl", rendimiento: 1 },
    });
  }

  console.log("\n── Resumen ──");
  console.log(`Modo: ${aplicar ? "APLICADO A PRODUCCIÓN" : "DRY RUN (nada escrito)"}`);
  if (aplicar) {
    console.log(`SubrubroEstandar creados: ${creados}, actualizados: ${actualizados}`);
    const total = await db.subrubroEstandar.count({ where: { capituloId, activo: true } });
    const totalCatalogo = await db.capituloCatalogo.count();
    console.log(`Total SubrubroEstandar activos en "${NOMBRE_CAPITULO}": ${total}`);
    console.log(`Total CapituloCatalogo: ${totalCatalogo}`);
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
