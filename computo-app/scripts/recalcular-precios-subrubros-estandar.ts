// Recalcula el precio cacheado (precioUY) de los subrubros de la biblioteca
// estándar que sí tienen un APU estándar (materiales + mano de obra +
// equipos) cargado. Ese precio se calcula UNA sola vez al importar el SAU
// (origen "sau_ago2022", fechaBase "2022-08") y nunca se refresca cuando
// después se actualizan los precios de la Lista MTOP o los jornales SUNCA —
// aunque el APU en sí SIEMPRE usa precios en vivo al clonarse a un rubro real
// (ver /api/subrubros-estandar/[id]/clonar-apu), así que para estos casos no
// hace falta un ajuste inflacionario por ICCV — es un simple refresco de
// cálculo con los precios ya vigentes.
//
// Los subrubros SIN APU estándar (precioUY es un número suelto, sin
// materiales/mano de obra propios para verificar) no se pueden recalcular
// así — esos sí necesitarían una actualización real por índice ICCV.
//
// Modo dry-run (default): solo reporta, no escribe nada.
// Modo aplicar: agregar --apply para escribir precioUY/fechaBase nuevos.
//
// Ejecutar:
//   npx tsx scripts/recalcular-precios-subrubros-estandar.ts              (dry-run)
//   npx tsx scripts/recalcular-precios-subrubros-estandar.ts --apply       (escribe en DB)

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

const modoAplicar = process.argv.includes("--apply");
const mesActual = new Date().toISOString().slice(0, 7);

async function main() {
  console.log(modoAplicar ? "=== MODO APLICAR — se va a escribir en la base ===" : "=== MODO DRY-RUN — no se escribe nada ===");

  const subrubros = await p.subrubroEstandar.findMany({
    where: { activo: true },
    include: {
      apuEstandar: { include: { materiales: true, manoObra: true, equipos: true } },
    },
    orderBy: { codigo: "asc" },
  });

  const [preciosMTOP, categoriasLaborales, preciosEquipo] = await Promise.all([
    p.precioMTOP.findMany(),
    p.categoriaLaboral.findMany(),
    p.precioEquipo.findMany(),
  ]);

  const buscarPrecioMTOP = (descripcion: string) =>
    preciosMTOP.find((m) => m.descripcion.toLowerCase().includes(descripcion.toLowerCase()));
  const buscarJornal = (nombre: string) =>
    categoriasLaborales.find((c) => c.nombre.trim().toLowerCase() === nombre.trim().toLowerCase());
  const buscarPrecioEquipo = (descripcion: string) =>
    preciosEquipo.find((e) => e.descripcion.toLowerCase().includes(descripcion.toLowerCase()));

  const conNota = subrubros.filter((s) => s.fechaBase !== mesActual);

  // Un cambio de precio "plausible" para un simple refresco de catálogo
  // (sin ajuste inflacionario) se mueve dentro de una banda razonable.
  // Fuera de esa banda, lo más probable NO es que el precio de mercado
  // haya cambiado tanto, sino que el propio APU tiene un dato corrupto
  // (ej: un rendimiento de mano de obra mal cargado) — ahí no conviene
  // confiar ciegamente en el número recalculado.
  const RATIO_MIN_PLAUSIBLE = 0.5;
  const RATIO_MAX_PLAUSIBLE = 2;

  const casoYaActualizado: { sub: (typeof subrubros)[number]; precioViejo: number; precioNuevo: number }[] = [];
  const casoCambioImplausible: { sub: (typeof subrubros)[number]; precioViejo: number; precioNuevo: number }[] = [];
  const casoSinApu: (typeof subrubros)[number][] = [];
  const casoMatchFallido: { sub: (typeof subrubros)[number]; faltantes: string[] }[] = [];

  for (const sub of conNota) {
    if (!sub.apuEstandar) {
      casoSinApu.push(sub);
      continue;
    }

    const faltantes: string[] = [];

    const sumMat = sub.apuEstandar.materiales.reduce((s, m) => {
      const precio = buscarPrecioMTOP(m.descripcion);
      if (!precio) faltantes.push(`material "${m.descripcion}" sin match en MTOP`);
      return s + m.rendimiento * (precio?.precioUnitario ?? 0);
    }, 0);

    const sumMO = sub.apuEstandar.manoObra.reduce((s, mo) => {
      if (mo.rendimiento <= 0) return s;
      const cat = buscarJornal(mo.categoria);
      if (!cat) faltantes.push(`categoría laboral "${mo.categoria}" sin match en SUNCA`);
      const costo = (cat?.jornal ?? 0) / mo.rendimiento;
      return s + (Number.isFinite(costo) ? costo : 0);
    }, 0);

    const sumEq = sub.apuEstandar.equipos.reduce((s, eq) => {
      const precio = buscarPrecioEquipo(eq.descripcion);
      if (!precio) faltantes.push(`equipo "${eq.descripcion}" sin match en catálogo de alquiler`);
      return s + eq.rendimiento * (precio?.precioHora ?? 0);
    }, 0);

    if (faltantes.length > 0) {
      casoMatchFallido.push({ sub, faltantes });
      continue;
    }

    const costoDirecto = sumMat + sumMO + sumEq;
    const precioNuevo = Math.round(
      costoDirecto * (1 + sub.apuEstandar.gastosGeneralesPct / 100) * (1 + sub.apuEstandar.utilidadPct / 100) * 100
    ) / 100;

    const precioViejo = sub.precioUY;
    const ratio = precioViejo > 0 ? precioNuevo / precioViejo : null;
    const esPlausible = ratio !== null && ratio >= RATIO_MIN_PLAUSIBLE && ratio <= RATIO_MAX_PLAUSIBLE;

    if (esPlausible) {
      casoYaActualizado.push({ sub, precioViejo, precioNuevo });
    } else {
      casoCambioImplausible.push({ sub, precioViejo, precioNuevo });
    }
  }

  console.log(`\nSubrubros con nota "precio base ... — actualizar con ICCV": ${conNota.length}\n`);

  console.log(`── Caso 1: ya actualizados, cambio de precio en rango plausible — ${casoYaActualizado.length} ──`);
  for (const { sub, precioViejo, precioNuevo } of casoYaActualizado) {
    const diffPct = ((precioNuevo - precioViejo) / precioViejo) * 100;
    console.log(
      `${modoAplicar ? "✓" : "→"} [${sub.capitulo}] ${sub.codigo} — "${sub.descripcion}" — ` +
      `$${precioViejo.toFixed(2)} → $${precioNuevo.toFixed(2)} (${diffPct >= 0 ? "+" : ""}${diffPct.toFixed(1)}%) — fechaBase ${sub.fechaBase} → ${mesActual}`
    );
    if (modoAplicar) {
      await p.subrubroEstandar.update({
        where: { id: sub.id },
        data: { precioUY: precioNuevo, fechaBase: mesActual },
      });
    }
  }

  console.log(`\n── Caso 2: sin APU estándar — necesitan actualización real por ICCV — ${casoSinApu.length} ──`);
  for (const sub of casoSinApu) {
    console.log(`⚠ [${sub.capitulo}] ${sub.codigo} — "${sub.descripcion}" — $${sub.precioUY.toFixed(2)} (fechaBase ${sub.fechaBase}, sin insumos para verificar)`);
  }

  console.log(`\n── Caso 3: con APU pero con insumos sin match en catálogos vigentes — revisar a mano — ${casoMatchFallido.length} ──`);
  for (const { sub, faltantes } of casoMatchFallido) {
    console.log(`⚠ [${sub.capitulo}] ${sub.codigo} — "${sub.descripcion}"`);
    for (const f of faltantes) console.log(`    - ${f}`);
  }

  console.log(`\n── Caso 4: con APU y todos los insumos matchean, pero el cambio de precio es implausible (>2x o <0.5x) — probable dato corrupto en el APU, NO se toca — ${casoCambioImplausible.length} ──`);
  for (const { sub, precioViejo, precioNuevo } of casoCambioImplausible) {
    const diffPct = precioViejo !== 0 ? ((precioNuevo - precioViejo) / precioViejo) * 100 : null;
    console.log(
      `⚠ [${sub.capitulo}] ${sub.codigo} — "${sub.descripcion}" — ` +
      `$${precioViejo.toFixed(2)} → $${precioNuevo.toFixed(2)}` +
      (diffPct !== null ? ` (${diffPct >= 0 ? "+" : ""}${diffPct.toFixed(1)}%)` : " (precio viejo era $0)")
    );
  }

  console.log("\n── Resumen ──");
  console.log(`Total con nota de precio base: ${conNota.length}`);
  console.log(`Caso 1 (ya actualizados, cambio plausible, ${modoAplicar ? "recalculados" : "se recalcularían"}): ${casoYaActualizado.length}`);
  console.log(`Caso 2 (sin APU — necesitan ICCV real): ${casoSinApu.length}`);
  console.log(`Caso 3 (insumos sin match — revisar a mano): ${casoMatchFallido.length}`);
  console.log(`Caso 4 (cambio implausible — probable dato corrupto, revisar a mano): ${casoCambioImplausible.length}`);

  if (!modoAplicar && casoYaActualizado.length > 0) {
    console.log("\nEsto fue un dry-run — no se escribió nada en la base.");
    console.log("Revisá los resultados y volvé a correr con --apply para aplicar los cambios del Caso 1.");
  }

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
