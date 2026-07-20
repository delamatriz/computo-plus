// Fase 2 del bug "clona a $0" — Tanda 5 (Subcontratos - Pinturas),
// sub-tanda 5b: Látex (4 códigos, 2 materiales compartidos).
//
// Confirmado (sin material mal asignado) en los 4 — APU de un solo
// material, unidad/rendimiento coherentes con L/m². 7.1.14 y 7.1.15
// (los dos "exterior") tienen el mismo equipo "Andamio tubular" (rend
// 0.15 hs, $85/hs real, alquilado) que se coló en los enduidos
// exteriores de la sub-tanda anterior — esta vez se suma desde el
// inicio (sumEq), igual que `apu-calc.ts`. No hay clones directos de
// estos 4 códigos en Rubro real, pero SÍ hay un APU armado a mano en
// Matisse Monet (rubro cmqn3ozmr003i2ee91gc5sggb) que ya carga
// "Pintura látex acrílica interior 1ra calidad" a $480/L — gama más
// alta que la estándar pedida, pero corrobora que el orden de
// magnitud (cientos de $/L) es razonable.
//
// Fuentes de precio — gama media/estándar, no premium:
//  - Pintura látex interior: DT Importaciones, Inca Incamax pared
//    interiores blanco mate, 4L, $1.610 → $402,50/L real.
//  - Pintura látex exterior: Sodimac Uruguay, Inca Antimoho Exterior,
//    4L, $2.649 → $662,25/L real (misma marca que el interior, para
//    comparar tamaños de envase iguales).
//  - Sika Elastocolor (pedido explícitamente como referencia): existe
//    en el mercado uruguayo (Sika Uruguay, Sodimac, Barraca Central lo
//    listan como marca) pero no se encontró un precio publicado en
//    ningún punto de venta consultado — queda como referencia
//    cualitativa (resina sintética de alta resistencia a intemperie y
//    UV, impermeable), no como fuente numérica.
//  - Hipótesis confirmada: el exterior cuesta ~65% más que el
//    interior ($662,25 vs $402,50/L) — ratio casi idéntico al de los
//    enduidos de la sub-tanda anterior (~60%), lo que refuerza que el
//    patrón de sobreprecio por resistencia a intemperie es real y
//    consistente entre familias de producto.
//
// Sin cambios de mano de obra. GG 15% / Utilidad 10%, sin leyes
// sociales.
//
// Ejecutar (dry-run): npx tsx scripts/fix-pinturas-latex.ts
// Ejecutar (real):     npx tsx scripts/fix-pinturas-latex.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;

const LATEX_INT_L = 1610 / 4;
const LATEX_EXT_L = 2649 / 4;

type MaterialNuevo = { codigoMTOP: string; descripcion: string; unidad: string; precio: number };
type Def = { codigo: string; materialesNuevos: MaterialNuevo[] };

const DEFS: Def[] = [
  { codigo: "7.1.9", materialesNuevos: [{ codigoMTOP: "MAT-LATEX-INTERIOR", descripcion: "Pintura látex interior", unidad: "l", precio: LATEX_INT_L }] },
  { codigo: "7.1.12", materialesNuevos: [{ codigoMTOP: "MAT-LATEX-INTERIOR", descripcion: "Pintura látex interior", unidad: "l", precio: LATEX_INT_L }] },
  { codigo: "7.1.14", materialesNuevos: [{ codigoMTOP: "MAT-LATEX-EXTERIOR", descripcion: "Pintura látex exterior", unidad: "l", precio: LATEX_EXT_L }] },
  { codigo: "7.1.15", materialesNuevos: [{ codigoMTOP: "MAT-LATEX-EXTERIOR", descripcion: "Pintura látex exterior", unidad: "l", precio: LATEX_EXT_L }] },
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
