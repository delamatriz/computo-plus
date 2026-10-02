// Expansión de biblioteca — Herrería de Obra (dentro de Estructura,
// existente) + CapituloCatalogo nuevo "Estructura Metálica" (orden 23).
//
// herreria-obra-001/002: van en un subcapítulo NUEVO "Herrería de Obra"
// dentro de CapituloCatalogo "Estructura" (ya existente, no se crea
// capítulo nuevo). Reusan "Hierro para hormigón armado" (MAT-HIERRO-ARM,
// $85/kg) — mismo material que ya usan 5.1.1/5.1.2/5.1.3/4.2.5/4.2.6 etc.
// MO: "Oficial especializado" — confirmado que es la categoría que esta
// biblioteca ya usa para armado de hierro (ver 5.1.1, que la incluye
// junto a Oficial albañil/Peón).
//
// "Estructura Metálica" (CapituloCatalogo nuevo, orden 23): 2
// subcapítulos, "Columnas y Vigas" y "Terminación y Protección".
//
// Decisión de diseño (perfil IPN): NO se agregaron variantes de tamaño
// de perfil (IPN 100/160/200mm) — el precio ya está en $/kg, y el
// tamaño de perfil es una decisión de cómputo del proyecto real (cuántos
// kg necesita esa estructura), no del catálogo de referencia. Un solo
// código por kg cubre cualquier tamaño de IPN/doble T. Se reusa "Perfil
// de hierro normal (IPN 120mm)" ($140.42/kg, único perfil con
// PrecioMTOP real ya cargado) como base de precio.
//
// estmet-001/002 reusan el mismo patrón de materiales que cubierta-013
// (Estructura metálica para cubierta): perfil + electrodos de soldadura
// + pintura anticorrosiva de base — los 3 ya tienen PrecioMTOP real
// (perfil IPN, MAT-ELECTRODOS, MAT-ANTICORR), no se recrean.
//
// MO para toda Estructura Metálica: "Oficial especializado" — misma
// categoría que ya usa cubierta-013 para este tipo de trabajo (no existe
// una categoría SUNCA específica de "herrero/soldador de estructura" en
// el sistema). estmet-005 (pintura) usa "Pintor oficial" — sí existe esa
// categoría específica y es la correcta para un trabajo de pintura.
//
// Solo 2 PrecioMTOP genuinamente nuevos: "Perno de anclaje para pórtico
// metálico" (estmet-003) y "Servicio de galvanizado en caliente"
// (estmet-004, sin fuente Uruguay encontrada — estimación gruesa a
// verificar).
//
// Fórmula: costoDirecto × (1+GG%) × (1+Util%), GG=15/Util=10, sin capa de
// leyes sociales (mismo criterio de toda esta expansión).
//
// Ejecutar (dry-run): npx tsx scripts/seed-herreria-estructura-metalica.ts
// Ejecutar (real):     npx tsx scripts/seed-herreria-estructura-metalica.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;

const NOMBRE_ESTRUCTURA = "Estructura";
const SUB_HERRERIA_OBRA = "Herrería de Obra";

const NOMBRE_ESTMET = "Estructura Metálica";
const ORDEN_ESTMET = 23;
const SUB_COLUMNAS_VIGAS = "Columnas y Vigas";
const SUB_TERMINACION = "Terminación y Protección";

// ── Materiales reusados (ya existen, NO se crean) ────────────────────
const REUSO = {
  HIERRO_ARMADO: { descripcion: "Hierro para hormigón armado", unidad: "kg", precioUnitario: 85 },
  PERFIL_IPN120: { descripcion: "Perfil de hierro normal (IPN 120 mm)", unidad: "kg", precioUnitario: 140.42 },
  ELECTRODOS: { descripcion: "Electrodos de soldadura", unidad: "u", precioUnitario: 25 },
  ANTICORROSIVA: { descripcion: "Pintura anticorrosiva", unidad: "l", precioUnitario: 285 },
  ESMALTE_SINTETICO: { descripcion: "Esmalte sintetico", unidad: "l", precioUnitario: 874.36 },
};

// ── PrecioMTOP nuevos (solo 2) ────────────────────────────────────────
const PRECIOS_NUEVOS = [
  { codigo: "MAT-ESTMET-PERNO-ANCLAJE", descripcion: "Perno de anclaje para pórtico metálico", unidad: "u", precioUnitario: 450 },
  { codigo: "MAT-ESTMET-GALVANIZADO", descripcion: "Servicio de galvanizado en caliente (por kg)", unidad: "kg", precioUnitario: 95 },
] as const;

type MaterialDef = { descripcion: string; unidad: string; rendimiento: number; precioUnitario: number };
type ManoObraDef = { categoria: string; rendimiento: number };
type SubrubroDef = {
  codigo: string;
  descripcion: string;
  unidad: string;
  destino: "HERRERIA_OBRA" | "ESTMET_COLUMNAS" | "ESTMET_TERMINACION";
  materiales: MaterialDef[];
  manoObra: ManoObraDef[];
};

const precioPorCodigo = new Map<string, (typeof PRECIOS_NUEVOS)[number]>(PRECIOS_NUEVOS.map((p) => [p.codigo, p]));
const nuevo = (codigo: string, rendimiento: number): MaterialDef => {
  const p = precioPorCodigo.get(codigo)!;
  return { descripcion: p.descripcion, unidad: p.unidad, rendimiento, precioUnitario: p.precioUnitario };
};
const reuso = (r: { descripcion: string; unidad: string; precioUnitario: number }, rendimiento: number): MaterialDef => ({ ...r, rendimiento });

const CODIGOS: SubrubroDef[] = [
  {
    codigo: "herreria-obra-001",
    descripcion: "Provisión y colocación de hierro para armado (suelto, por kg)",
    unidad: "KG",
    destino: "HERRERIA_OBRA",
    materiales: [reuso(REUSO.HIERRO_ARMADO, 1.02)],
    manoObra: [
      { categoria: "Oficial especializado", rendimiento: 180 },
      { categoria: "Peón", rendimiento: 180 },
    ],
  },
  {
    codigo: "herreria-obra-002",
    descripcion: "Estribos y separadores para hormigón armado",
    unidad: "KG",
    destino: "HERRERIA_OBRA",
    materiales: [reuso(REUSO.HIERRO_ARMADO, 1.05)],
    manoObra: [
      { categoria: "Oficial especializado", rendimiento: 220 },
      { categoria: "Peón", rendimiento: 220 },
    ],
  },
  {
    codigo: "estmet-001",
    descripcion: "Pilar de hierro (perfil IPN/doble T)",
    unidad: "KG",
    destino: "ESTMET_COLUMNAS",
    materiales: [reuso(REUSO.PERFIL_IPN120, 1.05), reuso(REUSO.ELECTRODOS, 0.3), reuso(REUSO.ANTICORROSIVA, 0.05)],
    manoObra: [
      { categoria: "Oficial especializado", rendimiento: 25 },
      { categoria: "Peón", rendimiento: 25 },
    ],
  },
  {
    codigo: "estmet-002",
    descripcion: "Viga de hierro (perfil IPN/doble T)",
    unidad: "KG",
    destino: "ESTMET_COLUMNAS",
    materiales: [reuso(REUSO.PERFIL_IPN120, 1.05), reuso(REUSO.ELECTRODOS, 0.3), reuso(REUSO.ANTICORROSIVA, 0.05)],
    manoObra: [
      { categoria: "Oficial especializado", rendimiento: 28 },
      { categoria: "Peón", rendimiento: 28 },
    ],
  },
  {
    codigo: "estmet-003",
    descripcion:
      "Pórtico de hierro completo (columnas + viga, luz típica residencial ~4-6m, ~130kg de acero) — referencia rápida; para proyectos reales se recomienda usar estmet-001/002 por kg con el cómputo real de la estructura",
    unidad: "GL",
    destino: "ESTMET_COLUMNAS",
    materiales: [
      reuso(REUSO.PERFIL_IPN120, 130),
      reuso(REUSO.ELECTRODOS, 39),
      reuso(REUSO.ANTICORROSIVA, 6.5),
      nuevo("MAT-ESTMET-PERNO-ANCLAJE", 8),
    ],
    manoObra: [
      { categoria: "Oficial especializado", rendimiento: 0.5 },
      { categoria: "Peón", rendimiento: 0.5 },
    ],
  },
  {
    codigo: "estmet-004",
    descripcion: "Galvanizado en caliente de estructura metálica",
    unidad: "KG",
    destino: "ESTMET_TERMINACION",
    materiales: [nuevo("MAT-ESTMET-GALVANIZADO", 1)],
    manoObra: [],
  },
  {
    codigo: "estmet-005",
    descripcion: "Pintura anticorrosiva (antióxido + esmalte sintético) sobre estructura",
    unidad: "M2",
    destino: "ESTMET_TERMINACION",
    materiales: [reuso(REUSO.ANTICORROSIVA, 0.15), reuso(REUSO.ESMALTE_SINTETICO, 0.12)],
    manoObra: [
      { categoria: "Pintor oficial", rendimiento: 15 },
      { categoria: "Ayudante", rendimiento: 15 },
    ],
  },
];

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);

  const estructura = await db.capituloCatalogo.findUnique({ where: { nombre: NOMBRE_ESTRUCTURA } });
  if (!estructura) {
    console.error(`Falta CapituloCatalogo "${NOMBRE_ESTRUCTURA}" — abortando.`);
    await db.$disconnect();
    process.exit(1);
  }

  // ── 1. Subcapítulo "Herrería de Obra" dentro de Estructura ───────────
  console.log(`── Subcapítulo "${SUB_HERRERIA_OBRA}" dentro de "${NOMBRE_ESTRUCTURA}" ──`);
  const existenteHerreria = await db.subcapituloCatalogo.findUnique({
    where: { capituloCatalogoId_nombre: { capituloCatalogoId: estructura.id, nombre: SUB_HERRERIA_OBRA } },
  });
  console.log(`  ${existenteHerreria ? "= ya existe" : "+ nuevo"} — "${SUB_HERRERIA_OBRA}" (orden 3)`);
  let subHerreriaId = existenteHerreria?.id;
  if (aplicar && !existenteHerreria) {
    const creado = await db.subcapituloCatalogo.create({ data: { capituloCatalogoId: estructura.id, nombre: SUB_HERRERIA_OBRA, orden: 3 } });
    subHerreriaId = creado.id;
  }

  // ── 2. CapituloCatalogo "Estructura Metálica" + 2 subcapítulos ───────
  console.log(`\n── CapituloCatalogo "${NOMBRE_ESTMET}" ──`);
  const existenteEstmet = await db.capituloCatalogo.findUnique({ where: { nombre: NOMBRE_ESTMET } });
  console.log(`  ${existenteEstmet ? "= ya existe" : "+ nuevo"} — "${NOMBRE_ESTMET}" (orden ${ORDEN_ESTMET})`);
  let estmetId = existenteEstmet?.id;
  if (aplicar && !existenteEstmet) {
    const creado = await db.capituloCatalogo.create({ data: { nombre: NOMBRE_ESTMET, orden: ORDEN_ESTMET, activo: true } });
    estmetId = creado.id;
  }

  console.log(`\n── SubcapituloCatalogo de "${NOMBRE_ESTMET}" ──`);
  const nombresSubEstmet = [SUB_COLUMNAS_VIGAS, SUB_TERMINACION];
  const subEstmetIds: Record<string, string | undefined> = {};
  for (let i = 0; i < nombresSubEstmet.length; i++) {
    const nombre = nombresSubEstmet[i];
    const existenteSub = estmetId
      ? await db.subcapituloCatalogo.findUnique({ where: { capituloCatalogoId_nombre: { capituloCatalogoId: estmetId, nombre } } })
      : null;
    console.log(`  ${existenteSub ? "= ya existe" : "+ nuevo"} — "${nombre}" (orden ${i + 1})`);
    subEstmetIds[nombre] = existenteSub?.id;
    if (aplicar && estmetId && !existenteSub) {
      const creado = await db.subcapituloCatalogo.create({ data: { capituloCatalogoId: estmetId, nombre, orden: i + 1 } });
      subEstmetIds[nombre] = creado.id;
    }
  }

  // ── 3. PrecioMTOP nuevos ──────────────────────────────────────────────
  console.log("\n── PrecioMTOP nuevos (solo 2 — el resto se reusa) ──");
  for (const p of PRECIOS_NUEVOS) {
    const existenteP = await db.precioMTOP.findUnique({ where: { codigo: p.codigo } });
    console.log(`  ${existenteP ? "= ya existe" : "+ nuevo"} — ${p.codigo} — ${p.descripcion} ($${p.precioUnitario}/${p.unidad})`);
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
  console.log(
    `\nReusados (sin PrecioMTOP nuevo): ${Object.keys(REUSO).length} (Hierro p/hormigón armado, Perfil IPN 120mm, Electrodos, Pintura anticorrosiva, Esmalte sintético)`
  );

  // ── 4. SubrubroEstandar + APUEstandar ──────────────────────────────────
  console.log("\n── SubrubroEstandar + APUEstandar ──");
  const categoriasLaborales = await db.categoriaLaboral.findMany();
  const jornalPorNombre = (nombre: string) =>
    categoriasLaborales.find((c) => c.nombre.trim().toLowerCase() === nombre.trim().toLowerCase())?.jornal ?? 0;

  let creados = 0;
  let actualizados = 0;
  for (const def of CODIGOS) {
    const capituloId = def.destino === "HERRERIA_OBRA" ? estructura.id : estmetId;
    const subcapituloId =
      def.destino === "HERRERIA_OBRA"
        ? subHerreriaId
        : def.destino === "ESTMET_COLUMNAS"
        ? subEstmetIds[SUB_COLUMNAS_VIGAS]
        : subEstmetIds[SUB_TERMINACION];

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
    if (def.manoObra.length === 0) console.log("      (sin MO — servicio externo, como galvanizado por terceros)");

    if (!aplicar) continue;

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
    const totalHerreria = await db.subrubroEstandar.count({ where: { subcapituloId: subHerreriaId, activo: true } });
    const totalEstmet = await db.subrubroEstandar.count({ where: { capituloId: estmetId, activo: true } });
    const totalCatalogo = await db.capituloCatalogo.count();
    console.log(`Total SubrubroEstandar activos en "${SUB_HERRERIA_OBRA}": ${totalHerreria}`);
    console.log(`Total SubrubroEstandar activos en "${NOMBRE_ESTMET}": ${totalEstmet}`);
    console.log(`Total CapituloCatalogo: ${totalCatalogo}`);
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
