// Migración — saca Gastos Generales (GG%) del cálculo por rubro, lo lleva a
// monto agregado a nivel proyecto (ver src/lib/costoAgregado.ts).
//
// Antes: Rubro.precioUnit = costoDirecto × (1+GG%) × (1+Utilidad%).
// Ahora: Rubro.precioUnit = costoDirecto × (1+Utilidad%) — sin GG% adentro.
//
// Como GG% es un factor multiplicativo puro en la fórmula vieja, "desarmarlo"
// es exacto (no una aproximación): dividir el precioUnit ya guardado por
// (1 + GG%/100) da EXACTO costoDirecto × (1+Utilidad%) — no hace falta
// re-consultar precios de materiales/jornales vigentes ni recalcular desde
// cero. Se usa el GG% real de cada fila (no se asume 15 hardcodeado), por si
// alguna vez existió una variante — hoy los 22 rubros reales (XXI/PRADO/
// POCITOS) tienen GG%=15% uniforme, según la investigación previa.
//
// Alcance de este script:
//   1. Rubro.precioUnit y Rubro.precioCongelado (si no es null) de TODOS los
//      rubros con APU real, en TODOS los proyectos — decisión confirmada:
//      también se recalculan los ya entregados (precioCongelado), no se
//      dejan como estaban.
//   2. APU.gastosGeneralesPct → 0 (decisión confirmada: no se conserva el
//      valor histórico).
//   3. APUEstandar.gastosGeneralesPct → 0 en toda la biblioteca (401
//      subrubros) — la biblioteca no tiene precioUnit propio que recalcular
//      (se computa al vuelo en descompuesto/route.ts), alcanza con pisar el %.
//
// Modo dry-run (default): solo muestra qué cambiaría, no escribe nada.
// Modo aplicar: agregar --apply para escribir en DB, un proyecto a la vez
// dentro de una transacción (si algo falla a mitad de un proyecto, ese
// proyecto no queda a medio migrar — los demás proyectos ya aplicados no se
// revierten).
//
// Ejecutar:
//   npx tsx scripts/migrar-quitar-gg-de-rubros.ts              (dry-run)
//   npx tsx scripts/migrar-quitar-gg-de-rubros.ts --apply       (escribe en DB)

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

const modoAplicar = process.argv.includes("--apply");

interface RubroAfectado {
  rubroId: string;
  apuId: string;
  proyectoNombre: string;
  capituloNombre: string;
  rubroLabel: string;
  gastosGeneralesPctViejo: number;
  precioUnitViejo: number;
  precioUnitNuevo: number;
  precioCongeladoViejo: number | null;
  precioCongeladoNuevo: number | null;
}

function fmt(v: number): string {
  return v.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function main() {
  console.log(modoAplicar ? "=== MODO APLICAR — se va a escribir en la base ===" : "=== MODO DRY-RUN — no se escribe nada ===");
  console.log();

  // ─── 1. Rubros reales con APU ───────────────────────────────────────
  const proyectos = await p.proyecto.findMany({
    select: {
      id: true,
      nombre: true,
      capitulos: {
        select: {
          nombre: true,
          rubros: {
            select: {
              id: true,
              codigo: true,
              descripcion: true,
              precioUnit: true,
              precioCongelado: true,
              apu: { select: { id: true, gastosGeneralesPct: true } },
            },
          },
        },
      },
    },
  });

  const porProyecto = new Map<string, RubroAfectado[]>();

  for (const proyecto of proyectos) {
    const afectados: RubroAfectado[] = [];

    for (const capitulo of proyecto.capitulos) {
      for (const rubro of capitulo.rubros) {
        if (!rubro.apu) continue;
        const gg = rubro.apu.gastosGeneralesPct;
        if (gg === 0) continue; // ya migrado, o nunca tuvo GG% (nada que desarmar)

        const factor = 1 + gg / 100;
        const precioUnitNuevo = Math.round((rubro.precioUnit / factor) * 100) / 100;
        const precioCongeladoNuevo =
          rubro.precioCongelado != null ? Math.round((rubro.precioCongelado / factor) * 100) / 100 : null;

        afectados.push({
          rubroId: rubro.id,
          apuId: rubro.apu.id,
          proyectoNombre: proyecto.nombre,
          capituloNombre: capitulo.nombre,
          rubroLabel: rubro.descripcion || rubro.codigo,
          gastosGeneralesPctViejo: gg,
          precioUnitViejo: rubro.precioUnit,
          precioUnitNuevo,
          precioCongeladoViejo: rubro.precioCongelado,
          precioCongeladoNuevo,
        });
      }
    }

    if (afectados.length > 0) porProyecto.set(proyecto.nombre, afectados);
  }

  let totalRubrosAfectados = 0;
  for (const [proyectoNombre, afectados] of porProyecto) {
    console.log(`── ${proyectoNombre} — ${afectados.length} rubro(s) ──`);
    let sumaVieja = 0;
    let sumaNueva = 0;
    for (const r of afectados) {
      console.log(
        `  ${modoAplicar ? "✓" : "→"} [${r.capituloNombre}] "${r.rubroLabel}" (GG ${r.gastosGeneralesPctViejo}%) — ` +
        `precioUnit $${fmt(r.precioUnitViejo)} → $${fmt(r.precioUnitNuevo)}`
      );
      if (r.precioCongeladoViejo != null) {
        console.log(`      precioCongelado $${fmt(r.precioCongeladoViejo)} → $${fmt(r.precioCongeladoNuevo!)}`);
      }
      sumaVieja += r.precioUnitViejo;
      sumaNueva += r.precioUnitNuevo;
    }
    const diffPct = sumaVieja !== 0 ? ((sumaNueva - sumaVieja) / sumaVieja) * 100 : 0;
    console.log(
      `  Σ precioUnit: $${fmt(sumaVieja)} → $${fmt(sumaNueva)} (${diffPct >= 0 ? "+" : ""}${diffPct.toFixed(2)}%)`
    );
    console.log();
    totalRubrosAfectados += afectados.length;
  }

  if (totalRubrosAfectados === 0) {
    console.log("Ningún rubro real tiene GG% distinto de 0 — nada para migrar en proyectos.");
  }

  // ─── 2. Biblioteca (APUEstandar) ────────────────────────────────────
  const apuEstandarAfectados = await p.aPUEstandar.count({ where: { gastosGeneralesPct: { not: 0 } } });
  const apuEstandarTotal = await p.aPUEstandar.count();
  console.log(`── Biblioteca ──`);
  console.log(`APUEstandar con GG% ≠ 0: ${apuEstandarAfectados} de ${apuEstandarTotal} — se pisarían a 0.`);
  console.log();

  // ─── 3. Aplicar ─────────────────────────────────────────────────────
  if (modoAplicar) {
    for (const [proyectoNombre, afectados] of porProyecto) {
      // timeout generoso (default de Prisma es 5s) — la conexión a Render
      // puede ser lenta, y 14 rubros × 2 updates ya superaron el default.
      await p.$transaction(
        afectados.flatMap((r) => [
          p.rubro.update({
            where: { id: r.rubroId },
            data: {
              precioUnit: r.precioUnitNuevo,
              ...(r.precioCongeladoViejo != null ? { precioCongelado: r.precioCongeladoNuevo } : {}),
            },
          }),
          p.aPU.update({ where: { id: r.apuId }, data: { gastosGeneralesPct: 0 } }),
        ]),
        { timeout: 30000 }
      );
      console.log(`✓ ${proyectoNombre} migrado (${afectados.length} rubro(s)).`);
    }

    if (apuEstandarAfectados > 0) {
      await p.aPUEstandar.updateMany({ data: { gastosGeneralesPct: 0 } });
      console.log(`✓ Biblioteca: ${apuEstandarAfectados} APUEstandar actualizados a GG%=0.`);
    }
  } else {
    console.log("Para aplicar de verdad: npx tsx scripts/migrar-quitar-gg-de-rubros.ts --apply");
  }

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
