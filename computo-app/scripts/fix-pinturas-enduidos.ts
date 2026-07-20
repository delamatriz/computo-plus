// Fase 2 del bug "clona a $0" — Tanda 5 (Subcontratos - Pinturas),
// sub-tanda 5a: Enduidos plásticos (4 códigos, 2 materiales
// compartidos).
//
// Confirmado (sin material mal asignado) en los 4 — APU de un solo
// material, unidad/rendimiento coherentes con kg/m² de enduido. No
// hay uso directo de estos códigos de biblioteca en Rubro real, pero
// SÍ existe un dato de referencia real: en Matisse Monet (rubro
// cmqn3opfn002y2ee9wtkjab9n, APU armado a medida, no clonado de este
// código) el material "Enduido plástico interior (listo para usar)"
// ya tiene precioUnit=$85/kg cargado manualmente — coherente con la
// fuente usada abajo.
//
// Fuentes de precio — gama estándar, marca reconocida en Uruguay:
//  - Enduido plástico interior: Sodimac Uruguay, Elbex, 5kg, $389 →
//    $77,80/kg real.
//  - Enduido plástico exterior: Sodimac Uruguay, Lusol, 2kg, $249 →
//    $124,50/kg real. Se evitó el Elbex Acrílico Exterior 25kg
//    (Bertolotti, $4.118 → $164,72/kg) por ser una línea premium
//    "alto poder de relleno" explícitamente posicionada por encima
//    del estándar — gama superior a la pedida.
//  - Hipótesis confirmada: el exterior ($124,50/kg) cuesta ~60% más
//    que el interior ($77,80/kg), consistente con la mayor
//    resistencia a intemperie/humedad que exige la formulación.
//
// Sin cambios de mano de obra. GG 15% / Utilidad 10%, sin leyes
// sociales.
//
// CORRECCIÓN (misma sesión, detectada en verificación post-apply):
// 7.1.2 y 7.1.4 (los dos códigos "exterior") tienen un equipo
// "Andamio tubular" (rend 0.15 hs, $85/hs real, alquilado) que la
// primera versión de este script no sumaba al costoDirecto — el
// primer `precioUY` aplicado (7.1.2=$311,52, 7.1.4=$273,82) quedó
// subvaluado. Corregido para sumar sumEq como hace clonar-apu.
//
// Ejecutar (dry-run): npx tsx scripts/fix-pinturas-enduidos.ts
// Ejecutar (real):     npx tsx scripts/fix-pinturas-enduidos.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;

const ENDUIDO_INT_KG = 389 / 5;
const ENDUIDO_EXT_KG = 249 / 2;

type MaterialNuevo = { codigoMTOP: string; descripcion: string; unidad: string; precio: number };
type Def = { codigo: string; materialesNuevos: MaterialNuevo[] };

const DEFS: Def[] = [
  { codigo: "7.1.1", materialesNuevos: [{ codigoMTOP: "MAT-ENDUIDO-PLASTICO-INT", descripcion: "Enduido plástico interior", unidad: "kg", precio: ENDUIDO_INT_KG }] },
  { codigo: "7.1.3", materialesNuevos: [{ codigoMTOP: "MAT-ENDUIDO-PLASTICO-INT", descripcion: "Enduido plástico interior", unidad: "kg", precio: ENDUIDO_INT_KG }] },
  { codigo: "7.1.2", materialesNuevos: [{ codigoMTOP: "MAT-ENDUIDO-PLASTICO-EXT", descripcion: "Enduido plástico exterior", unidad: "kg", precio: ENDUIDO_EXT_KG }] },
  { codigo: "7.1.4", materialesNuevos: [{ codigoMTOP: "MAT-ENDUIDO-PLASTICO-EXT", descripcion: "Enduido plástico exterior", unidad: "kg", precio: ENDUIDO_EXT_KG }] },
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
