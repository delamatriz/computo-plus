// Fase 2 del bug "clona a $0" — Cubiertas, sub-tanda 10a: Canalones
// (2 códigos: cubierta-011, cubierta-014, alto apalancamiento — 2 de
// 3 insumos compartidos).
//
// Confirmado ANTES de investigar (chequeo de duplicados): "Canalón de
// chapa galvanizada", "Soporte para canalón" y "Sellador para
// canalones" tenían 0 filas PrecioMTOP preexistentes, sin colisión.
// Búsqueda ampliada por "chapa galvanizada", "canalon", "canaleta",
// "zinc" tampoco encontró match real (solo productos no relacionados:
// cantonera, vidrio cortado tipo canaleta, chapa fibra de vidrio Onda
// Zinc).
//
// Confirmado que cubierta-011 y cubierta-014 SÍ comparten literalmente
// el mismo material "Canalón de chapa galvanizada" (ml, rend 1.05) y
// "Soporte para canalón" (u, rend 0.5) — el nombre del rubro
// cubierta-011 ("Canaleta de ZINC") es coloquial (en Uruguay "chapa de
// zinc" se usa habitualmente para chapa galvanizada), no un producto
// de zinc puro distinto — confirmado en la fuente real (ver abajo,
// Barraca Carmela vende el mismo producto ARMCO como "chapa
// galvanizada").
//
// Lista Oficial MTOP N°599: NO tiene fila de canalón/chapa
// galvanizada para este uso (solo "Cantonera de chapa galvanizada",
// producto distinto).
//
// Fuentes de precio:
//  - Canalón de chapa galvanizada: REAL, Barraca Carmela
//    (carmela.com.uy), "Canal Cajón Chapa Galvanizada Desagüe Pluvial
//    ARMCO", $1.290/tramo de 3m, calibre 26 (0,41mm), 17cm de ancho →
//    $430,00/ml real.
//  - Soporte para canalón: ⚠️ ESTIMACIÓN GRUESA, pero ahora ANCLADA en
//    un insumo real (a pedido del usuario, en vez de una cifra suelta
//    sin respaldo). Confirmado: Barraca Carmela dice explícitamente
//    que "los soportes los resuelven en obra con planchuelas, no
//    vienen prontos" — no es un SKU de catálogo. Cálculo desglosado:
//      1. Planchuela real: EMAT (emat.com.uy), "Planchuela 1/8" x
//         1 1/2", barra de 6m", USD 14,12 (IVA incluido) → a
//         $40,85/USD = $576,80/barra de 6m → $96,13/ml.
//      2. Largo asumido por soporte: 0,40m — criterio explícito:
//         envolver el ancho del canalón (17cm, spec real de Barraca
//         Carmela) + extensión a cada lado para plegar y fijar a la
//         estructura del techo. Sin fuente que confirme esta medida
//         exacta, es un supuesto razonado.
//      3. Costo de planchuela por soporte: 0,40m × $96,13/ml =
//         $38,45.
//      4. Mano de obra de fabricación (corte+plegado, sin taller):
//         NO se suma aparte — el corte/plegado/fijación de un soporte
//         es parte de la instalación general del canalón, ya cubierta
//         por la MO del propio APU (Oficial albañil + Peón, rend=15
//         ambos). Sumar una fracción de MO acá duplicaría ese costo.
//    Soporte para canalón = $38,45/u (solo material, sin MO aparte).
//  - Sellador para canalones: ⚠️ ESTIMACIÓN GRUESA — productos reales
//    confirmados en TDA Uruguay (MS 435 "sellado de uniones de chapas
//    de cubiertas", SMP 340 "cubiertas metálicas y paneles
//    termoaislantes") pero sin precio publicado ni accesible por
//    fetch. Estimado en $400/u, algo por encima del Sellador silicona
//    genérico ya resuelto en esta base ($320/u), por ser una
//    formulación más especializada para intemperie/metal.
//
// Sin cambios de mano de obra ni de rendimientos. GG 15% / Utilidad
// 10%, sin leyes sociales.
//
// Ejecutar (dry-run): npx tsx scripts/fix-cubiertas-canalones.ts
// Ejecutar (real):     npx tsx scripts/fix-cubiertas-canalones.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;

const CANALON_CHAPA_GALV_ML = 1290 / 3;
// ⚠️ ESTIMACIÓN GRUESA anclada en insumo real — ver desglose en el
// header (planchuela EMAT USD 14,12/barra 6m -> $96,13/ml x 0,40m
// asumido por soporte).
const USD_UYU = 40.85;
const PLANCHUELA_1_8_1_2_ML = (14.12 * USD_UYU) / 6;
const LARGO_SOPORTE_M = 0.4;
const SOPORTE_CANALON_U = Math.round(PLANCHUELA_1_8_1_2_ML * LARGO_SOPORTE_M * 100) / 100;
// ⚠️ ESTIMACIÓN GRUESA — productos reales confirmados (TDA Uruguay)
// pero sin precio publicado.
const SELLADOR_CANALONES_U = 400;

type MaterialNuevo = { codigoMTOP: string; descripcion: string; unidad: string; precio: number };
type Def = { codigo: string; materialesNuevos: MaterialNuevo[] };

const DEFS: Def[] = [
  {
    codigo: "cubierta-011",
    materialesNuevos: [
      { codigoMTOP: "MAT-CANALON-CHAPA-GALV", descripcion: "Canalón de chapa galvanizada", unidad: "ml", precio: CANALON_CHAPA_GALV_ML },
      { codigoMTOP: "MAT-SOPORTE-CANALON", descripcion: "Soporte para canalón", unidad: "u", precio: SOPORTE_CANALON_U },
    ],
  },
  {
    codigo: "cubierta-014",
    materialesNuevos: [
      { codigoMTOP: "MAT-CANALON-CHAPA-GALV", descripcion: "Canalón de chapa galvanizada", unidad: "ml", precio: CANALON_CHAPA_GALV_ML },
      { codigoMTOP: "MAT-SOPORTE-CANALON", descripcion: "Soporte para canalón", unidad: "u", precio: SOPORTE_CANALON_U },
      { codigoMTOP: "MAT-SELLADOR-CANALONES", descripcion: "Sellador para canalones", unidad: "u", precio: SELLADOR_CANALONES_U },
    ],
  },
];

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);

  const categoriasLaborales = await db.categoriaLaboral.findMany();
  const jornalPorNombre = (nombre: string) =>
    categoriasLaborales.find((c) => c.nombre.trim().toLowerCase() === nombre.trim().toLowerCase())?.jornal ?? 0;
  const todosPrecios = await db.precioMTOP.findMany();
  const resolverPrecioExistente = (desc: string) =>
    todosPrecios.find((p) => p.descripcion.toLowerCase().includes(desc.toLowerCase()))?.precioUnitario ?? 0;
  const todosEquipos = await db.precioEquipo.findMany();
  const resolverCostoEquipo = (desc: string) =>
    todosEquipos.find((e) => e.descripcion.toLowerCase().includes(desc.toLowerCase()))?.precioHora ?? 0;

  for (const def of DEFS) {
    const s = await db.subrubroEstandar.findFirst({
      where: { codigo: def.codigo },
      include: { apuEstandar: { include: { materiales: true, manoObra: true, equipos: true } } },
    });
    if (!s || !s.apuEstandar) {
      console.error(`${def.codigo}: no encontrado — abortando.`);
      continue;
    }

    console.log(`\n${def.codigo} — ${s.descripcion}`);
    let sumMat = 0;

    for (const m of s.apuEstandar.materiales) {
      const nuevo = def.materialesNuevos.find((n) => n.descripcion.toLowerCase() === m.descripcion.toLowerCase());
      if (nuevo) {
        const precio = Math.round(nuevo.precio * 100) / 100;
        console.log(`  material: ${nuevo.descripcion} — $${precio}/${nuevo.unidad} (${nuevo.codigoMTOP}) × rend ${m.rendimiento}`);
        sumMat += m.rendimiento * precio;

        if (aplicar) {
          await db.precioMTOP.upsert({
            where: { codigo: nuevo.codigoMTOP },
            create: {
              codigo: nuevo.codigoMTOP,
              descripcion: nuevo.descripcion,
              cantidadUnidad: `1 ${nuevo.unidad}`,
              unidad: nuevo.unidad,
              cantidad: 1,
              precioConIva: precio,
              precioUnitario: precio,
              numeroLista: 0,
              fechaLista: FECHA,
            },
            update: { precioUnitario: precio, precioConIva: precio },
          });
        }
      } else {
        const precio = resolverPrecioExistente(m.descripcion);
        console.log(`  material: ${m.descripcion} — $${precio}/${m.unidad} (ya real, sin cambios) × rend ${m.rendimiento}`);
        sumMat += m.rendimiento * precio;
      }
    }

    const sumMO = s.apuEstandar.manoObra.reduce((acc, mo) => {
      const jornal = jornalPorNombre(mo.categoria);
      console.log(`  MO: ${mo.categoria} — rendimiento ${mo.rendimiento} U/jornada (sin cambios)`);
      return acc + jornal / mo.rendimiento;
    }, 0);

    const sumEq = s.apuEstandar.equipos.reduce((acc, eq) => {
      const costo = resolverCostoEquipo(eq.descripcion);
      console.log(`  Equipo: ${eq.descripcion} — $${costo}/${eq.unidad} (ya real, sin cambios) × rend ${eq.rendimiento}`);
      return acc + eq.rendimiento * costo;
    }, 0);
    if (s.apuEstandar.equipos.length === 0) {
      console.log(`  (sin equipos)`);
    }

    const costoDirecto = sumMat + sumMO + sumEq;
    const precioUY = Math.round(costoDirecto * (1 + GG_PCT / 100) * (1 + UTIL_PCT / 100) * 100) / 100;

    console.log(`  sumMat=$${sumMat.toFixed(2)} sumMO=$${sumMO.toFixed(2)} sumEq=$${sumEq.toFixed(2)} costoDirecto=$${costoDirecto.toFixed(2)}`);
    console.log(`  precioUY actual: $${s.precioUY} (fechaBase ${s.fechaBase}) → NUEVO: $${precioUY}`);

    if (aplicar) {
      await db.subrubroEstandar.update({ where: { codigo: def.codigo }, data: { precioUY, fechaBase: FECHA } });
    }
  }

  if (!aplicar) {
    console.log("\nDry-run — nada se escribió.");
  } else {
    console.log("\nAplicado.");
  }
  await db.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await db.$disconnect();
  process.exit(1);
});
