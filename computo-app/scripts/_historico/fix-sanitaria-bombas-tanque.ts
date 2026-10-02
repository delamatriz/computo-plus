// Fase 2 del bug "clona a $0" — Tanda 4 (Instalación Sanitaria),
// sub-tanda 4c: últimos 3 códigos. Cierra la Tanda 4 por completo.
//
// Confirmado (sin material mal asignado) en los 3. Ninguno usado en
// Rubro real de HOGAR/Matisse Monet (0 rubros con descripción similar
// a "Bomba eléctrica de agua" o "Tanque de agua").
//
// Fuentes de precio (USD convertido a $40,85/USD, BROU venta) — gama
// media/estándar, no premium:
//  - Bomba eléctrica de agua 1HP (sanitaria-016): Sodimac Uruguay,
//    Taifu, autocebante 1HP, USD 229 real. Se evitó Grundfos (USD
//    659-1.199, gama premium) y Lusqtoff ($5.459 UYU ≈ USD 133, gama
//    más económica que la media del mercado).
//  - Bomba eléctrica de agua 2HP (sanitaria-017): Gianni S.A., modelo
//    propio SCM2-60, doble rotor, USD 469 real. Se evitó Pedrollo
//    2CPM25-16B (USD 834, marca italiana importada, gama premium).
//    Misma línea de fabricación (SCM2) que el 1.5HP de Gianni (USD
//    392), consistente con la escala de potencia.
//  - Accesorios instalación bomba (compartido 016/017): ⚠️ sin fuente
//    puntual (válvula de retención, uniones, cable, protector
//    térmico) — estimación gruesa $700/gl.
//  - Tanque de agua 500 litros (sanitaria-018): Barraca Carmela,
//    Gianni Tricapa antibacteriano, "Kit Completo" (incluye flotante
//    y salida), USD 183 real. Se evitó el Bicapa (USD 154, kit
//    incompleto — solo tapa rosca) por ser gama más básica y no
//    incluir flotante, que sí trae el Tricapa.
//  - Accesorios instalación tanque (sanitaria-018): ⚠️ sin fuente
//    puntual (base/soporte, uniones a la red, sellador) — no incluye
//    lo que ya trae el kit del tanque (flotante+salida) — estimación
//    gruesa $500/gl.
//
// Sin cambios de mano de obra. GG 15% / Utilidad 10%, sin leyes
// sociales.
//
// Ejecutar (dry-run): npx tsx scripts/fix-sanitaria-bombas-tanque.ts
// Ejecutar (real):     npx tsx scripts/fix-sanitaria-bombas-tanque.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;
const USD_UYU = 40.85;

const BOMBA_1HP_U = 229 * USD_UYU;
const BOMBA_2HP_U = 469 * USD_UYU;
const ACC_BOMBA_GL = 700;
const TANQUE_500L_U = 183 * USD_UYU;
const ACC_TANQUE_GL = 500;

type MaterialNuevo = { codigoMTOP: string; descripcion: string; unidad: string; precio: number };
type Def = { codigo: string; materialesNuevos: MaterialNuevo[] };

const DEFS: Def[] = [
  {
    codigo: "sanitaria-016",
    materialesNuevos: [
      { codigoMTOP: "MAT-BOMBA-ELECTRICA-1HP", descripcion: "Bomba eléctrica de agua 1HP", unidad: "u", precio: BOMBA_1HP_U },
      { codigoMTOP: "MAT-ACC-INST-BOMBA", descripcion: "Accesorios instalación bomba", unidad: "gl", precio: ACC_BOMBA_GL },
    ],
  },
  {
    codigo: "sanitaria-017",
    materialesNuevos: [
      { codigoMTOP: "MAT-BOMBA-ELECTRICA-2HP", descripcion: "Bomba eléctrica de agua 2HP", unidad: "u", precio: BOMBA_2HP_U },
      { codigoMTOP: "MAT-ACC-INST-BOMBA", descripcion: "Accesorios instalación bomba", unidad: "gl", precio: ACC_BOMBA_GL },
    ],
  },
  {
    codigo: "sanitaria-018",
    materialesNuevos: [
      { codigoMTOP: "MAT-TANQUE-AGUA-500L", descripcion: "Tanque de agua 500 litros", unidad: "u", precio: TANQUE_500L_U },
      { codigoMTOP: "MAT-ACC-INST-TANQUE", descripcion: "Accesorios instalación tanque", unidad: "gl", precio: ACC_TANQUE_GL },
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

  for (const def of DEFS) {
    const s = await db.subrubroEstandar.findFirst({
      where: { codigo: def.codigo },
      include: { apuEstandar: { include: { materiales: true, manoObra: true } } },
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

    const costoDirecto = sumMat + sumMO;
    const precioUY = Math.round(costoDirecto * (1 + GG_PCT / 100) * (1 + UTIL_PCT / 100) * 100) / 100;

    console.log(`  sumMat=$${sumMat.toFixed(2)} sumMO=$${sumMO.toFixed(2)} costoDirecto=$${costoDirecto.toFixed(2)}`);
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
