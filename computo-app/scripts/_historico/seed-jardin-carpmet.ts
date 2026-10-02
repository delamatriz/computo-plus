// Expansión de biblioteca — Obra Exterior/Jardín (parrillero/quincho,
// cercos, iluminación exterior, riego automático) + 2 códigos que
// quedaron mejor ubicados en Subcontratos - Carpinterías/Hierro (portón
// peatonal, motor para portón corredizo — mismo oficio que sus pares
// 7.3.15/7.3.16/carpmet-004/005, no se crea una categoría paralela).
//
// jardin-002 (quincho): 2 variantes. Default = estructura de madera
// (tirantería/correas + teja colonial) — la más típica/económica en
// Uruguay para esta escala (9-15 m2); reusa la MISMA composición real de
// cubierta-010 + cubierta-001 (con PrecioMTOP propio, esos 2 códigos de
// Cubierta/Techos no tienen precio asociado). jardin-002b = estructura
// metálica (perfil IPN + chapa ondulada), para mayor robustez/luces
// mayores, precio más alto.
//
// NO se crea CapituloCatalogo ni SubcapituloCatalogo nuevo — reusa
// "Subcontratos - Acondicionamientos" / "Obra Exterior / Jardín" (ya
// resuelto por ParticionSubcapitulo desde la Etapa 5, NO se toca esa
// estructura) y "Subcontratos - Carpinterías" / "Hierro" (ya existente).
//
// Sin capa de leyes sociales (confirmado con el usuario: ningún script
// anterior de esta expansión — gas/incendio, ascensor, impermeabilización/
// vidrios — la aplica; es un módulo aparte del presupuesto real, no del
// precio de referencia de biblioteca). Fórmula: costoDirecto × (1+GG%) ×
// (1+Util%), GG=15/Util=10.
//
// aportesSociales queda en su default (0), mismo criterio de siempre.
//
// Ejecutar (dry-run): npx tsx scripts/seed-jardin-carpmet.ts
// Ejecutar (real):     npx tsx scripts/seed-jardin-carpmet.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;

const NOMBRE_ACOND = "Subcontratos - Acondicionamientos";
const NOMBRE_SUB_JARDIN = "Obra Exterior / Jardín";
const NOMBRE_CARPINTERIAS = "Subcontratos - Carpinterías";
const NOMBRE_SUB_HIERRO = "Hierro";

// ── PrecioMTOP nuevos (genuinamente nuevos, sin cobertura MTOP/biblioteca) ──
const PRECIOS_NUEVOS = [
  { codigo: "MAT-JARDIN-LADRILLO-REFRACTARIO", descripcion: "Ladrillo refractario", unidad: "u", precioUnitario: 180 },
  { codigo: "MAT-JARDIN-TEJIDO-ROMBOIDAL", descripcion: "Tejido romboidal galvanizado", unidad: "m2", precioUnitario: 450 },
  { codigo: "MAT-JARDIN-POSTE-HORMIGON", descripcion: "Poste de hormigón para cerco", unidad: "u", precioUnitario: 650 },
  { codigo: "MAT-JARDIN-SETO-PLANTA", descripcion: "Planta para seto/cerco vivo", unidad: "u", precioUnitario: 180 },
  { codigo: "MAT-JARDIN-SUSTRATO", descripcion: "Sustrato/tierra negra para plantación", unidad: "m3", precioUnitario: 950 },
  { codigo: "MAT-JARDIN-COLUMNA-LED", descripcion: "Columna de jardín LED", unidad: "u", precioUnitario: 4500 },
  { codigo: "MAT-JARDIN-FOCO-PISO", descripcion: "Foco empotrado de piso exterior IP68", unidad: "u", precioUnitario: 3200 },
  { codigo: "MAT-JARDIN-REFLECTOR-FACHADA", descripcion: "Reflector LED de fachada", unidad: "u", precioUnitario: 2800 },
  { codigo: "MAT-JARDIN-FOCO-PISCINA", descripcion: "Foco subacuático LED para piscina", unidad: "u", precioUnitario: 6500 },
  { codigo: "MAT-JARDIN-TRANSFORMADOR-12V", descripcion: "Transformador de seguridad 12V para piscina", unidad: "u", precioUnitario: 2200 },
  { codigo: "MAT-JARDIN-ASPERSOR", descripcion: "Aspersor emergente", unidad: "u", precioUnitario: 450 },
  { codigo: "MAT-JARDIN-TUBERIA-PE", descripcion: "Tubería PE para riego", unidad: "ml", precioUnitario: 85 },
  { codigo: "MAT-JARDIN-PROGRAMADOR-RIEGO", descripcion: "Programador de riego", unidad: "u", precioUnitario: 3500 },
  { codigo: "MAT-JARDIN-VALVULA-SOLENOIDE", descripcion: "Válvula solenoide para riego", unidad: "u", precioUnitario: 980 },
  { codigo: "MAT-JARDIN-MANGUERA-GOTEO", descripcion: "Manguera de goteo", unidad: "ml", precioUnitario: 65 },
  { codigo: "MAT-JARDIN-GOTERO", descripcion: "Gotero autocompensado", unidad: "u", precioUnitario: 35 },
  { codigo: "MAT-JARDIN-FILTRO-RIEGO", descripcion: "Filtro y regulador de presión para riego", unidad: "u", precioUnitario: 1200 },
  { codigo: "MAT-CARPMET-PORTON-PEATONAL", descripcion: "Portón peatonal de hierro/aluminio", unidad: "u", precioUnitario: 8500 },
  { codigo: "MAT-CARPMET-MOTOR-CORREDIZO", descripcion: "Motor para portón corredizo", unidad: "u", precioUnitario: 18000 },
  { codigo: "MAT-CARPMET-ACCESORIOS-MOTOR", descripcion: "Accesorios instalación motor portón corredizo", unidad: "gl", precioUnitario: 1200 },
  // jardin-002 (madera) — mismas descripciones de material que ya usan
  // cubierta-010/cubierta-001 (se reusa la composición real, NO se
  // duplica el código de cubierta), pero con PrecioMTOP propio: esos 2
  // códigos de Cubierta/Techos no tienen PrecioMTOP asociado (mismo gap
  // que 7.2.30/31 de Ascensor y 7.4.X de Vidrios) y clonarían a $0 si no
  // se les da precio acá.
  { codigo: "MAT-JARDIN-MADERA-ESTRUCTURA-TECHO", descripcion: "Madera para estructura de techo", unidad: "m2", precioUnitario: 22500 },
  { codigo: "MAT-JARDIN-CLAVOS-ESTRUCTURA", descripcion: "Clavos para estructura", unidad: "kg", precioUnitario: 150 },
  { codigo: "MAT-JARDIN-LISTON-TEJA", descripcion: "Listón de madera para teja", unidad: "ml", precioUnitario: 180 },
  { codigo: "MAT-JARDIN-CLAVOS-TEJA", descripcion: "Clavos para teja", unidad: "kg", precioUnitario: 150 },
] as const;

// ── Materiales reusados (ya existen en la biblioteca, NO se crean) ──────
const REUSO = {
  BLOQUE_1919: { descripcion: "Bloque hormigón 19x19x39", unidad: "u", precioUnitario: 85 },
  HIERRO_12MM: { descripcion: "Hierro redondo, diametro 12 mm", unidad: "kg", precioUnitario: 223.61 },
  CEMENTO: { descripcion: "Cemento portland gris (Montevideo, en bolsa, en obra)", unidad: "kg", precioUnitario: 25.7 },
  ARENA_GRUESA: { descripcion: "Arena gruesa (en obra)", unidad: "m3", precioUnitario: 1091.65 },
  CHAPA_LISA_18: { descripcion: "Chapa de hierro galvanizado, lisa, Nro. 18, medida: 2x1 m", unidad: "kg", precioUnitario: 532.64 },
  CHAPA_ONDULADA_24: { descripcion: "Chapa de hierro galvanizada, ondulada, Nro. 24, medida: 1.8 a 3 m", unidad: "kg", precioUnitario: 463.57 },
  PERFIL_IPN120: { descripcion: "Perfil de hierro normal (IPN 120 mm)", unidad: "kg", precioUnitario: 140.42 },
  REVOQUE_2EN1: { descripcion: "Revoque premezclado 2 en 1 (bolsa 25kg)", unidad: "bolsa", precioUnitario: 305.75 },
  ALAMBRE_GALV: { descripcion: "Alambre galvanizado Nro. 16/14 (en rollo)", unidad: "kg", precioUnitario: 1059.66 },
  POSTE_EUCALIPTUS: { descripcion: "Madera. Poste de eucaliptus tratado, diametro: 12 cm., longitud 2,2 m.", unidad: "u", precioUnitario: 426.77 },
  TARUGO_TORNILLO: { descripcion: "Tarugo plástico 6mm c/tornillo", unidad: "u", precioUnitario: 8.5 },
  TORNILLOS_HERRAJES: { descripcion: "Tornillos y herrajes metálicos", unidad: "gl", precioUnitario: 450 },
  TEJA_COLONIAL: { descripcion: "Teja colonial", unidad: "u", precioUnitario: 55 },
};

type MaterialDef = { descripcion: string; unidad: string; rendimiento: number; precioUnitario: number };
type ManoObraDef = { categoria: string; rendimiento: number };
type SubrubroDef = {
  codigo: string;
  descripcion: string;
  unidad: string;
  destino: "JARDIN" | "CARPMET";
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
    codigo: "jardin-001",
    descripcion: "Parrillero de mampostería (parrilla de hierro + campana de humos y chimenea)",
    unidad: "UNI",
    destino: "JARDIN",
    materiales: [
      reuso(REUSO.BLOQUE_1919, 50),
      nuevo("MAT-JARDIN-LADRILLO-REFRACTARIO", 40),
      reuso(REUSO.HIERRO_12MM, 8),
      reuso(REUSO.CEMENTO, 80),
      reuso(REUSO.ARENA_GRUESA, 0.15),
      reuso(REUSO.CHAPA_LISA_18, 15),
    ],
    manoObra: [
      { categoria: "Oficial albañil", rendimiento: 0.25 },
      { categoria: "Ayudante", rendimiento: 0.25 },
    ],
  },
  {
    codigo: "jardin-002",
    descripcion: "Quincho techado completo — estructura de madera (tirantería/correas) con cubierta de teja colonial",
    unidad: "M2",
    destino: "JARDIN",
    materiales: [
      reuso(REUSO.BLOQUE_1919, 8),
      reuso(REUSO.CEMENTO, 15),
      reuso(REUSO.ARENA_GRUESA, 0.03),
      reuso(REUSO.REVOQUE_2EN1, 1),
      nuevo("MAT-JARDIN-MADERA-ESTRUCTURA-TECHO", 0.04),
      nuevo("MAT-JARDIN-CLAVOS-ESTRUCTURA", 0.15),
      reuso(REUSO.TEJA_COLONIAL, 16),
      nuevo("MAT-JARDIN-LISTON-TEJA", 3),
      nuevo("MAT-JARDIN-CLAVOS-TEJA", 0.1),
    ],
    manoObra: [
      { categoria: "Oficial albañil", rendimiento: 2 },
      { categoria: "Ayudante", rendimiento: 2 },
      { categoria: "Oficial especializado", rendimiento: 12 },
      { categoria: "Peón", rendimiento: 12 },
      { categoria: "Oficial albañil", rendimiento: 10 },
      { categoria: "Peón", rendimiento: 10 },
    ],
  },
  {
    codigo: "jardin-002b",
    descripcion: "Quincho techado completo — estructura metálica (perfil IPN) con cubierta de chapa ondulada",
    unidad: "M2",
    destino: "JARDIN",
    materiales: [
      reuso(REUSO.BLOQUE_1919, 8),
      reuso(REUSO.CEMENTO, 15),
      reuso(REUSO.ARENA_GRUESA, 0.03),
      reuso(REUSO.CHAPA_ONDULADA_24, 3),
      reuso(REUSO.PERFIL_IPN120, 5),
      reuso(REUSO.REVOQUE_2EN1, 1),
    ],
    manoObra: [
      { categoria: "Oficial albañil", rendimiento: 0.5 },
      { categoria: "Ayudante", rendimiento: 0.5 },
    ],
  },
  {
    codigo: "jardin-003",
    descripcion: "Cerco perimetral definitivo con tejido romboidal galvanizado (h≈2,00m)",
    unidad: "ML",
    destino: "JARDIN",
    materiales: [
      nuevo("MAT-JARDIN-TEJIDO-ROMBOIDAL", 2),
      nuevo("MAT-JARDIN-POSTE-HORMIGON", 0.33),
      reuso(REUSO.ALAMBRE_GALV, 0.3),
      reuso(REUSO.CEMENTO, 3),
    ],
    manoObra: [
      { categoria: "Oficial albañil", rendimiento: 4 },
      { categoria: "Ayudante", rendimiento: 4 },
    ],
  },
  {
    codigo: "jardin-003b",
    descripcion: "Cerco perimetral tradicional (postes + hilos, sin tejido)",
    unidad: "ML",
    destino: "JARDIN",
    materiales: [reuso(REUSO.POSTE_EUCALIPTUS, 0.2), reuso(REUSO.ALAMBRE_GALV, 1.2)],
    manoObra: [
      { categoria: "Oficial albañil", rendimiento: 8 },
      { categoria: "Ayudante", rendimiento: 8 },
    ],
  },
  {
    codigo: "jardin-004",
    descripcion: "Cerco vivo/vegetal (seto perimetral)",
    unidad: "ML",
    destino: "JARDIN",
    materiales: [nuevo("MAT-JARDIN-SETO-PLANTA", 2), nuevo("MAT-JARDIN-SUSTRATO", 0.05)],
    manoObra: [{ categoria: "Peón", rendimiento: 6 }],
  },
  {
    codigo: "jardin-005",
    descripcion: "Columna de jardín (iluminación)",
    unidad: "U",
    destino: "JARDIN",
    materiales: [nuevo("MAT-JARDIN-COLUMNA-LED", 1), reuso(REUSO.TARUGO_TORNILLO, 4)],
    manoObra: [{ categoria: "Electricista oficial", rendimiento: 8 }],
  },
  {
    codigo: "jardin-006",
    descripcion: "Foco empotrado de piso exterior",
    unidad: "U",
    destino: "JARDIN",
    materiales: [nuevo("MAT-JARDIN-FOCO-PISO", 1)],
    manoObra: [{ categoria: "Electricista oficial", rendimiento: 10 }],
  },
  {
    codigo: "jardin-007",
    descripcion: "Reflector de fachada",
    unidad: "U",
    destino: "JARDIN",
    materiales: [nuevo("MAT-JARDIN-REFLECTOR-FACHADA", 1), reuso(REUSO.TARUGO_TORNILLO, 4)],
    manoObra: [{ categoria: "Electricista oficial", rendimiento: 8 }],
  },
  {
    codigo: "jardin-008",
    descripcion: "Iluminación subacuática de piscina",
    unidad: "U",
    destino: "JARDIN",
    materiales: [nuevo("MAT-JARDIN-FOCO-PISCINA", 1), nuevo("MAT-JARDIN-TRANSFORMADOR-12V", 1)],
    manoObra: [{ categoria: "Electricista oficial", rendimiento: 4 }],
  },
  {
    codigo: "jardin-009",
    descripcion: "Sistema de riego por aspersión con programador (césped)",
    unidad: "GL",
    destino: "JARDIN",
    materiales: [
      nuevo("MAT-JARDIN-ASPERSOR", 6),
      nuevo("MAT-JARDIN-TUBERIA-PE", 30),
      nuevo("MAT-JARDIN-PROGRAMADOR-RIEGO", 1),
      nuevo("MAT-JARDIN-VALVULA-SOLENOIDE", 2),
    ],
    manoObra: [
      { categoria: "Plomero oficial", rendimiento: 0.2 },
      { categoria: "Ayudante", rendimiento: 0.2 },
    ],
  },
  {
    codigo: "jardin-010",
    descripcion: "Sistema de riego por goteo con programador (canteros/plantines)",
    unidad: "GL",
    destino: "JARDIN",
    materiales: [
      nuevo("MAT-JARDIN-MANGUERA-GOTEO", 40),
      nuevo("MAT-JARDIN-GOTERO", 20),
      nuevo("MAT-JARDIN-PROGRAMADOR-RIEGO", 1),
      nuevo("MAT-JARDIN-FILTRO-RIEGO", 1),
    ],
    manoObra: [
      { categoria: "Plomero oficial", rendimiento: 0.33 },
      { categoria: "Ayudante", rendimiento: 0.33 },
    ],
  },
  {
    codigo: "carpmet-007",
    descripcion: "Portón peatonal de hierro/aluminio",
    unidad: "U",
    destino: "CARPMET",
    materiales: [nuevo("MAT-CARPMET-PORTON-PEATONAL", 1), reuso(REUSO.TORNILLOS_HERRAJES, 1)],
    manoObra: [
      { categoria: "Oficial especializado", rendimiento: 1.5 },
      { categoria: "Peón", rendimiento: 1.5 },
    ],
  },
  {
    codigo: "carpmet-008",
    descripcion: "Motor para portón corredizo",
    unidad: "U",
    destino: "CARPMET",
    materiales: [nuevo("MAT-CARPMET-MOTOR-CORREDIZO", 1), nuevo("MAT-CARPMET-ACCESORIOS-MOTOR", 1)],
    manoObra: [{ categoria: "Electricista oficial", rendimiento: 1 }],
  },
];

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);

  const acond = await db.capituloCatalogo.findUnique({ where: { nombre: NOMBRE_ACOND } });
  const carpinterias = await db.capituloCatalogo.findUnique({ where: { nombre: NOMBRE_CARPINTERIAS } });
  if (!acond || !carpinterias) {
    console.error("Falta algún CapituloCatalogo base — abortando.");
    await db.$disconnect();
    process.exit(1);
  }
  const subJardin = await db.subcapituloCatalogo.findFirst({ where: { capituloCatalogoId: acond.id, nombre: NOMBRE_SUB_JARDIN } });
  const subHierro = await db.subcapituloCatalogo.findFirst({ where: { capituloCatalogoId: carpinterias.id, nombre: NOMBRE_SUB_HIERRO } });
  if (!subJardin || !subHierro) {
    console.error("Falta algún SubcapituloCatalogo base — abortando.");
    await db.$disconnect();
    process.exit(1);
  }
  console.log(`Subcapítulo "${NOMBRE_SUB_JARDIN}" [id=${subJardin.id}] — NO se crea, ya existe.`);
  console.log(`Subcapítulo "${NOMBRE_SUB_HIERRO}" [id=${subHierro.id}] — NO se crea, ya existe.\n`);

  // ── PrecioMTOP nuevos ─────────────────────────────────────────────────
  console.log("── PrecioMTOP nuevos ──");
  for (const p of PRECIOS_NUEVOS) {
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
  console.log(`\nTotal PrecioMTOP nuevos: ${PRECIOS_NUEVOS.length}`);
  console.log(`Materiales reusados (sin PrecioMTOP nuevo): ${Object.keys(REUSO).length}\n`);

  // ── SubrubroEstandar + APUEstandar ────────────────────────────────────
  console.log("── SubrubroEstandar + APUEstandar ──");
  const categoriasLaborales = await db.categoriaLaboral.findMany();
  const jornalPorNombre = (nombre: string) =>
    categoriasLaborales.find((c) => c.nombre.trim().toLowerCase() === nombre.trim().toLowerCase())?.jornal ?? 0;

  let creados = 0;
  let actualizados = 0;
  for (const def of CODIGOS) {
    const capituloId = def.destino === "JARDIN" ? acond.id : carpinterias.id;
    const subcapituloId = def.destino === "JARDIN" ? subJardin.id : subHierro.id;

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
    const totalJardin = await db.subrubroEstandar.count({ where: { subcapituloId: subJardin.id, activo: true } });
    const totalHierro = await db.subrubroEstandar.count({ where: { subcapituloId: subHierro.id, activo: true } });
    console.log(`Total SubrubroEstandar activos en "${NOMBRE_SUB_JARDIN}": ${totalJardin}`);
    console.log(`Total SubrubroEstandar activos en "${NOMBRE_SUB_HIERRO}": ${totalHierro}`);
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
