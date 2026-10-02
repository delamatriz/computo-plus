// Fase 2 del bug "clona a $0" — Vidrios, sub-tanda 9b: Vidrio templado
// 6mm y 8mm (2 códigos: 7.4.4, 7.4.5).
//
// Confirmado ANTES de investigar (chequeo de duplicados): "Vidrio
// templado 6mm" y "Vidrio templado 8mm" tenían 0 filas PrecioMTOP
// preexistentes — genuinamente parte del bug, sin colisión.
//
// La Lista Oficial MTOP N°599 (nov-2025) NO tiene templado a 6mm ni
// 8mm (solo hay una fila real a 10mm, ver fix-vidrio007-correccion.ts
// para esa corrección aparte). Se intentaron 5 fuentes retail sin
// resultado accesible por fetch directo: Sodimac, Barraca, Vidriería
// Bia, Construex, CYPE (CYPE solo dio 4mm instalado $1.591,69/m²,
// espesor distinto, no sirve de ancla).
//
// Metodología (⚠️ ESTIMACIÓN GRUESA para ambos insumos):
//  1. Único dato real de templado disponible: 10mm, $17.739,08/m²
//     (Lista MTOP, código 30 "Cristal 10mm. templado").
//  2. Simple/sin templar nacional (Lista MTOP real): 4mm=$4.312,59,
//     6mm=$6.603,52. Pendiente $1.145,47/mm. Extrapolado a 10mm:
//     $6.603,52 + $1.145,47×4 = $11.185,38/m².
//  3. Ratio templado/simple a 10mm = $17.739,08 / $11.185,38 =
//     1,5859x (+58,59%).
//  4. Se aplica ESE MISMO ratio a los precios simples nacionales de
//     6mm (real, $6.603,52) y 8mm (extrapolado, $8.894,45), asumiendo
//     que el premium de templado es proporcionalmente estable entre
//     espesores — supuesto simplificador, no verificado por espesor
//     individual, dado que no hay fuente retail directa.
//
// Verificación de coherencia (pedida por el usuario): curva creciente
// por espesor ($10.472,63 < $14.105,86 < $17.739,08) y templado
// siempre más caro que su equivalente simple del mismo origen
// (nacional) — ambas se cumplen.
//
// Sin cambios de mano de obra ni de rendimientos. GG 15% / Utilidad
// 10%, sin leyes sociales.
//
// Ejecutar (dry-run): npx tsx scripts/fix-vidrios-templado-6-8mm.ts
// Ejecutar (real):     npx tsx scripts/fix-vidrios-templado-6-8mm.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;

const VIDRIO_TEMPLADO_6MM_M2 = 10472.63;
const VIDRIO_TEMPLADO_8MM_M2 = 14105.86;

type MaterialNuevo = { codigoMTOP: string; descripcion: string; unidad: string; precio: number };
type Def = { codigo: string; materialesNuevos: MaterialNuevo[] };

const DEFS: Def[] = [
  { codigo: "7.4.4", materialesNuevos: [{ codigoMTOP: "MAT-VIDRIO-TEMPLADO-6MM", descripcion: "Vidrio templado 6mm", unidad: "m2", precio: VIDRIO_TEMPLADO_6MM_M2 }] },
  { codigo: "7.4.5", materialesNuevos: [{ codigoMTOP: "MAT-VIDRIO-TEMPLADO-8MM", descripcion: "Vidrio templado 8mm", unidad: "m2", precio: VIDRIO_TEMPLADO_8MM_M2 }] },
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
