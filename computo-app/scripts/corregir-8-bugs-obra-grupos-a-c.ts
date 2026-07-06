// Corrige los 8 bugs de obra confirmados con criterio de obra (Grupos A, B y
// C) más los dos hallazgos de precio de equipo (Grúa torre, y su rubro
// impl-eq-004 que ya modela el operador aparte) que surgieron en la revisión.
//
// GRUPO A:
//   2.4      — Oficial maquinista y Peón: 0.15/0.5 → 18 M3/jornada;
//              Retroexcavadora: 0.15 → 0.444 hs/M3 (8/18, misma jornada)
//   5.3.4    — dosificación cemento/arena/balasto/hierro tomada de 4.1.3
//              (hierro a 80kg/m3); madera de encofrado y mano de obra
//              también igualadas a 4.1.3 (2.4 m2/m3 y 0.8 M3/jornada)
//   4.2.8    — saca Hormigonera y Vibrador de inmersión; arena fina 1.1 → 0.15 m3/ML
//   impl-eq-009/010 — Oficial maquinista: 1 → 8 HS/jornada
//
// GRUPO B (remodelado, no solo valores):
//   1.6 y 1.7 — pasan de "Peón" (mano de obra, atada a SUNCA y computando
//   en la base imponible BPS) a un ítem de Equipo con unidad "mes", con
//   precio de mercado fijo e independiente del jornal SUNCA.
//
// GRUPO C:
//   impl-eq-007 — reemplaza el equipo "Balancín" (plataforma suspendida) por
//   "Silleta con arnés" (kit completo: arnés + cuerdas + anclajes). La mano
//   de obra ya usaba "Oficial trabajo en altura" (recargo SUNCA del 10%
//   sobre Oficial albañil) — se deja igual, no hace falta una categoría nueva.
//
// Grúa torre — baja de $4500/hs a $420/hs (referencia CYPE Uruguay: alquiler
// mensual ~$51.635 + margen de mobilización/mantenimiento, prorrateado en
// 160hs/mes). impl-eq-004 (que usa este equipo) ya modela el operador como
// mano de obra aparte — no hace falta tocar esa parte.
//
// Modo dry-run (default): solo reporta, simulando el precio resultante sin
// escribir nada. Modo aplicar: agregar --apply.
//
// Ejecutar:
//   npx tsx scripts/corregir-8-bugs-obra-grupos-a-c.ts              (dry-run)
//   npx tsx scripts/corregir-8-bugs-obra-grupos-a-c.ts --apply       (escribe en DB)

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

const modoAplicar = process.argv.includes("--apply");
const mesActual = new Date().toISOString().slice(0, 7);

const NUEVA_SILLETA = {
  codigo: "EQ-SILLETA-ARNES",
  descripcion: "Silleta con arnés para trabajo en altura",
  unidad: "hs",
  precioHora: 200, // estimación de referencia (kit completo) — revisar si aparece un dato de mercado mejor
};

const NUEVO_PRECIO_GRUA_TORRE = 420; // antes 4500 — ver nota arriba (ref. CYPE Uruguay)

const SERVICIOS_MENSUALES = {
  "1.6": { codigo: "EQ-BANO-QUIMICO", descripcion: "Baño químico con lavamanos y servicio de barométrica", precioMes: 4649.09 },
  "1.7": { codigo: "EQ-CONTAINER-20", descripcion: "Alquiler container 20 pies con baño", precioMes: 4225.30 },
};

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

  // ── Catálogo de equipos vigente (referencia para Grupo C) ──
  console.log("\n── Catálogo actual de equipos ──");
  const catalogoEquiposCompleto = await p.precioEquipo.findMany({ orderBy: { descripcion: "asc" } });
  for (const e of catalogoEquiposCompleto) console.log(`  ${e.codigo} — ${e.descripcion} (${e.unidad}) — $${e.precioHora}`);
  const silletaExistente = catalogoEquiposCompleto.find((e) => e.descripcion.toLowerCase().includes("silleta"));
  console.log(silletaExistente ? `  Ya existe un ítem "Silleta" — se usará.` : `  No existe ítem "Silleta" — se propone crear "${NUEVA_SILLETA.descripcion}" a $${NUEVA_SILLETA.precioHora}/hs.`);

  // ══════════════════ GRUPO A ══════════════════
  console.log("\n══════════════════ GRUPO A — rendimiento / dosificación ══════════════════");

  // 2.4 — Excavación a máquina sin retiro
  {
    const sub = await p.subrubroEstandar.findFirstOrThrow({ where: { codigo: "2.4" }, include: { apuEstandar: { include: { materiales: true, manoObra: true, equipos: true } } } });
    const apu = sub.apuEstandar!;
    const moMaquinista = apu.manoObra.find((m) => m.categoria === "Oficial maquinista")!;
    const moPeon = apu.manoObra.find((m) => m.categoria === "Peón")!;
    const eqRetro = apu.equipos.find((e) => e.descripcion === "Retroexcavadora")!;
    const nuevoRendEq = 8 / 18;
    console.log(`\n2.4 — Oficial maquinista: ${moMaquinista.rendimiento} → 18 M3/jornada`);
    console.log(`      Peón: ${moPeon.rendimiento} → 18 M3/jornada (mismo ritmo, acompaña el ciclo de la máquina)`);
    console.log(`      Retroexcavadora: ${eqRetro.rendimiento} → ${nuevoRendEq.toFixed(4)} hs/M3 (8/18, consistente con la jornada compartida)`);

    const manoObraSimulada = apu.manoObra.map((m) => (m.id === moMaquinista.id || m.id === moPeon.id ? { ...m, rendimiento: 18 } : m));
    const equiposSimulados = apu.equipos.map((e) => (e.id === eqRetro.id ? { ...e, rendimiento: nuevoRendEq } : e));
    const precioSimulado = simularPrecio(apu.materiales, manoObraSimulada, equiposSimulados, apu.gastosGeneralesPct, apu.utilidadPct);
    reportarPrecio(sub, precioSimulado);

    if (modoAplicar) {
      await p.manoObraAPUEstandar.update({ where: { id: moMaquinista.id }, data: { rendimiento: 18 } });
      await p.manoObraAPUEstandar.update({ where: { id: moPeon.id }, data: { rendimiento: 18 } });
      await p.equipoAPUEstandar.update({ where: { id: eqRetro.id }, data: { rendimiento: nuevoRendEq } });
      await p.subrubroEstandar.update({ where: { id: sub.id }, data: { precioUY: precioSimulado, fechaBase: mesActual } });
    }
  }

  // 5.3.4 — Dintel de hormigón armado (80kg hierro/m3)
  {
    const sub = await p.subrubroEstandar.findFirstOrThrow({ where: { codigo: "5.3.4" }, include: { apuEstandar: { include: { materiales: true, manoObra: true, equipos: true } } } });
    const apu = sub.apuEstandar!;
    const nuevosMateriales: Record<string, number> = {
      "cemento portland": 350,
      "arena gruesa": 0.55,
      "balasto": 0.85,
      "hierro": 80,
      "madera": 2.4,
    };
    console.log(`\n5.3.4 — dosificación e insumos (igualados a 4.1.3, hierro a 80kg/m3):`);
    const materialesSimulados = apu.materiales.map((m) => {
      const key = Object.keys(nuevosMateriales).find((k) => m.descripcion.toLowerCase().includes(k));
      if (!key) return m;
      console.log(`  ${m.descripcion}: ${m.rendimiento} → ${nuevosMateriales[key]}`);
      return { ...m, rendimiento: nuevosMateriales[key] };
    });
    console.log(`  Mano de obra (Oficial albañil / Oficial especializado / Peón): ${apu.manoObra[0]?.rendimiento} → 0.8 M3/jornada (igual que 4.1.3)`);
    const manoObraSimulada = apu.manoObra.map((m) => ({ ...m, rendimiento: 0.8 }));

    const precioSimulado = simularPrecio(materialesSimulados, manoObraSimulada, apu.equipos, apu.gastosGeneralesPct, apu.utilidadPct);
    reportarPrecio(sub, precioSimulado);

    if (modoAplicar) {
      for (const m of materialesSimulados) {
        const original = apu.materiales.find((o) => o.id === m.id)!;
        if (original.rendimiento !== m.rendimiento) await p.materialAPUEstandar.update({ where: { id: m.id }, data: { rendimiento: m.rendimiento } });
      }
      for (const mo of apu.manoObra) await p.manoObraAPUEstandar.update({ where: { id: mo.id }, data: { rendimiento: 0.8 } });
      await p.subrubroEstandar.update({ where: { id: sub.id }, data: { precioUY: precioSimulado, fechaBase: mesActual } });
    }
  }

  // 4.2.8 — Descalce de vigas de fundación con arena
  {
    const sub = await p.subrubroEstandar.findFirstOrThrow({ where: { codigo: "4.2.8" }, include: { apuEstandar: { include: { materiales: true, manoObra: true, equipos: true } } } });
    const apu = sub.apuEstandar!;
    const arena = apu.materiales.find((m) => m.descripcion.includes("Arena"))!;
    console.log(`\n4.2.8 — Arena fina: ${arena.rendimiento} → 0.15 m3/ML`);
    console.log(`  Equipos: se sacan "${apu.equipos.map((e) => e.descripcion).join('" y "')}"`);

    const materialesSimulados = apu.materiales.map((m) => (m.id === arena.id ? { ...m, rendimiento: 0.15 } : m));
    const precioSimulado = simularPrecio(materialesSimulados, apu.manoObra, [], apu.gastosGeneralesPct, apu.utilidadPct);
    reportarPrecio(sub, precioSimulado);

    if (modoAplicar) {
      await p.materialAPUEstandar.update({ where: { id: arena.id }, data: { rendimiento: 0.15 } });
      await p.equipoAPUEstandar.deleteMany({ where: { apuId: apu.id } });
      await p.subrubroEstandar.update({ where: { id: sub.id }, data: { precioUY: precioSimulado, fechaBase: mesActual } });
    }
  }

  // impl-eq-009 / impl-eq-010 — alquiler de retro/minicargadora por hora
  for (const codigo of ["impl-eq-009", "impl-eq-010"]) {
    const sub = await p.subrubroEstandar.findFirstOrThrow({ where: { codigo }, include: { apuEstandar: { include: { materiales: true, manoObra: true, equipos: true } } } });
    const apu = sub.apuEstandar!;
    const mo = apu.manoObra.find((m) => m.categoria === "Oficial maquinista")!;
    console.log(`\n${codigo} — Oficial maquinista: rendimiento ${mo.rendimiento} → 8 HS/jornada`);

    const manoObraSimulada = apu.manoObra.map((m) => (m.id === mo.id ? { ...m, rendimiento: 8 } : m));
    const precioSimulado = simularPrecio(apu.materiales, manoObraSimulada, apu.equipos, apu.gastosGeneralesPct, apu.utilidadPct);
    reportarPrecio(sub, precioSimulado);

    if (modoAplicar) {
      await p.manoObraAPUEstandar.update({ where: { id: mo.id }, data: { rendimiento: 8 } });
      await p.subrubroEstandar.update({ where: { id: sub.id }, data: { precioUY: precioSimulado, fechaBase: mesActual } });
    }
  }

  // ══════════════════ GRUPO B — remodelado 1.6 / 1.7 ══════════════════
  console.log("\n══════════════════ GRUPO B — 1.6 y 1.7 (servicios de terceros, precio de mercado fijo) ══════════════════");
  for (const [codigo, servicio] of Object.entries(SERVICIOS_MENSUALES)) {
    const sub = await p.subrubroEstandar.findFirstOrThrow({ where: { codigo }, include: { apuEstandar: { include: { materiales: true, manoObra: true, equipos: true } } } });
    const apu = sub.apuEstandar!;
    const yaExisteEnCatalogo = catalogoEquiposCompleto.find((e) => e.codigo === servicio.codigo);
    console.log(`\n${codigo} — saca mano de obra "Peón" (rendimiento ${apu.manoObra[0]?.rendimiento}), agrega equipo "${servicio.descripcion}" (mes) a $${servicio.precioMes}/mes`);

    // Simulación: agrega el ítem al catálogo en memoria si todavía no existe
    if (!yaExisteEnCatalogo) catalogoEquipos = [...catalogoEquipos, { descripcion: servicio.descripcion, precioHora: servicio.precioMes }];
    const equiposSimulados: Equipo[] = [{ id: "sim", descripcion: servicio.descripcion, rendimiento: 1 }];
    const precioSimulado = simularPrecio(apu.materiales, [], equiposSimulados, apu.gastosGeneralesPct, apu.utilidadPct);
    reportarPrecio(sub, precioSimulado);

    if (modoAplicar) {
      if (!yaExisteEnCatalogo) {
        await p.precioEquipo.create({ data: { codigo: servicio.codigo, descripcion: servicio.descripcion, unidad: "mes", precioHora: servicio.precioMes } });
      }
      await p.manoObraAPUEstandar.deleteMany({ where: { apuId: apu.id } });
      await p.equipoAPUEstandar.create({ data: { apuId: apu.id, descripcion: servicio.descripcion, unidad: "mes", rendimiento: 1 } });
      await p.subrubroEstandar.update({ where: { id: sub.id }, data: { precioUY: precioSimulado, fechaBase: mesActual } });
    }
  }

  // ══════════════════ GRUPO C ══════════════════
  console.log("\n══════════════════ GRUPO C — equipo trabajo en altura ══════════════════");
  {
    const sub = await p.subrubroEstandar.findFirstOrThrow({ where: { codigo: "impl-eq-007" }, include: { apuEstandar: { include: { materiales: true, manoObra: true, equipos: true } } } });
    const apu = sub.apuEstandar!;
    const balancin = apu.equipos.find((e) => e.descripcion === "Balancín")!;
    console.log(`\nimpl-eq-007 — equipo: "Balancín" ($1200/hs, plataforma suspendida) → "${NUEVA_SILLETA.descripcion}" ($${NUEVA_SILLETA.precioHora}/hs, kit individual)`);
    console.log(`  Mano de obra: se deja "Oficial trabajo en altura" (ya tiene el recargo SUNCA del 10% sobre Oficial albañil) — no hace falta una categoría nueva.`);

    if (!silletaExistente) catalogoEquipos = [...catalogoEquipos, NUEVA_SILLETA];
    const equiposSimulados = apu.equipos.map((e) => (e.id === balancin.id ? { ...e, descripcion: NUEVA_SILLETA.descripcion } : e));
    const precioSimulado = simularPrecio(apu.materiales, apu.manoObra, equiposSimulados, apu.gastosGeneralesPct, apu.utilidadPct);
    reportarPrecio(sub, precioSimulado);

    if (modoAplicar) {
      if (!silletaExistente) await p.precioEquipo.create({ data: NUEVA_SILLETA });
      await p.equipoAPUEstandar.update({ where: { id: balancin.id }, data: { descripcion: NUEVA_SILLETA.descripcion } });
      await p.subrubroEstandar.update({ where: { id: sub.id }, data: { precioUY: precioSimulado, fechaBase: mesActual } });
    }
  }

  // ══════════════════ GRÚA TORRE — precio de catálogo ══════════════════
  console.log("\n══════════════════ Grúa torre — precio de catálogo ══════════════════");
  {
    const grua = catalogoEquiposCompleto.find((e) => e.codigo === "EQ-GRUA-TORRE")!;
    console.log(`\nEQ-GRUA-TORRE: $${grua.precioHora}/hs → $${NUEVO_PRECIO_GRUA_TORRE}/hs (ref. CYPE Uruguay ~$51.635/mes + margen, / 160hs/mes)`);

    catalogoEquipos = catalogoEquipos.map((e) => (e.descripcion === grua.descripcion ? { ...e, precioHora: NUEVO_PRECIO_GRUA_TORRE } : e));
    const impl004 = await p.subrubroEstandar.findFirstOrThrow({ where: { codigo: "impl-eq-004" }, include: { apuEstandar: { include: { materiales: true, manoObra: true, equipos: true } } } });
    const apu004 = impl004.apuEstandar!;
    const precioSimulado004 = simularPrecio(apu004.materiales, apu004.manoObra, apu004.equipos, apu004.gastosGeneralesPct, apu004.utilidadPct);
    reportarPrecio(impl004, precioSimulado004);
    console.log(`  (impl-eq-004 ya modela el operador aparte como mano de obra "Oficial maquinista" — no se toca)`);

    if (modoAplicar) {
      await p.precioEquipo.update({ where: { codigo: "EQ-GRUA-TORRE" }, data: { precioHora: NUEVO_PRECIO_GRUA_TORRE } });
      await p.subrubroEstandar.update({ where: { id: impl004.id }, data: { precioUY: precioSimulado004, fechaBase: mesActual } });
    }
  }

  if (!modoAplicar) {
    console.log("\nEsto fue un dry-run — no se escribió nada en la base.");
    console.log("Revisá los valores y volvé a correr con --apply.");
  }

  await p.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
