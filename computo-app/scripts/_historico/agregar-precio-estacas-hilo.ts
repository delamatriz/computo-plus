// Agrega precio de referencia de mercado para "Estacas de madera" e
// "Hilo de nylon" (materiales de replanteo sin precio cargado, generaban
// costo $0 silencioso) y actualiza los MaterialAPU existentes con
// precioUnit = 0 que coincidan, recalculando el precioUnit del rubro.
//
// Modo dry-run (default): solo muestra qué cambiaría, no escribe nada.
// Modo aplicar: agregar --apply para escribir en DB.
//
// Ejecutar:
//   npx tsx scripts/agregar-precio-estacas-hilo.ts              (dry-run)
//   npx tsx scripts/agregar-precio-estacas-hilo.ts --apply       (escribe en DB)

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

const modoAplicar = process.argv.includes("--apply");

const MATERIALES = [
  { codigo: "MAT-ESTACA-MADERA", descripcion: "Estacas de madera", cantidadUnidad: "1 u", unidad: "u", cantidad: 1, precioUnitario: 18, precioConIva: 18 },
  { codigo: "MAT-HILO-NYLON", descripcion: "Hilo de nylon", cantidadUnidad: "1 m", unidad: "m", cantidad: 1, precioUnitario: 4, precioConIva: 4 },
];

async function main() {
  console.log(modoAplicar ? "=== MODO APLICAR — se va a escribir en la base ===" : "=== MODO DRY-RUN — no se escribe nada ===");

  // 1 — Precio de referencia en PrecioMTOP
  console.log("\n=== Precios de referencia ===");
  for (const m of MATERIALES) {
    const existente = await p.precioMTOP.findUnique({ where: { codigo: m.codigo } });
    console.log(
      existente
        ? `⊘ ${m.codigo} ya existe ($${existente.precioUnitario}/${existente.unidad})`
        : `→ ${m.codigo} se crearía ($${m.precioUnitario}/${m.unidad}) — "${m.descripcion}"`
    );
    if (modoAplicar) {
      await p.precioMTOP.upsert({
        where: { codigo: m.codigo },
        update: { precioUnitario: m.precioUnitario, precioConIva: m.precioConIva },
        create: { ...m, numeroLista: 0, fechaLista: "2026-07" },
      });
    }
  }

  // 2 — Backfill de MaterialAPU existentes con precioUnit = 0 que coincidan
  console.log("\n=== MaterialAPU afectados ===");
  let ajustados = 0;
  for (const m of MATERIALES) {
    const filas = await p.materialAPU.findMany({
      where: { descripcion: m.descripcion, precioUnit: 0 },
      include: {
        apu: {
          include: {
            materiales: true, manoObra: true, equipos: true,
            rubro: { include: { capitulo: { include: { proyecto: { select: { nombre: true } } } } } },
          },
        },
      },
    });

    for (const fila of filas) {
      const rubro = fila.apu.rubro;
      const proyecto = rubro?.capitulo?.proyecto?.nombre ?? "?";
      console.log(`→ "${fila.descripcion}" en rubro "${rubro?.descripcion}" (${proyecto}) — precioUnit 0 → ${m.precioUnitario}`);

      if (modoAplicar && rubro) {
        await p.materialAPU.update({ where: { id: fila.id }, data: { precioUnit: m.precioUnitario } });

        const sumMat = fila.apu.materiales.reduce((s, mat) => s + mat.rendimiento * (mat.id === fila.id ? m.precioUnitario : mat.precioUnit), 0);
        const sumMO = fila.apu.manoObra.reduce((s, mo) => s + (mo.rendimiento > 0 ? mo.jornalRef / mo.rendimiento : 0), 0);
        const sumEq = fila.apu.equipos.reduce((s, eq) => s + eq.rendimiento * eq.costoUnit, 0);
        const costoDirecto = sumMat + sumMO + sumEq;
        const apuCompleto = await p.aPU.findUnique({ where: { id: fila.apuId } });
        const precioNuevo = Math.round(
          costoDirecto * (1 + (apuCompleto?.gastosGeneralesPct ?? 15) / 100) * (1 + (apuCompleto?.utilidadPct ?? 10) / 100) * 100
        ) / 100;

        await p.rubro.update({ where: { id: rubro.id }, data: { precioUnit: precioNuevo } });
        console.log(`    precioUnit del rubro: $${rubro.precioUnit.toFixed(2)} → $${precioNuevo.toFixed(2)}`);
      }
      ajustados++;
    }
  }

  console.log("\n── Resumen ──");
  console.log(`Materiales de referencia procesados: ${MATERIALES.length}`);
  console.log(`MaterialAPU ${modoAplicar ? "actualizados" : "que se ajustarían"}: ${ajustados}`);

  if (!modoAplicar && ajustados > 0) {
    console.log("\nEsto fue un dry-run — no se escribió nada en la base.");
    console.log("Revisá los resultados y volvé a correr con --apply para aplicar los cambios.");
  }

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
