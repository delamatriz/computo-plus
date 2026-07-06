// Corrige 3 hallazgos sobre cómo se modela la instalación de equipos de
// trabajo en altura en la biblioteca estándar (surgieron al revisar los 8
// bugs de rendimiento/precio ya corregidos en corregir-8-bugs-obra-grupos-a-c.ts).
//
// impl-eq-001 (Andamio tubular — montaje, alquiler y desmontaje):
//   el ítem "Andamio tubular" estaba cargado en MaterialAPUEstandar (busca
//   precio en la Lista MTOP) en vez de EquipoAPUEstandar (busca precio en el
//   catálogo de alquiler de equipos, donde realmente vive: EQ-ANDAMIO-TUBULAR).
//   Por eso nunca calculó precio (precioUY seguía en 0). Se mueve el ítem.
//
// impl-eq-003 (Torre de andamio — montaje y alquiler):
//   la mano de obra (Oficial trabajo en altura + Peón, rendimiento 2 DÍA/
//   jornada) estaba modelada igual que Balancín, como si necesitara un
//   operario dedicado todos los días de uso. Una torre de andamio simple no
//   motorizada se arma una vez y no necesita operación diaria — se remodela
//   como montaje puntual amortizado (estimando 1 jornada de armado+desarme
//   entre los 2 operarios, repartida en un alquiler típico de 10 días).
//
// impl-eq-004 (Grúa torre — alquiler mensual):
//   no tenía ninguna línea de armado/desarme (evento puntual que en la
//   práctica requiere una cuadrilla especializada aparte del operador
//   mensual). Se agrega, siguiendo el mismo patrón ya usado en Malacate
//   eléctrico y Elevador de obra (mano de obra amortizada en el mes),
//   estimando 3 jornadas de Oficial especializado + 3 de Peón para armado y
//   desarme combinados, repartidas en un alquiler típico de 6 meses.
//
// Todas las estimaciones de amortización (10 días, 6 meses) son valores de
// referencia razonables — no hay una fuente de mercado uruguaya precisa para
// esto por ahora, revisar si aparece un dato mejor.
//
// Modo dry-run (default): solo reporta, simulando el precio resultante sin
// escribir nada. Modo aplicar: agregar --apply.
//
// Ejecutar:
//   npx tsx scripts/corregir-equipos-altura-instalacion.ts              (dry-run)
//   npx tsx scripts/corregir-equipos-altura-instalacion.ts --apply       (escribe en DB)

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

const modoAplicar = process.argv.includes("--apply");
const mesActual = new Date().toISOString().slice(0, 7);

type Material = { id: string; descripcion: string; rendimiento: number };
type ManoObra = { id: string; categoria: string; rendimiento: number };
type Equipo = { id: string; descripcion: string; rendimiento: number };

let catalogoMTOP: { descripcion: string; precioUnitario: number }[] = [];
let catalogoJornales: { nombre: string; jornal: number }[] = [];
let catalogoEquipos: { descripcion: string; precioHora: number }[] = [];

function precioMaterial(d: string) { return catalogoMTOP.find((m) => m.descripcion.toLowerCase().includes(d.toLowerCase()))?.precioUnitario ?? 0; }
function jornalDe(n: string) { return catalogoJornales.find((c) => c.nombre.trim().toLowerCase() === n.trim().toLowerCase())?.jornal ?? 0; }
function precioEquipo(d: string) { return catalogoEquipos.find((e) => e.descripcion.toLowerCase().includes(d.toLowerCase()))?.precioHora ?? 0; }

function simularPrecio(materiales: Material[], manoObra: ManoObra[], equipos: Equipo[], gastosGeneralesPct: number, utilidadPct: number) {
  const sumMat = materiales.reduce((s, m) => s + m.rendimiento * precioMaterial(m.descripcion), 0);
  const sumMO = manoObra.reduce((s, mo) => s + (mo.rendimiento > 0 ? jornalDe(mo.categoria) / mo.rendimiento : 0), 0);
  const sumEq = equipos.reduce((s, eq) => s + eq.rendimiento * precioEquipo(eq.descripcion), 0);
  return Math.round((sumMat + sumMO + sumEq) * (1 + gastosGeneralesPct / 100) * (1 + utilidadPct / 100) * 100) / 100;
}

function reportarPrecio(sub: { capitulo: string; codigo: string; descripcion: string; precioUY: number }, precioNuevo: number) {
  const diffPct = sub.precioUY !== 0 ? ((precioNuevo - sub.precioUY) / sub.precioUY) * 100 : 0;
  console.log(
    `${modoAplicar ? "✓" : "→"} [${sub.capitulo}] ${sub.codigo} — "${sub.descripcion}" — ` +
    `$${sub.precioUY.toFixed(2)} → $${precioNuevo.toFixed(2)}` +
    (sub.precioUY !== 0 ? ` (${diffPct >= 0 ? "+" : ""}${diffPct.toFixed(1)}%)` : " (precio nunca cargado)")
  );
}

async function main() {
  console.log(modoAplicar ? "=== MODO APLICAR — se va a escribir en la base ===" : "=== MODO DRY-RUN — no se escribe nada, solo se simula el precio ===");

  [catalogoMTOP, catalogoJornales, catalogoEquipos] = await Promise.all([
    p.precioMTOP.findMany(),
    p.categoriaLaboral.findMany(),
    p.precioEquipo.findMany(),
  ]);

  // ══════════════════ impl-eq-001 — Andamio tubular: material → equipo ══════════════════
  {
    const sub = await p.subrubroEstandar.findFirstOrThrow({ where: { codigo: "impl-eq-001" }, include: { apuEstandar: { include: { materiales: true, manoObra: true, equipos: true } } } });
    const apu = sub.apuEstandar!;
    const andamioMaterial = apu.materiales.find((m) => m.descripcion === "Andamio tubular")!;
    console.log(`\nimpl-eq-001 — "Andamio tubular" pasa de Material a Equipo (rendimiento ${andamioMaterial.rendimiento} ${andamioMaterial.unidad} se mantiene)`);

    const equiposSimulados: Equipo[] = [...apu.equipos, { id: "sim", descripcion: andamioMaterial.descripcion, rendimiento: andamioMaterial.rendimiento }];
    const precioSimulado = simularPrecio([], apu.manoObra, equiposSimulados, apu.gastosGeneralesPct, apu.utilidadPct);
    reportarPrecio(sub, precioSimulado);

    if (modoAplicar) {
      await p.equipoAPUEstandar.create({ data: { apuId: apu.id, descripcion: andamioMaterial.descripcion, unidad: andamioMaterial.unidad, rendimiento: andamioMaterial.rendimiento } });
      await p.materialAPUEstandar.delete({ where: { id: andamioMaterial.id } });
      await p.subrubroEstandar.update({ where: { id: sub.id }, data: { precioUY: precioSimulado, fechaBase: mesActual } });
    }
  }

  // ══════════════════ impl-eq-003 — Torre de andamio: montaje amortizado ══════════════════
  {
    const sub = await p.subrubroEstandar.findFirstOrThrow({ where: { codigo: "impl-eq-003" }, include: { apuEstandar: { include: { materiales: true, manoObra: true, equipos: true } } } });
    const apu = sub.apuEstandar!;
    const nuevoRendMO = 10; // 1 jornada de armado+desarme amortizada en un alquiler típico de 10 días
    console.log(`\nimpl-eq-003 — mano de obra (Oficial trabajo en altura / Peón): ${apu.manoObra[0]?.rendimiento} → ${nuevoRendMO} DÍA/jornada (montaje puntual amortizado, no operación diaria)`);

    const manoObraSimulada = apu.manoObra.map((m) => ({ ...m, rendimiento: nuevoRendMO }));
    const precioSimulado = simularPrecio(apu.materiales, manoObraSimulada, apu.equipos, apu.gastosGeneralesPct, apu.utilidadPct);
    reportarPrecio(sub, precioSimulado);

    if (modoAplicar) {
      for (const mo of apu.manoObra) await p.manoObraAPUEstandar.update({ where: { id: mo.id }, data: { rendimiento: nuevoRendMO } });
      await p.subrubroEstandar.update({ where: { id: sub.id }, data: { precioUY: precioSimulado, fechaBase: mesActual } });
    }
  }

  // ══════════════════ impl-eq-004 — Grúa torre: agregar armado/desarme ══════════════════
  {
    const sub = await p.subrubroEstandar.findFirstOrThrow({ where: { codigo: "impl-eq-004" }, include: { apuEstandar: { include: { materiales: true, manoObra: true, equipos: true } } } });
    const apu = sub.apuEstandar!;
    const nuevasLineasMO: ManoObra[] = [
      { id: "sim-oe", categoria: "Oficial especializado", rendimiento: 2 }, // 3 jornadas armado+desarme / 6 meses típicos de alquiler
      { id: "sim-peon", categoria: "Peón", rendimiento: 2 },
    ];
    console.log(`\nimpl-eq-004 — se agrega mano de obra de armado/desarme: Oficial especializado + Peón, 2 MES/jornada (3 jornadas de armado+desarme combinadas, amortizadas en un alquiler típico de 6 meses) — mismo patrón que Malacate eléctrico / Elevador de obra`);

    const manoObraSimulada = [...apu.manoObra, ...nuevasLineasMO];
    const precioSimulado = simularPrecio(apu.materiales, manoObraSimulada, apu.equipos, apu.gastosGeneralesPct, apu.utilidadPct);
    reportarPrecio(sub, precioSimulado);

    if (modoAplicar) {
      for (const mo of nuevasLineasMO) {
        await p.manoObraAPUEstandar.create({ data: { apuId: apu.id, categoria: mo.categoria, jornadaHs: 8, rendimiento: mo.rendimiento } });
      }
      await p.subrubroEstandar.update({ where: { id: sub.id }, data: { precioUY: precioSimulado, fechaBase: mesActual } });
    }
  }

  if (!modoAplicar) {
    console.log("\nEsto fue un dry-run — no se escribió nada en la base.");
    console.log("Revisá los valores (en especial las amortizaciones estimadas de Torre de andamio y Grúa torre) y volvé a correr con --apply.");
  }

  await p.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
