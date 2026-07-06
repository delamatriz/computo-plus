// Aplica el recálculo de precioUY a los subrubros del "Caso 4" (cambio de
// precio implausible) que, tras revisión manual, se confirmó que son
// cambios de precio de mercado legítimos — no bugs de rendimiento/cantidad
// en el APU. Los 8 que sí resultaron ser bugs de datos quedan
// deliberadamente afuera de esta lista, para que se revisen a mano uno por
// uno antes de tocar su cálculo (ver diagnóstico completo en la
// conversación / commit).
//
// Modo dry-run (default): solo reporta. Modo aplicar: agregar --apply.
//
// Ejecutar:
//   npx tsx scripts/aplicar-caso4-legitimos.ts              (dry-run)
//   npx tsx scripts/aplicar-caso4-legitimos.ts --apply       (escribe en DB)

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

const modoAplicar = process.argv.includes("--apply");
const mesActual = new Date().toISOString().slice(0, 7);

const CODIGOS_LEGITIMOS = [
  "1.4", "2.2", "2.3", "2.7",
  "3.1", "3.2", "3.3", "3.7",
  "4.2.1",
  "6.1.1", "6.1.4", "6.1.5", "6.1.6",
  "6.2.13", "6.2.14", "6.2.15",
  "6.3.6",
  "6.6.1", "6.6.10", "6.6.15", "6.6.16",
  "7.1.10", "7.1.13", "7.1.8",
  "7.3.17", "7.3.24", "7.3.5",
  "cubierta-002",
  "impl-eq-002", "impl-eq-003", "impl-eq-004", "impl-eq-005", "impl-eq-006", "impl-eq-008",
];

// Confirmados como bugs de datos (rendimiento/cantidad/equipo mal cargado)
// — deliberadamente NO incluidos arriba. Se listan acá solo para dejar
// registro explícito de qué se excluyó y por qué.
const CODIGOS_BUG_EXCLUIDOS = [
  "1.6", "1.7", "2.4", "4.2.8", "5.3.4", "impl-eq-007", "impl-eq-009", "impl-eq-010",
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

  let aplicados = 0;

  for (const codigo of CODIGOS_LEGITIMOS) {
    const sub = await p.subrubroEstandar.findFirst({
      where: { codigo },
      include: { apuEstandar: { include: { materiales: true, manoObra: true, equipos: true } } },
    });
    if (!sub?.apuEstandar) { console.log(`⚠ ${codigo} — no encontrado, se salta`); continue; }

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

    const diffPct = sub.precioUY !== 0 ? ((precioNuevo - sub.precioUY) / sub.precioUY) * 100 : 0;
    console.log(
      `${modoAplicar ? "✓" : "→"} [${sub.capitulo}] ${sub.codigo} — "${sub.descripcion}" — ` +
      `$${sub.precioUY.toFixed(2)} → $${precioNuevo.toFixed(2)}` +
      (sub.precioUY !== 0 ? ` (${diffPct >= 0 ? "+" : ""}${diffPct.toFixed(1)}%)` : " (precio nunca cargado)")
    );
    aplicados++;

    if (modoAplicar) {
      await p.subrubroEstandar.update({ where: { id: sub.id }, data: { precioUY: precioNuevo, fechaBase: mesActual } });
    }
  }

  console.log("\n── Resumen ──");
  console.log(`Legítimos ${modoAplicar ? "aplicados" : "que se aplicarían"}: ${aplicados}`);
  console.log(`Bugs excluidos deliberadamente (sin tocar): ${CODIGOS_BUG_EXCLUIDOS.length} — ${CODIGOS_BUG_EXCLUIDOS.join(", ")}`);

  if (!modoAplicar) {
    console.log("\nEsto fue un dry-run — no se escribió nada en la base.");
    console.log("Volvé a correr con --apply para aplicar los cambios.");
  }

  await p.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
