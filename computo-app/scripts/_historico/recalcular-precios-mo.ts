// Recalcula precioUnit de todos los rubros con mano de obra en la base,
// usando la fórmula de Costo Directo corregida (jornalRef / rendimiento,
// en vez de (jornadaHs / rendimiento) * jornalRef — ver commit del fix
// del bug sistémico de mano de obra).
//
// Rubros sin mano de obra (solo materiales) no se tocan — ya estaban
// bien calculados.
//
// Modo dry-run (default): solo muestra qué cambiaría, no escribe nada.
// Modo aplicar: agregar --apply para escribir los precios nuevos en DB.
//
// Ejecutar:
//   npx tsx scripts/recalcular-precios-mo.ts              (dry-run)
//   npx tsx scripts/recalcular-precios-mo.ts --apply       (escribe en DB)

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

const modoAplicar = process.argv.includes("--apply");

async function main() {
  console.log(modoAplicar ? "=== MODO APLICAR — se va a escribir en la base ===" : "=== MODO DRY-RUN — no se escribe nada ===");

  const rubros = await p.rubro.findMany({
    include: {
      apu: { include: { materiales: true, manoObra: true, equipos: true } },
      capitulo: { include: { proyecto: { select: { nombre: true } } } },
    },
  });

  const afectados: {
    rubro: string;
    proyecto: string;
    precioViejo: number;
    precioNuevo: number;
    diffPct: number;
  }[] = [];

  for (const rubro of rubros) {
    if (!rubro.apu || rubro.apu.manoObra.length === 0) continue; // sin MO — no se toca

    const sumMat = rubro.apu.materiales.reduce((s, m) => s + m.rendimiento * m.precioUnit, 0);
    const sumMO = rubro.apu.manoObra.reduce((s, mo) => {
      if (mo.rendimiento <= 0) return s;
      const costo = mo.jornalRef / mo.rendimiento;
      return s + (Number.isFinite(costo) ? costo : 0);
    }, 0);
    const sumEq = rubro.apu.equipos.reduce((s, e) => s + e.rendimiento * e.costoUnit, 0);

    const costoDirectoNuevo = sumMat + sumMO + sumEq;
    const precioNuevo = Math.round(
      costoDirectoNuevo * (1 + rubro.apu.gastosGeneralesPct / 100) * (1 + rubro.apu.utilidadPct / 100) * 100
    ) / 100;

    const precioViejo = rubro.precioUnit;
    if (precioNuevo === precioViejo) continue; // ya está correcto, no hay nada que hacer

    const diffPct = precioViejo !== 0 ? ((precioNuevo - precioViejo) / precioViejo) * 100 : 0;

    afectados.push({
      rubro: rubro.descripcion || rubro.codigo,
      proyecto: rubro.capitulo.proyecto.nombre,
      precioViejo,
      precioNuevo,
      diffPct,
    });

    console.log(
      `${modoAplicar ? "✓" : "→"} [${rubro.capitulo.proyecto.nombre}] "${rubro.descripcion || rubro.codigo}" — ` +
      `$${precioViejo.toFixed(2)} → $${precioNuevo.toFixed(2)} (${diffPct >= 0 ? "+" : ""}${diffPct.toFixed(1)}%)`
    );

    if (modoAplicar) {
      await p.rubro.update({ where: { id: rubro.id }, data: { precioUnit: precioNuevo } });
    }
  }

  console.log("\n── Resumen ──");
  console.log(`Rubros con mano de obra revisados: ${rubros.filter((r) => r.apu && r.apu.manoObra.length > 0).length}`);
  console.log(`Rubros ${modoAplicar ? "actualizados" : "que cambiarían"}: ${afectados.length}`);

  if (afectados.length > 0) {
    const promedioPct = afectados.reduce((s, a) => s + a.diffPct, 0) / afectados.length;
    const maximaPct = afectados.reduce((max, a) => Math.abs(a.diffPct) > Math.abs(max) ? a.diffPct : max, 0);
    console.log(`Variación promedio: ${promedioPct >= 0 ? "+" : ""}${promedioPct.toFixed(1)}%`);
    console.log(`Variación máxima:   ${maximaPct >= 0 ? "+" : ""}${maximaPct.toFixed(1)}%`);
  }

  if (!modoAplicar && afectados.length > 0) {
    console.log("\nEsto fue un dry-run — no se escribió nada en la base.");
    console.log("Revisá los resultados y volvé a correr con --apply para aplicar los cambios.");
  }

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
