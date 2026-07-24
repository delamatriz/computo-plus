// Fase 2 del bug "clona a $0" — Impermeabilizaciones, sub-tanda 8a:
// Membranas asfálticas (4 códigos: 6.6.8, 6.6.9, 6.6.12, 6.6.17).
//
// Confirmado (sin material mal asignado) en los 4. Sin equipos en
// ningún APU. Ninguno usado en Rubro real de HOGAR/Matisse Monet.
// Chequeo de duplicados (paso previo, per lo aprendido en Yeso 7a):
// 0 filas preexistentes para ambos insumos — sin colisión.
//
// Insumos secundarios YA RESUELTOS de tandas previas, sin tocar:
// Imprimación asfáltica ($145/l), Arena fina en obra ($1.167,37/m³),
// Cemento Portland gris Montevideo ($25,70/kg).
//
// Fuentes de precio — gama media/estándar, Sodimac Uruguay:
//  - Membrana asfáltica con geotextil: Asfalkote, 4mm, rollo 10 m²,
//    $5.359 → $535,90/m² real.
//  - Membrana asfáltica aluminizada 4mm: Sika AP-NC, 40kg, rollo
//    10 m², $2.756 → $275,60/m² real.
//
// Verificación pedida por el usuario — ¿el diferencial geotextil/
// aluminizada está justificado?: SÍ, pero en la dirección OPUESTA a
// la hipótesis inicial. La membrana con geotextil sale 1,94x MÁS CARA
// que la aluminizada (no al revés). Verificado con la ficha técnica:
// el geotextil es una capa de refuerzo mecánico (resistencia a
// punzonamiento) pensada para uso estructural/enterrado —
// exactamente el caso de 6.6.12 (cimientos) y 6.6.17 (submuración),
// ambos bajo tierra y expuestos a punzonamiento de relleno. El
// aluminio es solo una terminación reflectante para exposición
// solar en superficie (techos), sin refuerzo mecánico adicional —
// de ahí que sea más simple y más barata. No se fuerza la hipótesis
// original; se reporta el hallazgo real.
//
// Sin cambios de mano de obra ni de rendimientos. GG 15% / Utilidad
// 10%, sin leyes sociales.
//
// Ejecutar (dry-run): npx tsx scripts/fix-imper-membranas.ts
// Ejecutar (real):     npx tsx scripts/fix-imper-membranas.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;

const MEMBRANA_GEOTEXTIL_M2 = 5359 / 10;
const MEMBRANA_ALUMINIZADA_M2 = 2756 / 10;

type MaterialNuevo = { codigoMTOP: string; descripcion: string; unidad: string; precio: number };
type Def = { codigo: string; materialesNuevos: MaterialNuevo[] };

const DEFS: Def[] = [
  { codigo: "6.6.8", materialesNuevos: [{ codigoMTOP: "MAT-MEMBRANA-GEOTEXTIL", descripcion: "Membrana asfáltica con geotextil", unidad: "m2", precio: MEMBRANA_GEOTEXTIL_M2 }] },
  { codigo: "6.6.9", materialesNuevos: [{ codigoMTOP: "MAT-MEMBRANA-ALUMINIZADA", descripcion: "Membrana asfáltica aluminizada 4mm", unidad: "m2", precio: MEMBRANA_ALUMINIZADA_M2 }] },
  { codigo: "6.6.12", materialesNuevos: [{ codigoMTOP: "MAT-MEMBRANA-GEOTEXTIL", descripcion: "Membrana asfáltica con geotextil", unidad: "m2", precio: MEMBRANA_GEOTEXTIL_M2 }] },
  { codigo: "6.6.17", materialesNuevos: [{ codigoMTOP: "MAT-MEMBRANA-GEOTEXTIL", descripcion: "Membrana asfáltica con geotextil", unidad: "m2", precio: MEMBRANA_GEOTEXTIL_M2 }] },
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
