// Impermeabilizaciones y Aislaciones pasa a ser CapituloCatalogo standalone
// (antes vivía como subcapítulo de Albañilería, repartido vía
// ParticionSubcapitulo — Fase 2, Etapa 5). Expansión de contenido en
// Impermeabilización y en Vidrios y Espejos.
//
// Qué hace este script (todo idempotente, dry-run por defecto):
//  1. Crea el CapituloCatalogo "Impermeabilizaciones y Aislaciones" nuevo
//     (standalone, mismo nivel que "Subcontratos - Pinturas").
//  2. Crea 4 SubcapituloCatalogo nuevos bajo ese capítulo.
//  3. Migra 14 SubrubroEstandar existentes (6.6.X, sin 6.6.13) de
//     capituloId=Albañilería a capituloId=nuevo, reclasificando su
//     subcapituloId a uno de los 4 subcapítulos nuevos.
//  4. Mueve 6.6.13 "Colocación de tejas coloniales" a "Cubierta / Techos"
//     (estaba mal clasificado en el import SAU original — no es
//     impermeabilización).
//  5. Migra 4 SubrubroEstandar de Sika (6.8.3 Puente de Impermeabilización,
//     6.9.1/6.9.2/6.9.3 Membranas Líquidas) desde sus subcapítulos actuales
//     en Albañilería hacia el subcapítulo 4 del capítulo nuevo.
//  6. Borra la fila de ParticionSubcapitulo de "Impermeabilizaciones y
//     Aislaciones" (ya no hace falta partición — el capítulo ya no
//     comparte catálogo con nadie).
//  7. Borra las 2 filas de SubcapituloCatalogo que quedan huérfanas bajo
//     Albañilería tras la migración: "Impermeabilizaciones y Aislaciones"
//     (los 14 subrubros se fueron) y "Membranas Líquidas" (sus 3 miembros
//     se fueron). "Puentes de Adherencia" NO se toca — sigue teniendo
//     6.8.1/6.8.2.
//  8. Re-backfillea el único Capitulo real que usa este nombre (HOGAR) para
//     que su capituloCatalogoId apunte al catálogo nuevo en vez de a
//     Albañilería.
//  9. Crea 5 SubrubroEstandar+APUEstandar nuevos en Impermeabilización
//     (imperm-001 a 005) y 7 en Vidrios (vidrio-001 a 007, incluye
//     templado 10mm).
//
// Precios de referencia de los 12 códigos nuevos: calculados con la MISMA
// fórmula que clonar-apu (costoDirecto × 1.15 × 1.10), a partir de
// dosificaciones estimadas por investigación de mercado (no hay Lista MTOP
// que cubra cristalización/poliurea/sintéticas/DVH/vidrio solar/laminado —
// son productos de marca, igual criterio que gas/incendio/Sika de sesiones
// anteriores). Quedan marcados a verificar vía fechaBase, sin mecanismo
// nuevo.
//
// aportesSociales queda en su default (0), mismo criterio de siempre.
//
// Ejecutar (dry-run): npx tsx scripts/seed-impermeabilizacion-vidrios.ts
// Ejecutar (real):     npx tsx scripts/seed-impermeabilizacion-vidrios.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;

const NOMBRE_CAPITULO_NUEVO = "Impermeabilizaciones y Aislaciones";
const NOMBRE_ALBANILERIA = "Albañilería";
const NOMBRE_CUBIERTA = "Cubierta / Techos";
const NOMBRE_VIDRIOS = "Subcontratos - Vidrios";

const SUB1 = "Preparación y Aislación Complementaria";
const SUB2 = "Membranas Asfálticas y Sistema Tradicional";
const SUB3 = "Impermeabilización de Muros y Cimientos";
const SUB4 = "Cementicia, Membranas Líquidas y Sistemas Premium";

// Códigos existentes a migrar, por subcapítulo destino.
const MIGRACION_SUB1 = ["6.6.1", "6.6.2", "6.6.4", "6.6.5", "6.6.6", "6.6.7", "6.6.10"];
const MIGRACION_SUB2 = ["6.6.8", "6.6.9"];
const MIGRACION_SUB3 = ["6.6.11", "6.6.12", "6.6.15", "6.6.16", "6.6.17"];
const MIGRACION_SUB4_SIKA = ["6.8.3", "6.9.1", "6.9.2", "6.9.3"];
const CODIGO_A_CUBIERTA = "6.6.13";

// ── PrecioMTOP nuevos ────────────────────────────────────────────────────
const PRECIOS_MTOP_NUEVOS = [
  { codigo: "MAT-IMPERM-FIELTRO", descripcion: "Fieltro asfáltico para impermeabilización multicapa", unidad: "m2", precioUnitario: 140 },
  { codigo: "MAT-IMPERM-ASFALTO-OXIDADO", descripcion: "Asfalto oxidado para adherido en caliente", unidad: "kg", precioUnitario: 40 },
  { codigo: "MAT-IMPERM-MEMBRANA-TRANSITABLE", descripcion: "Membrana asfáltica con protección granular (transitable)", unidad: "m2", precioUnitario: 1150 },
  { codigo: "MAT-IMPERM-REVEST-ACRILICO", descripcion: "Revestimiento acrílico impermeable de protección", unidad: "kg", precioUnitario: 130 },
  { codigo: "MAT-IMPERM-CRISTALIZACION", descripcion: "Impermeabilizante por cristalización tipo Xypex/Penetron", unidad: "kg", precioUnitario: 1280 },
  { codigo: "MAT-IMPERM-POLIUREA", descripcion: "Poliurea bicomponente proyectada", unidad: "kg", precioUnitario: 1120 },
  { codigo: "MAT-IMPERM-SINTETICA-PVC-TPO", descripcion: "Membrana sintética PVC/TPO para cubierta", unidad: "m2", precioUnitario: 1240 },
  { codigo: "MAT-VIDRIO-DVH-4-9-4", descripcion: "DVH 4-9-4mm (cámara de aire 9mm)", unidad: "m2", precioUnitario: 2100 },
  { codigo: "MAT-VIDRIO-DVH-4-12-4", descripcion: "DVH 4-12-4mm (cámara de aire 12mm)", unidad: "m2", precioUnitario: 2325 },
  { codigo: "MAT-VIDRIO-DVH-LOWE", descripcion: "DVH con Low-E, cámara 12mm", unidad: "m2", precioUnitario: 3300 },
  { codigo: "MAT-VIDRIO-SOLAR", descripcion: "Vidrio solar (control solar) entintado/reflectivo", unidad: "m2", precioUnitario: 1505 },
  { codigo: "MAT-VIDRIO-DVH-SOLAR", descripcion: "DVH con control solar, cámara 12mm", unidad: "m2", precioUnitario: 3600 },
  { codigo: "MAT-VIDRIO-LAMINADO-PVB", descripcion: "Vidrio laminado de seguridad PVB 3+3mm", unidad: "m2", precioUnitario: 1280 },
  { codigo: "MAT-VIDRIO-TEMPLADO-10", descripcion: "Vidrio templado 10mm", unidad: "m2", precioUnitario: 4550 },
] as const;

// Materiales reusados (ya existen, NO se crean de nuevo).
const REUSO_IMPRIMACION = { descripcion: "Imprimación asfáltica", unidad: "l", precioUnitario: 145 };
const REUSO_SELLADOR = { descripcion: "Sellador silicona", unidad: "u", precioUnitario: 320 };

type MaterialDef = { descripcion: string; unidad: string; rendimiento: number; precioUnitario: number };
type ManoObraDef = { categoria: string; rendimiento: number };
type SubrubroDef = {
  codigo: string;
  descripcion: string;
  unidad: string;
  destino: "IMPERM_SUB2" | "IMPERM_SUB4" | "VIDRIOS";
  materiales: MaterialDef[];
  manoObra: ManoObraDef[];
};

const precioPorCodigo = new Map<string, (typeof PRECIOS_MTOP_NUEVOS)[number]>(
  PRECIOS_MTOP_NUEVOS.map((p) => [p.codigo, p])
);
const mat = (codigo: string, rendimiento: number): MaterialDef => {
  const p = precioPorCodigo.get(codigo)!;
  return { descripcion: p.descripcion, unidad: p.unidad, rendimiento, precioUnitario: p.precioUnitario };
};

const CODIGOS_NUEVOS: SubrubroDef[] = [
  {
    codigo: "imperm-001",
    descripcion: "Impermeabilización tradicional multicapa (imprimación + 2 capas de fieltro asfáltico oxidado)",
    unidad: "M2",
    destino: "IMPERM_SUB2",
    materiales: [
      { ...REUSO_IMPRIMACION, rendimiento: 0.3 },
      mat("MAT-IMPERM-FIELTRO", 2.2),
      mat("MAT-IMPERM-ASFALTO-OXIDADO", 3),
    ],
    manoObra: [
      { categoria: "Oficial albañil", rendimiento: 12 },
      { categoria: "Peón", rendimiento: 12 },
    ],
  },
  {
    codigo: "imperm-002",
    descripcion: "Membrana asfáltica transitable con protección granular (terrazas peatonales)",
    unidad: "M2",
    destino: "IMPERM_SUB2",
    materiales: [mat("MAT-IMPERM-MEMBRANA-TRANSITABLE", 1.1), mat("MAT-IMPERM-REVEST-ACRILICO", 1.05)],
    manoObra: [
      { categoria: "Oficial albañil", rendimiento: 16 },
      { categoria: "Peón", rendimiento: 16 },
    ],
  },
  {
    codigo: "imperm-003",
    descripcion: "Impermeabilización por cristalización (tipo Xypex/Penetron) para hormigón",
    unidad: "M2",
    destino: "IMPERM_SUB4",
    materiales: [mat("MAT-IMPERM-CRISTALIZACION", 1.2)],
    manoObra: [{ categoria: "Oficial albañil", rendimiento: 12 }],
  },
  {
    codigo: "imperm-004",
    descripcion: "Impermeabilización con poliurea proyectada",
    unidad: "M2",
    destino: "IMPERM_SUB4",
    materiales: [mat("MAT-IMPERM-POLIUREA", 2.3)],
    manoObra: [{ categoria: "Oficial especializado", rendimiento: 15 }],
  },
  {
    codigo: "imperm-005",
    descripcion: "Membrana sintética monocapa PVC/TPO para cubierta plana",
    unidad: "M2",
    destino: "IMPERM_SUB4",
    materiales: [mat("MAT-IMPERM-SINTETICA-PVC-TPO", 1.1)],
    manoObra: [
      { categoria: "Oficial especializado", rendimiento: 12 },
      { categoria: "Ayudante", rendimiento: 12 },
    ],
  },
  {
    codigo: "vidrio-001",
    descripcion: "DVH 4-9-4mm (cámara de aire 9mm)",
    unidad: "M2",
    destino: "VIDRIOS",
    materiales: [mat("MAT-VIDRIO-DVH-4-9-4", 1.05), { ...REUSO_SELLADOR, rendimiento: 0.15 }],
    manoObra: [{ categoria: "Oficial especializado", rendimiento: 10 }],
  },
  {
    codigo: "vidrio-002",
    descripcion: "DVH 4-12-4mm (cámara de aire 12mm)",
    unidad: "M2",
    destino: "VIDRIOS",
    materiales: [mat("MAT-VIDRIO-DVH-4-12-4", 1.05), { ...REUSO_SELLADOR, rendimiento: 0.15 }],
    manoObra: [{ categoria: "Oficial especializado", rendimiento: 10 }],
  },
  {
    codigo: "vidrio-003",
    descripcion: "DVH con Low-E (baja emisividad), cámara 12mm",
    unidad: "M2",
    destino: "VIDRIOS",
    materiales: [mat("MAT-VIDRIO-DVH-LOWE", 1.05), { ...REUSO_SELLADOR, rendimiento: 0.15 }],
    manoObra: [{ categoria: "Oficial especializado", rendimiento: 10 }],
  },
  {
    codigo: "vidrio-004",
    descripcion: "Vidrio solar (control solar) entintado/reflectivo",
    unidad: "M2",
    destino: "VIDRIOS",
    materiales: [mat("MAT-VIDRIO-SOLAR", 1.05), { ...REUSO_SELLADOR, rendimiento: 0.12 }],
    manoObra: [{ categoria: "Oficial especializado", rendimiento: 10 }],
  },
  {
    codigo: "vidrio-005",
    descripcion: "DVH con control solar, cámara 12mm",
    unidad: "M2",
    destino: "VIDRIOS",
    materiales: [mat("MAT-VIDRIO-DVH-SOLAR", 1.05), { ...REUSO_SELLADOR, rendimiento: 0.15 }],
    manoObra: [{ categoria: "Oficial especializado", rendimiento: 10 }],
  },
  {
    codigo: "vidrio-006",
    descripcion: "Vidrio laminado de seguridad PVB 3+3mm",
    unidad: "M2",
    destino: "VIDRIOS",
    materiales: [mat("MAT-VIDRIO-LAMINADO-PVB", 1.05), { ...REUSO_SELLADOR, rendimiento: 0.12 }],
    manoObra: [{ categoria: "Oficial especializado", rendimiento: 10 }],
  },
  {
    codigo: "vidrio-007",
    descripcion: "Vidrio templado 10mm",
    unidad: "M2",
    destino: "VIDRIOS",
    materiales: [mat("MAT-VIDRIO-TEMPLADO-10", 1.05), { ...REUSO_SELLADOR, rendimiento: 0.12 }],
    manoObra: [{ categoria: "Oficial especializado", rendimiento: 6 }],
  },
];

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);

  const albanileria = await db.capituloCatalogo.findUnique({ where: { nombre: NOMBRE_ALBANILERIA } });
  const cubierta = await db.capituloCatalogo.findUnique({ where: { nombre: NOMBRE_CUBIERTA } });
  const vidrios = await db.capituloCatalogo.findUnique({ where: { nombre: NOMBRE_VIDRIOS } });
  if (!albanileria || !cubierta || !vidrios) {
    console.error("Falta algún CapituloCatalogo base — abortando.");
    await db.$disconnect();
    process.exit(1);
  }

  // ── 1. CapituloCatalogo nuevo ─────────────────────────────────────────
  const maxOrden = await db.capituloCatalogo.aggregate({ _max: { orden: true } });
  const ordenNuevo = (maxOrden._max.orden ?? 0) + 1;
  const capituloExistente = await db.capituloCatalogo.findUnique({ where: { nombre: NOMBRE_CAPITULO_NUEVO } });
  console.log("── CapituloCatalogo nuevo ──");
  console.log(`  ${capituloExistente ? "= ya existe" : "+ nuevo"} — "${NOMBRE_CAPITULO_NUEVO}" (orden ${ordenNuevo})`);
  let capituloNuevoId = capituloExistente?.id;
  if (aplicar && !capituloExistente) {
    const creado = await db.capituloCatalogo.create({ data: { nombre: NOMBRE_CAPITULO_NUEVO, orden: ordenNuevo, activo: true } });
    capituloNuevoId = creado.id;
  }

  // ── 2. Subcapítulos nuevos ────────────────────────────────────────────
  console.log("\n── SubcapituloCatalogo nuevos ──");
  const subNombres = [SUB1, SUB2, SUB3, SUB4];
  const subIds: Record<string, string | undefined> = {};
  for (let i = 0; i < subNombres.length; i++) {
    const nombre = subNombres[i];
    const existente = capituloNuevoId
      ? await db.subcapituloCatalogo.findUnique({ where: { capituloCatalogoId_nombre: { capituloCatalogoId: capituloNuevoId, nombre } } })
      : null;
    console.log(`  ${existente ? "= ya existe" : "+ nuevo"} — "${nombre}" (orden ${i + 1})`);
    subIds[nombre] = existente?.id;
    if (aplicar && capituloNuevoId && !existente) {
      const creado = await db.subcapituloCatalogo.create({ data: { capituloCatalogoId: capituloNuevoId, nombre, orden: i + 1 } });
      subIds[nombre] = creado.id;
    }
  }

  // ── 3-5. Migraciones de SubrubroEstandar existentes ──────────────────
  console.log("\n── Migración de SubrubroEstandar existentes ──");
  const migrar = async (codigos: string[], subNombre: string | null, aCubierta = false) => {
    for (const codigo of codigos) {
      const s = await db.subrubroEstandar.findUnique({ where: { codigo } });
      if (!s) {
        console.log(`  ⚠ ${codigo} no encontrado — se salta`);
        continue;
      }
      const destinoCapitulo = aCubierta ? cubierta.id : capituloNuevoId;
      const destinoSub = aCubierta ? null : subNombre ? subIds[subNombre] : null;
      const etiquetaCapitulo = destinoCapitulo ?? `(nuevo — "${NOMBRE_CAPITULO_NUEVO}", se crea al aplicar)`;
      const etiquetaSub = aCubierta ? "null" : destinoSub ?? (subNombre ? `(nuevo — "${subNombre}", se crea al aplicar)` : "null");
      console.log(`  ${codigo} — capituloId: ${s.capituloId} → ${etiquetaCapitulo} | subcapituloId: ${s.subcapituloId} → ${etiquetaSub}`);
      if (aplicar) {
        await db.subrubroEstandar.update({ where: { codigo }, data: { capituloId: destinoCapitulo, subcapituloId: destinoSub } });
      }
    }
  };
  console.log(` Subcapítulo "${SUB1}":`);
  await migrar(MIGRACION_SUB1, SUB1);
  console.log(` Subcapítulo "${SUB2}" (existentes):`);
  await migrar(MIGRACION_SUB2, SUB2);
  console.log(` Subcapítulo "${SUB3}":`);
  await migrar(MIGRACION_SUB3, SUB3);
  console.log(` Subcapítulo "${SUB4}" (Sika migrados):`);
  await migrar(MIGRACION_SUB4_SIKA, SUB4);
  console.log(` A "${NOMBRE_CUBIERTA}" (reclasificación, sin impermeabilización):`);
  await migrar([CODIGO_A_CUBIERTA], null, true);

  // ── 6. Borrar ParticionSubcapitulo obsoleta ──────────────────────────
  console.log("\n── ParticionSubcapitulo obsoleta ──");
  const subcapViejoImperm = await db.subcapituloCatalogo.findFirst({
    where: { capituloCatalogoId: albanileria.id, nombre: NOMBRE_CAPITULO_NUEVO },
  });
  const particionVieja = subcapViejoImperm
    ? await db.particionSubcapitulo.findUnique({ where: { subcapituloId: subcapViejoImperm.id } })
    : null;
  console.log(
    particionVieja
      ? `  - borrar partición "${NOMBRE_CAPITULO_NUEVO}" → "${particionVieja.capituloRealDestino}"`
      : "  = no hay partición que borrar"
  );
  if (aplicar && particionVieja) {
    await db.particionSubcapitulo.delete({ where: { id: particionVieja.id } });
  }

  // ── 7. Borrar SubcapituloCatalogo huérfanos ──────────────────────────
  console.log("\n── SubcapituloCatalogo huérfanos (Albañilería) ──");
  const subMembranasLiquidas = await db.subcapituloCatalogo.findFirst({
    where: { capituloCatalogoId: albanileria.id, nombre: "Membranas Líquidas" },
  });
  for (const [nombre, sub] of [
    [NOMBRE_CAPITULO_NUEVO, subcapViejoImperm] as const,
    ["Membranas Líquidas", subMembranasLiquidas] as const,
  ]) {
    if (!sub) {
      console.log(`  = "${nombre}" no encontrado, nada que borrar`);
      continue;
    }
    const miembros = await db.subrubroEstandar.count({ where: { subcapituloId: sub.id } });
    console.log(`  - borrar "${nombre}" (id=${sub.id}, miembros restantes tras migración: ${miembros})`);
    if (aplicar) {
      if (miembros > 0) {
        console.warn(`    ⚠ "${nombre}" todavía tiene ${miembros} miembro(s) — no se borra, revisar`);
        continue;
      }
      await db.subcapituloCatalogo.delete({ where: { id: sub.id } });
    }
  }

  // ── 8. Re-backfill de Capitulo real (HOGAR) ──────────────────────────
  console.log("\n── Re-backfill de Capitulo real ──");
  const capitulosReales = await db.capitulo.findMany({
    where: { nombre: NOMBRE_CAPITULO_NUEVO },
    include: { proyecto: { select: { nombre: true } } },
  });
  for (const c of capitulosReales) {
    console.log(`  proyecto="${c.proyecto.nombre}" — capituloCatalogoId: ${c.capituloCatalogoId} → ${capituloNuevoId ?? `(nuevo — "${NOMBRE_CAPITULO_NUEVO}", se crea al aplicar)`}`);
    if (aplicar) {
      await db.capitulo.update({ where: { id: c.id }, data: { capituloCatalogoId: capituloNuevoId } });
    }
  }

  // ── 9. PrecioMTOP nuevos ──────────────────────────────────────────────
  console.log("\n── PrecioMTOP nuevos ──");
  for (const p of PRECIOS_MTOP_NUEVOS) {
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

  // ── 10. SubrubroEstandar + APUEstandar nuevos ────────────────────────
  console.log("\n── SubrubroEstandar + APUEstandar nuevos ──");
  const categoriasLaborales = await db.categoriaLaboral.findMany();
  const jornalPorNombre = (nombre: string) =>
    categoriasLaborales.find((c) => c.nombre.trim().toLowerCase() === nombre.trim().toLowerCase())?.jornal ?? 0;

  let creados = 0;
  let actualizados = 0;
  for (const def of CODIGOS_NUEVOS) {
    const capituloId = def.destino === "VIDRIOS" ? vidrios.id : capituloNuevoId;
    const subcapituloId = def.destino === "IMPERM_SUB2" ? subIds[SUB2] : def.destino === "IMPERM_SUB4" ? subIds[SUB4] : null;

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
    if (!capituloId) {
      console.warn(`      ⚠ SIN capituloId resuelto para ${def.codigo} — se salta`);
      continue;
    }

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
    for (const m of def.materiales) {
      await db.materialAPUEstandar.create({ data: { apuId: apu.id, descripcion: m.descripcion, unidad: m.unidad, rendimiento: m.rendimiento } });
    }
    for (const mo of def.manoObra) {
      await db.manoObraAPUEstandar.create({ data: { apuId: apu.id, categoria: mo.categoria, jornadaHs: 8, rendimiento: mo.rendimiento } });
    }
  }

  console.log("\n── Resumen ──");
  console.log(`Modo: ${aplicar ? "APLICADO A PRODUCCIÓN" : "DRY RUN (nada escrito)"}`);
  if (aplicar) {
    console.log(`SubrubroEstandar creados: ${creados}, actualizados: ${actualizados}`);
    const totalImperm = await db.subrubroEstandar.count({ where: { capituloId: capituloNuevoId, activo: true } });
    const totalVidrios = await db.subrubroEstandar.count({ where: { capituloId: vidrios.id, activo: true } });
    const totalCatalogo = await db.capituloCatalogo.count();
    console.log(`Total SubrubroEstandar activos en "${NOMBRE_CAPITULO_NUEVO}": ${totalImperm}`);
    console.log(`Total SubrubroEstandar activos en "${NOMBRE_VIDRIOS}": ${totalVidrios}`);
    console.log(`Total CapituloCatalogo: ${totalCatalogo}`);
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
