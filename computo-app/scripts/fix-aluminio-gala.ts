// Fase 2 del bug "clona a $0" — subcapítulo Aluminio (Subcontratos -
// Carpinterías). Recalcula 5 códigos existentes de línea Gala sobre
// la base de precio corregida (escalera de gama confirmada: Serie 25
// económico sin DVH → Probba economía con DVH → Gala media → Summa
// premium, todas de Aluminios del Uruguay salvo Serie 25 que es de otro
// fabricante/importador). Crea 6 códigos espejo nuevos en línea Probba
// (prefijo alu-probba-), pedidos porque se solicita con frecuencia real
// en obra en situaciones más económicas.
//
// (7.3.18 ya resuelto en sesión anterior — Serie 25, no se toca; 7.3.24
// "Amure de aberturas de aluminio" no forma parte de este lote, ya
// tiene precio real).
//
// Metodología de precio — revisada tras confirmar la escalera de gama
// real (aluminios.com + aberturasgala.uy + probba.uy):
//  - Serie 25 (ancla real, 7.3.18 aplicado sesión anterior): $12.500 /
//    (1.20×1.10 m²) = $9.469,70/m². Sin DVH, línea de otro
//    fabricante/importador (Waluminio/Aberturas Moscú), NO es una de
//    las 4 líneas de Aluminios del Uruguay.
//  - Probba (economía, SÍ admite DVH según su sitio — "mejor relación
//    calidad-precio") = Serie 25 × 1,60 → $15.151,52/m².
//  - Gala (media, un escalón arriba de Probba, confirmado por el propio
//    sitio del fabricante) = Probba × 1,60 → $24.242,43/m².
//  - Sobre CADA base (Probba y Gala) se aplican los mismos criterios
//    relativos: DVH ×1,38, oscilobatiente ×1,10, lama térmica ×1,65 —
//    mismos multiplicadores ya usados y no cuestionados.
//
//  ⚠️ Sigue siendo una estimación derivada — ahora anclada a una
//  jerarquía de gama confirmada por el sitio del fabricante (no un solo
//  salto arbitrario como la versión anterior), pero ningún precio de
//  ventana/puerta completa armada se encontró públicamente. Revisar con
//  criterio de obra antes de aplicar.
//
// MO: mismo criterio/rendimiento que su par Gala para cada tipo de
// producto — instalar una ventana Probba no debería ser más rápido ni
// más lento que instalar la misma ventana en Gala, es el mismo tipo de
// trabajo de colocación.
//
// Ejecutar (dry-run): npx tsx scripts/fix-aluminio-gala.ts
// Ejecutar (real):     npx tsx scripts/fix-aluminio-gala.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;
const NOMBRE_CAPITULO = "Subcontratos - Carpinterías";
const NOMBRE_SUBCAPITULO = "Aluminio";

const SERIE25_RATE_M2 = 12500 / (1.2 * 1.1); // ancla real: 7.3.18
const PROBBA_SIMPLE_RATE_M2 = SERIE25_RATE_M2 * 1.6;
const GALA_SIMPLE_RATE_M2 = PROBBA_SIMPLE_RATE_M2 * 1.6;

const DVH_MULT = 1.38;
const OSCILOBATIENTE_MULT = 1.1;
const LAMA_TERMICA_MULT = 1.65;

const SILICONA_VENTANAS = { descripcion: "Silicona para ventanas", unidad: "u", precioUnitario: 280 };

type MoDef = { categoria: string; rendimiento: number };
type Def = {
  codigo: string;
  descripcion: string;
  materialDescripcion: string;
  ancho: number;
  alto: number;
  ratePorM2: number;
  siliconaRend: number;
  moRendimientos: MoDef[];
  esNuevo: boolean; // true = crear SubrubroEstandar nuevo (Probba); false = actualizar existente (Gala)
};

// Definiciones base compartidas por tipo de producto (tamaño, silicona, MO) —
// se instancian una vez para Gala (existente, recalcula) y otra para Probba
// (nuevo, crea), aplicando la tarifa base y los multiplicadores relativos
// que correspondan a cada tipo.
type Base = {
  tipo: "simple" | "dvh" | "oscilobatiente" | "lamaTermica";
  ancho: number;
  alto: number;
  siliconaRend: number;
  moRendimientos: MoDef[];
};
const BASES: Base[] = [
  { tipo: "simple", ancho: 2.0, alto: 2.05, siliconaRend: 1, moRendimientos: [{ categoria: "Oficial especializado", rendimiento: 0.7 }, { categoria: "Peón", rendimiento: 0.7 }] }, // puerta ventana corrediza grande
  { tipo: "dvh", ancho: 2.8, alto: 2.05, siliconaRend: 1.5, moRendimientos: [{ categoria: "Oficial especializado", rendimiento: 0.5 }, { categoria: "Peón", rendimiento: 0.5 }] }, // puerta ventana corrediza DVH
  { tipo: "simple", ancho: 0.9, alto: 2.05, siliconaRend: 0.8, moRendimientos: [{ categoria: "Oficial especializado", rendimiento: 1 }] }, // puerta batiente
  { tipo: "oscilobatiente", ancho: 1.4, alto: 1.1, siliconaRend: 1, moRendimientos: [{ categoria: "Oficial especializado", rendimiento: 1 }] }, // ventana oscilobatiente
  { tipo: "simple", ancho: 1.4, alto: 1.1, siliconaRend: 1, moRendimientos: [{ categoria: "Oficial especializado", rendimiento: 1 }] }, // ventana corrediza
  { tipo: "lamaTermica", ancho: 1.4, alto: 1.1, siliconaRend: 1, moRendimientos: [{ categoria: "Oficial especializado", rendimiento: 0.8 }] }, // ventana corrediza con lama térmica
];

const rateParaTipo = (base: Base, ratePorM2Simple: number) => {
  switch (base.tipo) {
    case "dvh":
      return ratePorM2Simple * DVH_MULT;
    case "oscilobatiente":
      return ratePorM2Simple * OSCILOBATIENTE_MULT;
    case "lamaTermica":
      return ratePorM2Simple * LAMA_TERMICA_MULT;
    default:
      return ratePorM2Simple;
  }
};

// 7.3.17b NO se incluye acá — confirmado con el usuario que es
// genuinamente Serie 25 (su descripción y material lo dicen
// literalmente), no Gala. Ya quedó correctamente precificado en la
// sesión anterior con la tarifa Serie 25 real ($57.279,44) — no se
// toca en esta tanda.
const CODIGOS_GALA: Def[] = [
  { codigo: "7.3.19", descripcion: "PUERTA VENTANA CORREDIZA ALUMINIO SERIE GALA DVH 2.80x2.05m", materialDescripcion: "Puerta ventana corrediza aluminio Gala DVH 2.80x2.05m", ...BASES[1], ratePorM2: rateParaTipo(BASES[1], GALA_SIMPLE_RATE_M2), esNuevo: false },
  { codigo: "7.3.20", descripcion: "PUERTA BATIENTE ALUMINIO SERIE GALA 0.90x2.05m", materialDescripcion: "Puerta batiente aluminio Gala 0.90x2.05m", ...BASES[2], ratePorM2: rateParaTipo(BASES[2], GALA_SIMPLE_RATE_M2), esNuevo: false },
  { codigo: "7.3.21", descripcion: "VENTANA OSCILOBATIENTE ALUMINIO SERIE GALA 1.40x1.10m", materialDescripcion: "Ventana oscilobatiente aluminio Gala 1.40x1.10m", ...BASES[3], ratePorM2: rateParaTipo(BASES[3], GALA_SIMPLE_RATE_M2), esNuevo: false },
  { codigo: "7.3.22", descripcion: "VENTANA CORREDIZA ALUMINIO SERIE GALA 1.40x1.10m", materialDescripcion: "Ventana corrediza aluminio Gala 1.40x1.10m", ...BASES[4], ratePorM2: rateParaTipo(BASES[4], GALA_SIMPLE_RATE_M2), esNuevo: false },
  { codigo: "7.3.23", descripcion: "VENTANA CORREDIZA CON CORTINA LAMA TÉRMICA 1.40x1.10m", materialDescripcion: "Ventana corrediza con cortina lama térmica 1.40x1.10m", ...BASES[5], ratePorM2: rateParaTipo(BASES[5], GALA_SIMPLE_RATE_M2), esNuevo: false },
];

const CODIGOS_PROBBA: Def[] = [
  { codigo: "alu-probba-001", descripcion: "Puerta ventana corrediza Probba 2.00x2.05m", materialDescripcion: "Puerta ventana corrediza aluminio Probba 2.00x2.05m", ...BASES[0], ratePorM2: rateParaTipo(BASES[0], PROBBA_SIMPLE_RATE_M2), esNuevo: true },
  { codigo: "alu-probba-002", descripcion: "Puerta ventana corrediza Probba DVH 2.80x2.05m", materialDescripcion: "Puerta ventana corrediza aluminio Probba DVH 2.80x2.05m", ...BASES[1], ratePorM2: rateParaTipo(BASES[1], PROBBA_SIMPLE_RATE_M2), esNuevo: true },
  { codigo: "alu-probba-003", descripcion: "Puerta batiente Probba 0.90x2.05m", materialDescripcion: "Puerta batiente aluminio Probba 0.90x2.05m", ...BASES[2], ratePorM2: rateParaTipo(BASES[2], PROBBA_SIMPLE_RATE_M2), esNuevo: true },
  { codigo: "alu-probba-004", descripcion: "Ventana oscilobatiente Probba 1.40x1.10m", materialDescripcion: "Ventana oscilobatiente aluminio Probba 1.40x1.10m", ...BASES[3], ratePorM2: rateParaTipo(BASES[3], PROBBA_SIMPLE_RATE_M2), esNuevo: true },
  { codigo: "alu-probba-005", descripcion: "Ventana corrediza Probba 1.40x1.10m", materialDescripcion: "Ventana corrediza aluminio Probba 1.40x1.10m", ...BASES[4], ratePorM2: rateParaTipo(BASES[4], PROBBA_SIMPLE_RATE_M2), esNuevo: true },
  { codigo: "alu-probba-006", descripcion: "Ventana corrediza Probba con lama térmica 1.40x1.10m", materialDescripcion: "Ventana corrediza aluminio Probba con lama térmica 1.40x1.10m", ...BASES[5], ratePorM2: rateParaTipo(BASES[5], PROBBA_SIMPLE_RATE_M2), esNuevo: true },
];

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);

  console.log(`Tarifas base ($/m²):`);
  console.log(`  Serie 25 (ancla real, 7.3.18): $${SERIE25_RATE_M2.toFixed(2)}/m²`);
  console.log(`  Probba simple: $${PROBBA_SIMPLE_RATE_M2.toFixed(2)}/m² (Serie 25 × 1.60)`);
  console.log(`  Gala simple: $${GALA_SIMPLE_RATE_M2.toFixed(2)}/m² (Probba × 1.60)\n`);

  const capitulo = await db.capituloCatalogo.findUnique({ where: { nombre: NOMBRE_CAPITULO } });
  const subcapitulo = await db.subcapituloCatalogo.findFirst({ where: { capituloCatalogoId: capitulo?.id, nombre: NOMBRE_SUBCAPITULO } });
  if (!capitulo || !subcapitulo) {
    console.error("Falta CapituloCatalogo/SubcapituloCatalogo — abortando.");
    await db.$disconnect();
    process.exit(1);
  }

  const categoriasLaborales = await db.categoriaLaboral.findMany();
  const jornalPorNombre = (nombre: string) =>
    categoriasLaborales.find((c) => c.nombre.trim().toLowerCase() === nombre.trim().toLowerCase())?.jornal ?? 0;

  const procesar = async (titulo: string, codigos: Def[]) => {
    console.log(`── ${titulo} ──`);
    for (const def of codigos) {
      const area = def.ancho * def.alto;
      const precioMaterial = Math.round(area * def.ratePorM2 * 100) / 100;
      const codigoMTOP = `MAT-ALUM-${def.codigo.replace(/\./g, "").replace(/-/g, "").toUpperCase()}`;

      const sumMat = 1 * precioMaterial + def.siliconaRend * SILICONA_VENTANAS.precioUnitario;
      const sumMO = def.moRendimientos.reduce((s, mo) => s + jornalPorNombre(mo.categoria) / mo.rendimiento, 0);
      const costoDirecto = sumMat + sumMO;
      const precioUY = Math.round(costoDirecto * (1 + GG_PCT / 100) * (1 + UTIL_PCT / 100) * 100) / 100;

      const s = await db.subrubroEstandar.findUnique({ where: { codigo: def.codigo } });

      console.log(`\n  ${def.esNuevo ? "+ crea" : "= actualiza"} ${def.codigo} — ${def.descripcion}`);
      console.log(`      área: ${def.ancho}×${def.alto} = ${area.toFixed(2)} m² — tarifa $${def.ratePorM2.toFixed(2)}/m²`);
      console.log(`      material: ${def.materialDescripcion} — $${precioMaterial}/u (${codigoMTOP})`);
      console.log(`      material: ${SILICONA_VENTANAS.descripcion} — rendimiento ${def.siliconaRend} u — $${SILICONA_VENTANAS.precioUnitario}/u`);
      def.moRendimientos.forEach((mo) => console.log(`      MO: ${mo.categoria} — rendimiento ${mo.rendimiento} U/jornada`));
      console.log(`      sumMat=$${sumMat.toFixed(2)} sumMO=$${sumMO.toFixed(2)} costoDirecto=$${costoDirecto.toFixed(2)}`);
      console.log(`      precioUY ${def.esNuevo ? "(nuevo)" : `actual: $${s?.precioUY ?? "?"} →`} NUEVO: $${precioUY}`);

      if (!aplicar) continue;

      await db.precioMTOP.upsert({
        where: { codigo: codigoMTOP },
        create: {
          codigo: codigoMTOP,
          descripcion: def.materialDescripcion,
          cantidadUnidad: "1 u",
          unidad: "u",
          cantidad: 1,
          precioConIva: precioMaterial,
          precioUnitario: precioMaterial,
          numeroLista: 0,
          fechaLista: FECHA,
        },
        update: { precioUnitario: precioMaterial, precioConIva: precioMaterial },
      });

      if (!def.esNuevo && s) {
        await db.subrubroEstandar.update({ where: { codigo: def.codigo }, data: { precioUY, fechaBase: FECHA } });
        continue;
      }

      const nuevo = await db.subrubroEstandar.upsert({
        where: { codigo: def.codigo },
        create: { codigo: def.codigo, descripcion: def.descripcion, unidad: "UNI", precioUY, fechaBase: FECHA, origen: "manual", capituloId: capitulo.id, subcapituloId: subcapitulo.id },
        update: { descripcion: def.descripcion, unidad: "UNI", precioUY, fechaBase: FECHA, capituloId: capitulo.id, subcapituloId: subcapitulo.id },
      });
      const apuExistente = await db.aPUEstandar.findUnique({ where: { subrubroId: nuevo.id } });
      const apu = apuExistente
        ? await db.aPUEstandar.update({ where: { subrubroId: nuevo.id }, data: {} })
        : await db.aPUEstandar.create({ data: { subrubroId: nuevo.id } });
      await db.materialAPUEstandar.deleteMany({ where: { apuId: apu.id } });
      await db.manoObraAPUEstandar.deleteMany({ where: { apuId: apu.id } });
      await db.materialAPUEstandar.create({ data: { apuId: apu.id, descripcion: def.materialDescripcion, unidad: "u", rendimiento: 1 } });
      await db.materialAPUEstandar.create({ data: { apuId: apu.id, descripcion: SILICONA_VENTANAS.descripcion, unidad: SILICONA_VENTANAS.unidad, rendimiento: def.siliconaRend } });
      for (const mo of def.moRendimientos) {
        await db.manoObraAPUEstandar.create({ data: { apuId: apu.id, categoria: mo.categoria, jornadaHs: 8, rendimiento: mo.rendimiento } });
      }
    }
    console.log("");
  };

  await procesar("Recalculo Gala (5 existentes — 7.3.17b excluido, es Serie 25)", CODIGOS_GALA);
  await procesar("Creación Probba (6 nuevos)", CODIGOS_PROBBA);

  console.log("── Resumen ──");
  console.log(`Modo: ${aplicar ? "APLICADO A PRODUCCIÓN" : "DRY RUN (nada escrito)"}`);
  if (aplicar) {
    const total = await db.subrubroEstandar.count({ where: { subcapituloId: subcapitulo.id, activo: true } });
    console.log(`Total SubrubroEstandar activos en "${NOMBRE_SUBCAPITULO}": ${total}`);
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
