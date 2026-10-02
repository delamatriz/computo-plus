// Fase 2 del bug "clona a $0" — Construcción en seco, sub-tanda 7a:
// Sistema Durlock (5 códigos: 7.6.1, 7.6.2, 7.6.3, yeso-002, yeso-003).
//
// Confirmado (sin material mal asignado) en los 5. Sin equipos en
// ningún APU. Ninguno usado en Rubro real de HOGAR/Matisse Monet.
//
// CORRECCIÓN (misma sesión, detectada en verificación post-apply):
// "Placa Durlock 9.5mm" y "Tornillos autoperforantes Durlock" NUNCA
// fueron parte del bug — ya resolvían desde antes (PrecioMTOP
// MAT-DURLOCK=$520/m² y MAT-TORN-DURLOCK=$4/u, creados el 2026-07-02,
// probablemente en una tanda anterior de esta misma Fase 2). Al
// incluirlos por error en "insumos a resolver" y hacerles upsert con
// un codigoMTOP nuevo (MAT-PLACA-DURLOCK-95 / MAT-TORNILLOS-DURLOCK),
// quedaron DOS filas de PrecioMTOP con la misma descripción exacta —
// clonar-apu toma la más vieja por id (orderBy id asc), así que mis
// filas nuevas quedaron inertes y el precioUY aplicado no coincidía
// con lo que clonar-apu realmente producía. Se sacan estos dos
// insumos de "materialesNuevos" (quedan resueltos por
// resolverPrecioExistente, como ya lo hacían) y se eliminan las 2
// filas duplicadas que había creado. $520/m² para una placa de
// 9,5mm es un valor alto que amerita revisión aparte más adelante,
// pero está fuera del alcance de este fix (no es un $0).
//
// Fuentes de precio (USD convertido a $40,85/USD, BROU venta) — gama
// media/estándar:
//  - Perfil metálico para cielorraso: EMAT, Perfil Montante 35mm x 3m
//    (calibre liviano, "armado de cielorrasos suspendidos"), USD 3,66
//    → $49,84/ml real.
//  - Perfil metálico para tabique: EMAT, Perfil Montante 70mm x 3m
//    (para tabiques de yeso, NO el perfil "steel framing estructural"
//    de igual ancho que también vende Sodimac — se verificó
//    explícitamente que es un producto distinto, de línea "steel
//    framing", descartado), USD 4,09 → $55,69/ml real. El perfil de
//    tabique NO tiene el mismo precio que el de cielorraso — son
//    calibres distintos (35mm vs 70mm) porque el muro de 10cm
//    (7.6.2) necesita un montante más ancho que un cielorraso
//    suspendido. Diferencia real: +12%, no arbitraria.
//  - Masilla para juntas Durlock: Sodimac Uruguay, Durlock, 18kg,
//    $999 → $55,50/kg real. Se evitó la MASILLA p/YESO ELBEX de EMAT
//    (18kg, $1.442, más cara y de otra marca) para mantener
//    consistencia con la marca Durlock del resto del sistema.
//  - Cinta para juntas Durlock: ⚠️ ESTIMACIÓN GRUESA — no se encontró
//    un precio publicado en Uruguay (ni Sodimac ni EMAT la listan con
//    precio propio; EMAT confirma no tener "cinta de papel/malla" en
//    su catálogo de terminación de juntas). Estimado en $15/ml.
//  - Lana de vidrio aislante (7.6.2 — también la usa 8.1.2 de Steel
//    Framing en la sub-tanda 7b): Sodimac Uruguay, Isover, 1,20x18m
//    50mm, $2.999 → $138,84/m² real.
//
// Sin cambios de mano de obra ni de rendimientos. GG 15% / Utilidad
// 10%, sin leyes sociales.
//
// Ejecutar (dry-run): npx tsx scripts/fix-yeso-durlock.ts
// Ejecutar (real):     npx tsx scripts/fix-yeso-durlock.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;
const USD_UYU = 40.85;

const PERFIL_CIELORRASO_ML = (3.66 / 3) * USD_UYU;
const PERFIL_TABIQUE_ML = (4.09 / 3) * USD_UYU;
const MASILLA_DURLOCK_KG = 999 / 18;
// ⚠️ ESTIMACIÓN GRUESA — sin fuente de mercado uruguayo verificada
// (ver header). Revisar si en el futuro Sodimac/EMAT/Barraca publica
// precio propio de la cinta de papel/malla para juntas.
const CINTA_DURLOCK_ML = 15;
const LANA_VIDRIO_M2 = 2999 / (1.2 * 18);

type MaterialNuevo = { codigoMTOP: string; descripcion: string; unidad: string; precio: number };
type Def = { codigo: string; materialesNuevos: MaterialNuevo[] };

const DEFS: Def[] = [
  {
    codigo: "7.6.1",
    materialesNuevos: [{ codigoMTOP: "MAT-PERFIL-CIELORRASO", descripcion: "Perfil metálico para cielorraso", unidad: "ml", precio: PERFIL_CIELORRASO_ML }],
  },
  {
    codigo: "7.6.2",
    materialesNuevos: [
      { codigoMTOP: "MAT-PERFIL-TABIQUE", descripcion: "Perfil metálico para tabique", unidad: "ml", precio: PERFIL_TABIQUE_ML },
      { codigoMTOP: "MAT-LANA-VIDRIO", descripcion: "Lana de vidrio aislante", unidad: "m2", precio: LANA_VIDRIO_M2 },
    ],
  },
  {
    codigo: "7.6.3",
    materialesNuevos: [{ codigoMTOP: "MAT-PERFIL-CIELORRASO", descripcion: "Perfil metálico para cielorraso", unidad: "ml", precio: PERFIL_CIELORRASO_ML }],
  },
  {
    codigo: "yeso-002",
    materialesNuevos: [
      { codigoMTOP: "MAT-PERFIL-CIELORRASO", descripcion: "Perfil metálico para cielorraso", unidad: "ml", precio: PERFIL_CIELORRASO_ML },
      { codigoMTOP: "MAT-MASILLA-DURLOCK", descripcion: "Masilla para juntas Durlock", unidad: "kg", precio: MASILLA_DURLOCK_KG },
      { codigoMTOP: "MAT-CINTA-DURLOCK", descripcion: "Cinta para juntas Durlock", unidad: "ml", precio: CINTA_DURLOCK_ML },
    ],
  },
  {
    codigo: "yeso-003",
    materialesNuevos: [
      { codigoMTOP: "MAT-PERFIL-TABIQUE", descripcion: "Perfil metálico para tabique", unidad: "ml", precio: PERFIL_TABIQUE_ML },
      { codigoMTOP: "MAT-MASILLA-DURLOCK", descripcion: "Masilla para juntas Durlock", unidad: "kg", precio: MASILLA_DURLOCK_KG },
      { codigoMTOP: "MAT-CINTA-DURLOCK", descripcion: "Cinta para juntas Durlock", unidad: "ml", precio: CINTA_DURLOCK_ML },
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
