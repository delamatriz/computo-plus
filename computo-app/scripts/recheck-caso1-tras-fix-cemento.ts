// Los 62 subrubros del "Caso 1" (recalculo-precios-subrubros-estandar.ts)
// ya se aplicaron, pero 47 de ellos usaban "Cemento Portland" genérico, que
// en ese momento todavía matcheaba contra el cemento BLANCO ($54,44/kg) en
// vez del gris estructural ($25,70/kg) — ver fix-cemento-portland-generico.ts.
// Como ese fix les tocó fechaBase al mes actual, el script principal ya no
// los vuelve a mirar (los filtra por "no son nota vieja"). Este script
// re-verifica puntualmente esos 62 códigos con el precio de cemento ya
// corregido, y actualiza los que cambien.
//
// Modo dry-run (default): solo reporta. Modo aplicar: agregar --apply.
//
// Ejecutar:
//   npx tsx scripts/recheck-caso1-tras-fix-cemento.ts              (dry-run)
//   npx tsx scripts/recheck-caso1-tras-fix-cemento.ts --apply       (escribe en DB)

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

const modoAplicar = process.argv.includes("--apply");
const mesActual = new Date().toISOString().slice(0, 7);

const CODIGOS_CASO1_APLICADOS = [
  "2.1", "2.5", "2.6", "2.8", "3.4", "3.5", "3.6",
  "4.1.1", "4.1.2", "4.1.3", "4.1.4", "4.2.3", "4.2.4", "4.2.5", "4.2.6", "4.2.7",
  "5.1.1", "5.1.2", "5.1.3", "5.2.4", "5.3.3", "5.3.5", "5.3.6",
  "6.1.10", "6.1.11", "6.1.12", "6.1.13", "6.1.14", "6.1.15", "6.1.16", "6.1.2", "6.1.3", "6.1.7", "6.1.8", "6.1.9",
  "6.2.1", "6.2.10", "6.2.11", "6.2.12", "6.2.16", "6.2.2", "6.2.3", "6.2.4", "6.2.5", "6.2.6", "6.2.7", "6.2.8", "6.2.9",
  "6.3.1", "6.3.2", "6.3.4",
  "6.4.13", "6.4.14", "6.4.17", "6.4.18", "6.4.20",
  "6.6.11", "6.6.13", "6.6.2", "6.6.3",
  "7.2.10",
  "manual-b89aa8fb-9d29-48f6-93c9-b1b8251d37b5",
];

async function main() {
  console.log(modoAplicar ? "=== MODO APLICAR — se va a escribir en la base ===" : "=== MODO DRY-RUN — no se escribe nada ===");

  const [preciosMTOP, categoriasLaborales, preciosEquipo] = await Promise.all([
    p.precioMTOP.findMany(),
    p.categoriaLaboral.findMany(),
    p.precioEquipo.findMany(),
  ]);
  const buscarPrecioMTOP = (d: string) => preciosMTOP.find((m) => m.descripcion.toLowerCase().includes(d.toLowerCase()));
  const buscarJornal = (n: string) => categoriasLaborales.find((c) => c.nombre.trim().toLowerCase() === n.trim().toLowerCase());
  const buscarPrecioEquipo = (d: string) => preciosEquipo.find((e) => e.descripcion.toLowerCase().includes(d.toLowerCase()));

  let cambiados = 0;
  let sinCambios = 0;

  for (const codigo of CODIGOS_CASO1_APLICADOS) {
    const sub = await p.subrubroEstandar.findFirst({
      where: { codigo },
      include: { apuEstandar: { include: { materiales: true, manoObra: true, equipos: true } } },
    });
    if (!sub?.apuEstandar) continue;

    const sumMat = sub.apuEstandar.materiales.reduce((s, m) => s + m.rendimiento * (buscarPrecioMTOP(m.descripcion)?.precioUnitario ?? 0), 0);
    const sumMO = sub.apuEstandar.manoObra.reduce((s, mo) => {
      if (mo.rendimiento <= 0) return s;
      const costo = (buscarJornal(mo.categoria)?.jornal ?? 0) / mo.rendimiento;
      return s + (Number.isFinite(costo) ? costo : 0);
    }, 0);
    const sumEq = sub.apuEstandar.equipos.reduce((s, eq) => s + eq.rendimiento * (buscarPrecioEquipo(eq.descripcion)?.precioHora ?? 0), 0);

    const precioNuevo = Math.round(
      (sumMat + sumMO + sumEq) * (1 + sub.apuEstandar.gastosGeneralesPct / 100) * (1 + sub.apuEstandar.utilidadPct / 100) * 100
    ) / 100;

    if (precioNuevo === sub.precioUY) {
      sinCambios++;
      continue;
    }

    const diffPct = sub.precioUY !== 0 ? ((precioNuevo - sub.precioUY) / sub.precioUY) * 100 : 0;
    console.log(
      `${modoAplicar ? "✓" : "→"} [${sub.capitulo}] ${sub.codigo} — "${sub.descripcion}" — $${sub.precioUY.toFixed(2)} → $${precioNuevo.toFixed(2)} (${diffPct >= 0 ? "+" : ""}${diffPct.toFixed(1)}%)`
    );
    cambiados++;

    if (modoAplicar) {
      await p.subrubroEstandar.update({ where: { id: sub.id }, data: { precioUY: precioNuevo, fechaBase: mesActual } });
    }
  }

  console.log("\n── Resumen ──");
  console.log(`Códigos revisados: ${CODIGOS_CASO1_APLICADOS.length}`);
  console.log(`${modoAplicar ? "Corregidos" : "Cambiarían"}: ${cambiados}`);
  console.log(`Sin cambios (no estaban afectados por el bug de cemento): ${sinCambios}`);

  if (!modoAplicar && cambiados > 0) {
    console.log("\nEsto fue un dry-run — no se escribió nada en la base.");
    console.log("Volvé a correr con --apply para aplicar los cambios.");
  }

  await p.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
