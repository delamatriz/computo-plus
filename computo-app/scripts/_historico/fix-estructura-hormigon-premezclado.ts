// Fase 2 del bug "clona a $0" — Estructura, sub-tanda 12b: Hormigón
// premezclado (2 códigos: 5.3.1, 5.3.2, alto apalancamiento — mismo
// material compartido).
//
// Confirmado ANTES de investigar (chequeo de duplicados): "Hormigón
// premezclado C20" tenía 0 filas PrecioMTOP preexistentes, sin
// colisión (solo "Revoque premezclado 2en1/3en1", productos no
// relacionados).
//
// Confirmado (pedido explícito del usuario): 5.3.1 (bombeado) y 5.3.2
// (volcado) usan el MISMO material exacto "Hormigón premezclado C20"
// (m3, rend 1,05) — no hay ningún equipo "bomba de hormigón" separado
// en ninguno de los dos APU (solo "Vibrador de inmersión", igual en
// ambos, ya real). La diferencia bombeado/volcado está capturada
// ÚNICAMENTE en el rendimiento de mano de obra (bombeado rend=4,
// volcado rend=5 U/jornada) — por lo tanto el material debe tener el
// MISMO precio en los dos códigos, sin diferenciar.
//
// Fuente de precio: REAL, Generador de Precios CYPE Uruguay,
// "Hormigón para armar H-21" (21 MPa — la clase de resistencia más
// cercana a nuestro C20 nominal de 20 MPa; H-21 en nomenclatura
// kg/cm² ≈ 210 kg/cm² ≈ 20,6 MPa, prácticamente equivalente).
// Desglose real de la propia ficha CYPE (columna, bombeado, árido
// máx. 19mm, consistencia A-3):
//   Total (materiales + bomba + MO + herramientas) = $9.190,55/m³
//   Materiales (con 5% de excedente) = $7.761,44/m³ ← ESTE es el
//     valor usado, porque nuestro APU no modela la bomba como equipo
//     aparte — usar el total mezclaría el costo de bombeo de CYPE con
//     el nuestro (que ya está en la MO vía rendimiento).
//   Equipo bomba (CYPE) = $1.060,17/m³ — NO se usa (nuestro APU no
//     tiene esa línea).
//   MO + herramientas (CYPE) = $368,94/m³ — NO se usa (nuestro APU ya
//     tiene su propia MO con rendimiento propio).
//
// Verificación de coherencia: precioUY actual (2022, sin recalcular)
// era $6.652,80 (5.3.1) y $5.940,00 (5.3.2). El nuevo precio implica
// un incremento de ~1,74x y ~1,91x respectivamente — en línea con el
// resto de incrementos 2022→2026 vistos en toda la Fase 2 (típicamente
// 1,5x-4x), sin anomalías.
//
// Sin cambios de mano de obra ni de rendimientos. GG 15% / Utilidad
// 10%, sin leyes sociales.
//
// Ejecutar (dry-run): npx tsx scripts/fix-estructura-hormigon-premezclado.ts
// Ejecutar (real):     npx tsx scripts/fix-estructura-hormigon-premezclado.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;

const HORMIGON_PREMEZCLADO_C20_M3 = 7761.44;

type MaterialNuevo = { codigoMTOP: string; descripcion: string; unidad: string; precio: number };
type Def = { codigo: string; materialesNuevos: MaterialNuevo[] };

const DEFS: Def[] = [
  { codigo: "5.3.1", materialesNuevos: [{ codigoMTOP: "MAT-HORMIGON-PREMEZCLADO-C20", descripcion: "Hormigón premezclado C20", unidad: "m3", precio: HORMIGON_PREMEZCLADO_C20_M3 }] },
  { codigo: "5.3.2", materialesNuevos: [{ codigoMTOP: "MAT-HORMIGON-PREMEZCLADO-C20", descripcion: "Hormigón premezclado C20", unidad: "m3", precio: HORMIGON_PREMEZCLADO_C20_M3 }] },
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
