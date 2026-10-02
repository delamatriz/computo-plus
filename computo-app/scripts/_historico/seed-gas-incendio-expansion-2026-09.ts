// Expansión de biblioteca — Instalación de Gas y Contra Incendio (2/2).
//
// HISTORIA COMPLETA del capítulo, para que quien lea esto no tenga que
// reconstruirla de memoria (ese fue justamente el problema que motivó
// este script):
//   1. 17/07/2026 — siembra original vía scripts/seed-gas-incendio.ts:
//      8 códigos en Instalación de Gas (17.1-17.8) y 9 en Contra
//      Incendio (19.1-19.9). Documentado en commit 935d183 y en
//      CURRENT_SPRINT.md.
//   2. 13/09/2026 — alguien agregó 3 códigos más a Gas (17.9-17.11) y 2
//      más a Contra Incendio (19.10-19.11) vía un script ad hoc que
//      NUNCA se comiteó — no quedó rastro en ningún commit ni en
//      CURRENT_SPRINT.md ni en seed-gas-incendio.ts. Se descubrió recién
//      en el relevamiento de 26/09/2026 comparando `createdAt` en la
//      base contra el contenido del script trackeado. Los datos en sí
//      están bien armados (mismo patrón, con PrecioMTOP de referencia
//      para cada material), pero quedaron invisibles para cualquiera
//      que revisara el repo — incluida esta misma sesión, que tuvo que
//      hacer arqueología de base de datos para encontrarlos.
//   3. 26/09/2026 (este script) — 4 códigos más a Gas (17.12-17.15) y 5
//      más a Contra Incendio (19.12-19.16), confirmados por Luis en base
//      a normativa real (Decreto 216/002/URSEA para Gas; Decreto
//      372/023 e IT 01/2024 DNB para Contra Incendio). Esta vez SÍ queda
//      documentado acá y en CURRENT_SPRINT.md.
//
// Por qué es un script NUEVO y no una extensión de seed-gas-incendio.ts:
// ese script recalcula precioUY de TODOS los códigos que toca cada vez
// que corre (upsert con `update` que reescribe precioUY), usando el
// jornal VIGENTE de CategoriaLaboral al momento de la corrida — no el
// jornal de cuando se sembró originalmente. Los jornales SUNCA se
// actualizaron desde julio (convenio 2026-2027, commit 47c586e), así
// que volver a correr ese script hoy cambiaría (subiría) el precioUY ya
// guardado de los 22 códigos existentes, un efecto colateral fuera del
// alcance de este pedido (que es sumar 9 códigos, no recalcular los que
// ya existen). Este script solo toca los 9 códigos nuevos — upsert por
// `codigo`, así que correrlo de nuevo es seguro (no reprocesa el resto
// de la biblioteca).
//
// Nota de formato: el código real en base usa el esquema "17.X"/"19.X"
// (no "gas-XXX"/"incendio-XXX" como en el script original) — el
// esquema cambió en algún momento entre la siembra original y la
// expansión de septiembre, sin dejar rastro documentado de cuándo. Este
// script usa el esquema real vigente en base.
//
// Ejecutar (dry-run): npx tsx scripts/seed-gas-incendio-expansion-2026-09.ts
// Ejecutar (real):     npx tsx scripts/seed-gas-incendio-expansion-2026-09.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-09";
const GG_PCT = 15;
const UTIL_PCT = 10;

// ── PrecioMTOP nuevos (materiales sin cobertura en Lista MTOP N°599,
// ni en los 28 ya cargados por seed-gas-incendio.ts/la expansión de
// septiembre) ────────────────────────────────────────────────────────
const PRECIOS_MTOP_NUEVOS = [
  { codigo: "GAS-EXCAV-ACOMETIDA", descripcion: "Excavación y relleno manual de zanja para acometida de gas (prorrateo por ML)", unidad: "gl", precioUnitario: 350 },
  { codigo: "GAS-TASA-HABILITACION", descripcion: "Tasa de habilitación de instalación de gas ante DNB/distribuidora (trámite formal)", unidad: "gl", precioUnitario: 4500 },
  { codigo: "GAS-NATURAL-CONEXION", descripcion: "Conexión y accesorios para punto de gas natural por cañería (distinto de supergás)", unidad: "u", precioUnitario: 1350 },
  { codigo: "GAS-REGULADOR-1RA-ETAPA", descripcion: "Regulador de gas de primera etapa (alta presión, supergás)", unidad: "u", precioUnitario: 3200 },
  { codigo: "GAS-REGULADOR-2DA-ETAPA", descripcion: "Regulador de gas de segunda etapa (baja presión, domiciliario, supergás)", unidad: "u", precioUnitario: 2600 },

  { codigo: "INC-BOMBA-PRINCIPAL", descripcion: "Motobomba de incendio principal (diesel o eléctrica) homologada — normativa UNIT/IT 01/2024 DNB", unidad: "u", precioUnitario: 450000 },
  { codigo: "INC-BASE-MONTAJE-BOMBA", descripcion: "Base antivibratoria y accesorios de montaje para bomba de incendio", unidad: "gl", precioUnitario: 12000 },
  { codigo: "INC-BOMBA-JOCKEY", descripcion: "Bomba jockey de mantenimiento de presión — sistema contra incendio", unidad: "u", precioUnitario: 85000 },
  { codigo: "INC-HIDRANTE-COLUMNA", descripcion: "Hidrante de columna homologado — normativa UNIT", unidad: "u", precioUnitario: 45000 },
  { codigo: "INC-BASE-HIDRANTE", descripcion: "Base de anclaje y accesorios de conexión para hidrante de columna", unidad: "gl", precioUnitario: 6500 },
  { codigo: "INC-TANQUE-RESERVA", descripcion: "Tanque de reserva de agua para incendio (volumen según normativa IT 01/2024 DNB)", unidad: "gl", precioUnitario: 180000 },
  { codigo: "INC-VALVULERIA-TANQUE", descripcion: "Valvulería y accesorios de conexión para tanque de reserva contra incendio", unidad: "gl", precioUnitario: 15000 },
  { codigo: "INC-NICHO-EXTINTOR", descripcion: "Nicho/gabinete embutido para extintor con visor — según normativa", unidad: "u", precioUnitario: 8500 },
] as const;

// Materiales YA existentes (creados por seed-gas-incendio.ts o la
// expansión de septiembre) que se reutilizan acá — sus precios se leen
// en vivo desde PrecioMTOP más abajo, nunca hardcodeados, para no
// duplicar una fuente de verdad que ya vive en la base.
const CODIGOS_REUTILIZADOS = [
  "GAS-HIERRO-CANO-12",
  "GAS-HIERRO-ACC-ROSC",
  "MAT-GAS-CANO-12",
  "MAT-GAS-SOLDADURA",
  "MAT-GAS-ACCESORIOS-CAJA",
] as const;

type MaterialDef = { precioCodigo: string; rendimiento: number };
type ManoObraDef = { categoria: string; rendimiento: number };

const CODIGOS: {
  codigo: string;
  capitulo: "Instalación de Gas" | "Contra Incendio";
  descripcion: string;
  unidad: string;
  orden: number;
  materiales: MaterialDef[];
  manoObra: ManoObraDef[];
}[] = [
  {
    codigo: "17.12",
    capitulo: "Instalación de Gas",
    descripcion: "Acometida interior de gas (tramo entre línea de propiedad y medidor)",
    unidad: "ML",
    orden: 11,
    materiales: [
      { precioCodigo: "GAS-HIERRO-CANO-12", rendimiento: 1.05 },
      { precioCodigo: "GAS-HIERRO-ACC-ROSC", rendimiento: 0.2 },
      { precioCodigo: "GAS-EXCAV-ACOMETIDA", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Oficial Gasista", rendimiento: 10 },
      { categoria: "Ayudante", rendimiento: 8 },
    ],
  },
  {
    codigo: "17.13",
    capitulo: "Instalación de Gas",
    descripcion: "Certificado de instalación de gas (habilitación formal ante DNB/distribuidora)",
    unidad: "GL",
    orden: 12,
    materiales: [{ precioCodigo: "GAS-TASA-HABILITACION", rendimiento: 1 }],
    manoObra: [{ categoria: "Oficial Gasista", rendimiento: 1 }],
  },
  {
    codigo: "17.14",
    capitulo: "Instalación de Gas",
    descripcion: "Instalación para gas natural por cañería (distinta de supergás)",
    unidad: "U",
    orden: 13,
    materiales: [
      { precioCodigo: "MAT-GAS-CANO-12", rendimiento: 1.5 },
      { precioCodigo: "GAS-NATURAL-CONEXION", rendimiento: 1 },
      { precioCodigo: "MAT-GAS-SOLDADURA", rendimiento: 0.05 },
    ],
    manoObra: [
      { categoria: "Oficial Gasista", rendimiento: 3 },
      { categoria: "Ayudante", rendimiento: 3 },
    ],
  },
  {
    codigo: "17.15",
    capitulo: "Instalación de Gas",
    descripcion: "Regulador de primera/segunda etapa (específico de supergás)",
    unidad: "U",
    orden: 14,
    materiales: [
      { precioCodigo: "GAS-REGULADOR-1RA-ETAPA", rendimiento: 1 },
      { precioCodigo: "GAS-REGULADOR-2DA-ETAPA", rendimiento: 1 },
      { precioCodigo: "MAT-GAS-ACCESORIOS-CAJA", rendimiento: 1 },
    ],
    manoObra: [{ categoria: "Oficial Gasista", rendimiento: 4 }],
  },

  {
    codigo: "19.12",
    capitulo: "Contra Incendio",
    descripcion: "Bomba de incendio principal",
    unidad: "U",
    orden: 11,
    materiales: [
      { precioCodigo: "INC-BOMBA-PRINCIPAL", rendimiento: 1 },
      { precioCodigo: "INC-BASE-MONTAJE-BOMBA", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Plomero oficial", rendimiento: 0.5 },
      { categoria: "Ayudante", rendimiento: 0.5 },
    ],
  },
  {
    codigo: "19.13",
    capitulo: "Contra Incendio",
    descripcion: "Bomba jockey (mantiene presión del sistema)",
    unidad: "U",
    orden: 12,
    materiales: [
      { precioCodigo: "INC-BOMBA-JOCKEY", rendimiento: 1 },
      { precioCodigo: "INC-BASE-MONTAJE-BOMBA", rendimiento: 1 },
    ],
    manoObra: [{ categoria: "Plomero oficial", rendimiento: 1 }],
  },
  {
    codigo: "19.14",
    capitulo: "Contra Incendio",
    descripcion: "Hidrante urbano/de columna",
    unidad: "U",
    orden: 13,
    materiales: [
      { precioCodigo: "INC-HIDRANTE-COLUMNA", rendimiento: 1 },
      { precioCodigo: "INC-BASE-HIDRANTE", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Oficial albañil", rendimiento: 1 },
      { categoria: "Ayudante", rendimiento: 1 },
    ],
  },
  {
    codigo: "19.15",
    capitulo: "Contra Incendio",
    descripcion: "Reserva de agua para incendio (tanque exclusivo)",
    unidad: "GL",
    orden: 14,
    materiales: [
      { precioCodigo: "INC-TANQUE-RESERVA", rendimiento: 1 },
      { precioCodigo: "INC-VALVULERIA-TANQUE", rendimiento: 1 },
    ],
    manoObra: [
      { categoria: "Plomero oficial", rendimiento: 0.5 },
      { categoria: "Oficial albañil", rendimiento: 0.5 },
    ],
  },
  {
    codigo: "19.16",
    capitulo: "Contra Incendio",
    descripcion: "Nicho embutido para extintor (con visualización, según normativa)",
    unidad: "U",
    orden: 15,
    materiales: [{ precioCodigo: "INC-NICHO-EXTINTOR", rendimiento: 1 }],
    manoObra: [
      { categoria: "Oficial albañil", rendimiento: 2 },
      { categoria: "Ayudante", rendimiento: 2 },
    ],
  },
];

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);

  // ── 1. Resolver capítulos existentes (no se crean — ya existen) ───
  const capitulos = await db.capituloCatalogo.findMany({
    where: { nombre: { in: ["Instalación de Gas", "Contra Incendio"] } },
  });
  const capituloIdPorNombre = new Map(capitulos.map((c) => [c.nombre, c.id]));
  console.log("── Capítulos ──");
  for (const [nombre, id] of capituloIdPorNombre) console.log(`  = "${nombre}" [id=${id}]`);
  if (capituloIdPorNombre.size !== 2) {
    console.error("⚠ No se encontraron los 2 capítulos esperados — abortando.");
    await db.$disconnect();
    process.exit(1);
  }

  // ── 2. PrecioMTOP nuevos ───────────────────────────────────────────
  // Nota: PrecioMTOP.codigo dejó de ser @unique solo (pasó a
  // @@unique([codigo, proveedor]) para soportar listas de proveedor —
  // ver comentario en schema.prisma). proveedor es null en estos
  // materiales de referencia, y un compound unique con campo nulo no es
  // confiable para upsert() en Prisma/Postgres — se resuelve con
  // findFirst + create/update manual en vez de upsert().
  console.log("\n── PrecioMTOP (materiales nuevos) ──");
  for (const precio of PRECIOS_MTOP_NUEVOS) {
    const existente = await db.precioMTOP.findFirst({ where: { codigo: precio.codigo, proveedor: null } });
    console.log(
      `  ${existente ? "= ya existe" : "+ nuevo"} — ${precio.codigo} — ${precio.descripcion} ($${precio.precioUnitario}/${precio.unidad})`
    );
    if (aplicar) {
      if (existente) {
        await db.precioMTOP.update({
          where: { id: existente.id },
          data: { precioUnitario: precio.precioUnitario, precioConIva: precio.precioUnitario },
        });
      } else {
        await db.precioMTOP.create({
          data: {
            codigo: precio.codigo,
            descripcion: precio.descripcion,
            cantidadUnidad: `1 ${precio.unidad}`,
            unidad: precio.unidad,
            cantidad: 1,
            precioConIva: precio.precioUnitario,
            precioUnitario: precio.precioUnitario,
            numeroLista: 0,
            fechaLista: FECHA,
          },
        });
      }
    }
  }

  // ── 3. Precios reutilizados — leídos en vivo, nunca hardcodeados ──
  console.log("\n── Materiales reutilizados (precio leído en vivo) ──");
  const precioMTOPExistentes = await db.precioMTOP.findMany({
    where: { codigo: { in: [...CODIGOS_REUTILIZADOS] } },
  });
  for (const codigo of CODIGOS_REUTILIZADOS) {
    const p = precioMTOPExistentes.find((x) => x.codigo === codigo);
    console.log(`  ${p ? `= ${codigo} — $${p.precioUnitario}` : `⚠ ${codigo} — NO ENCONTRADO en PrecioMTOP`}`);
  }

  const precioPorCodigo = new Map<string, { descripcion: string; unidad: string; precioUnitario: number }>();
  for (const p of PRECIOS_MTOP_NUEVOS) precioPorCodigo.set(p.codigo, p);
  for (const p of precioMTOPExistentes) {
    precioPorCodigo.set(p.codigo, { descripcion: p.descripcion, unidad: p.unidad, precioUnitario: p.precioUnitario });
  }

  // ── 4. Jornales vigentes ───────────────────────────────────────────
  const categoriasLaborales = await db.categoriaLaboral.findMany();
  const jornalPorNombre = (nombre: string) =>
    categoriasLaborales.find((c) => c.nombre.trim().toLowerCase() === nombre.trim().toLowerCase())?.jornal ?? 0;

  // ── 5. SubrubroEstandar + APUEstandar (SOLO los 9 códigos nuevos) ──
  console.log("\n── SubrubroEstandar + APUEstandar ──");
  let creados = 0;
  let actualizados = 0;
  for (const def of CODIGOS) {
    const capituloId = capituloIdPorNombre.get(def.capitulo)!;

    const sumMat = def.materiales.reduce((s, m) => {
      const precio = precioPorCodigo.get(m.precioCodigo);
      if (!precio) console.warn(`      ⚠ material "${m.precioCodigo}" sin precio resuelto — se computa como $0`);
      return s + m.rendimiento * (precio?.precioUnitario ?? 0);
    }, 0);
    const sumMO = def.manoObra.reduce((s, mo) => s + jornalPorNombre(mo.categoria) / mo.rendimiento, 0);
    const costoDirecto = sumMat + sumMO;
    const precioUY = Math.round(costoDirecto * (1 + GG_PCT / 100) * (1 + UTIL_PCT / 100) * 100) / 100;

    const yaExiste = await db.subrubroEstandar.findUnique({ where: { codigo: def.codigo } });
    console.log(
      `  ${yaExiste ? "= actualiza" : "+ crea"} ${def.codigo} — ${def.descripcion} (${def.unidad}) — $${precioUY}/${def.unidad} (${def.materiales.length} material(es), ${def.manoObra.length} línea(s) MO)`
    );
    def.materiales.forEach((m) => {
      const p = precioPorCodigo.get(m.precioCodigo);
      console.log(`      material: ${p?.descripcion ?? m.precioCodigo} — rendimiento ${m.rendimiento} ${p?.unidad ?? "?"} — $${p?.precioUnitario ?? 0}/${p?.unidad ?? "?"}`);
    });
    def.manoObra.forEach((mo) => {
      console.log(`      MO: ${mo.categoria} — rendimiento ${mo.rendimiento} ${def.unidad}/jornada — jornal $${jornalPorNombre(mo.categoria)}`);
    });

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
        orden: def.orden,
        capituloId,
      },
      update: {
        descripcion: def.descripcion,
        unidad: def.unidad,
        precioUY,
        orden: def.orden,
        capituloId,
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
      const p = precioPorCodigo.get(m.precioCodigo)!;
      await db.materialAPUEstandar.create({
        data: { apuId: apu.id, descripcion: p.descripcion, unidad: p.unidad, rendimiento: m.rendimiento },
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
    const totalGas = await db.subrubroEstandar.count({ where: { capituloId: capituloIdPorNombre.get("Instalación de Gas") } });
    const totalIncendio = await db.subrubroEstandar.count({ where: { capituloId: capituloIdPorNombre.get("Contra Incendio") } });
    console.log(`Total subrubros en Instalación de Gas: ${totalGas}`);
    console.log(`Total subrubros en Contra Incendio: ${totalIncendio}`);
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
