// Aportes patronales (leyes sociales "Empresa paga") — 10,2% → 6,4191% (valores
// BPS de oct-2026, verificados por Luis), en proyectos existentes.
//
// Los valores nuevos viven en src/lib/aportesPatronales.ts (única fuente).
// Cambios de fondo respecto de la versión anterior de la rama: "SNIS
// adicional" (0,5) SALE de la suma (es un aporte personal variable del
// trabajador); el 7,5 que figuraba como FOCER patronal sale (es el jubilatorio
// patronal sobre partidas, no una carga fija); FOCER personal pasa de 3,0 a 0,5
// (informativo, no entra al precio).
// Qué toca:
//  1. LeyesSociales: los cinco fondos patronales pasan a los valores nuevos
//     SOLO en las filas que tienen EXACTAMENTE los seis valores viejos (7,5 /
//     1,0 / 0,5 / 0,2 / 0,5 / SNIS 0,5). Una fila con cualquier fondo editado
//     a mano no se pisa. snisAdicionalPct no se modifica (pasa a ser personal
//     informativo, sigue en 0,5). focerPersonalPct pasa de 3,0 a 0,5 SOLO si
//     vale exactamente 3,0.
//  2. APU.aportesPatronalesPct: de 10,2 al total nuevo SOLO en los APU que
//     tienen exactamente 10,2, y se recalcula y guarda el precioUnit del
//     rubro (Costo Directo × (1 + Utilidad%), mismo patrón que
//     propagar-utilidad: calcularPrecioUnitario, redondeo a 2 decimales y
//     escritura numérica directa con Prisma, sin parsearDineroTipeado ni
//     String()).
//     Solo en proyectos cuya LeyesSociales se actualiza (o ya está nueva, o no
//     existe todavía): si el proyecto tiene los fondos personalizados, sus APU
//     con 10,2 se listan y NO se tocan (decide Luis).
//
// Qué NO toca: el AUC, la Biblioteca (no incluye leyes sociales: se suman al
// clonar), rubros sin APU, rubros con precioCongelado (se listan), y
// proyectos FINALIZADO o con contrato / certificaciones / liquidación final
// (se listan, no se modifica NADA de ellos).
//
// Idempotente: después de aplicar no queda ninguna fila con los valores
// viejos, así que una segunda corrida da 0 cambios. Cada UPDATE lleva el
// valor leído en el where (si alguien lo editó entre la lectura y la
// escritura, esa fila no se pisa).
//
// Ejecutar (dry-run, no escribe nada):  npx tsx scripts/actualizar-aportes-patronales-2026-10.ts
// Simular el otro FOCER (solo dry-run): npx tsx scripts/actualizar-aportes-patronales-2026-10.ts --focer=0.5
// Ejecutar (real):                       npx tsx scripts/actualizar-aportes-patronales-2026-10.ts --apply
// Limitar a un proyecto (pruebas):       ... --proyecto=<id>   (sirve con y sin --apply)
// Excluir proyectos por nombre:          ... --excluir="LAS PIEDRAS,HOGAR"  (subcadena, sin distinguir mayúsculas;
//                                          el proyecto excluido no se lee para el plan ni se escribe)
// Timeout de cada transacción (ms):      ... --tx-timeout-ms=120000   (para reproducir el viejo límite de 5 s: 5000)
//
// Cada proyecto se escribe en SU PROPIA transacción: si uno falla, se loguea el
// mensaje completo y el stack, se revierte solo ese proyecto y se sigue con los
// otros; al final el proceso sale con código 1 si hubo fallas.

import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  APORTES_PATRONALES_FRACCION,
  APORTES_PATRONALES_PCT_VIEJO,
  APORTES_PATRONALES_VIEJOS,
  FOCER_PERSONAL_PCT,
  FOCER_PERSONAL_PCT_VIEJO,
  FONDOS_PATRONALES,
  SNIS_ADICIONAL_PERSONAL_PCT,
  type FondoPatronal,
} from "../src/lib/aportesPatronales";
import { CAJA_PROFESIONALES_PCT, CAJA_PROFESIONALES_TIPO_DEFAULT, montoCajaProfesionales } from "../src/lib/cajaProfesionales";
import { calcularPrecioUnitario, sumarAportesPatronalesPct, sumManoObra, sumEquipos, montoAportesPatronales } from "../src/lib/apu-calc";
import {
  calcularCostoDirectoAgregado,
  calcularCostosIndirectosAgregados,
  calcularCostosIndirectosExento,
  calcularUtilidadAgregada,
  costoDirectoUnitario,
  type ApuParaCosto,
} from "../src/lib/costoAgregado";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

type Campo = keyof typeof APORTES_PATRONALES_VIEJOS; // los seis valores viejos (incluye SNIS)
type CampoNuevo = FondoPatronal["campo"]; // los cinco fondos patronales vigentes
const CAMPOS = Object.keys(APORTES_PATRONALES_VIEJOS) as Campo[];
const CAMPOS_NUEVOS = FONDOS_PATRONALES.map((f) => f.campo);
const EPS = 1e-9;
const igual = (a: number, b: number) => Math.abs(a - b) < EPS;
// Filtro de Prisma equivalente a igual(): los porcentajes viejos pueden estar
// guardados con ruido de punto flotante (p. ej. 10.200000000000001 en vez de
// 10.2, porque venían de sumar fracciones), así que el where NO puede ser una
// igualdad exacta — si no, el UPDATE no encuentra la fila y se revierte todo.
const aprox = (v: number) => ({ gte: v - EPS, lte: v + EPS });

const money = (n: number) => n.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const signed = (n: number) => (n >= 0 ? "+" : "−") + money(Math.abs(n));
const pct4 = (n: number) => n.toLocaleString("es-UY", { minimumFractionDigits: 1, maximumFractionDigits: 4 });
const redondear2 = (n: number) => Math.round(n * 100) / 100;

async function main() {
  const aplicar = process.argv.includes("--apply");
  const focerArg = process.argv.find((a) => a.startsWith("--focer="));
  if (aplicar && focerArg) {
    throw new Error("--focer solo sirve para simular en dry-run; con --apply se usa el valor de aportesPatronales.ts.");
  }

  // Valores nuevos (fracciones). Con --focer=X (dry-run) se simula otro FOCER.
  const nuevos: Record<CampoNuevo, number> = { ...APORTES_PATRONALES_FRACCION };
  if (focerArg) {
    const x = Number(focerArg.split("=")[1].replace(",", "."));
    if (!Number.isFinite(x) || x < 0) throw new Error("--focer inválido");
    nuevos.focerPatronalPct = Math.round((x / 100) * 1e8) / 1e8;
  }
  const pctNuevoTotal = sumarAportesPatronalesPct(nuevos);

  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}${focerArg ? `  [SIMULACIÓN ${focerArg}]` : ""}\n`);
  console.log("Valores nuevos (puntos porcentuales sobre la mano de obra):");
  for (const f of FONDOS_PATRONALES) {
    const viejo = APORTES_PATRONALES_VIEJOS[f.campo] * 100;
    const nuevo = nuevos[f.campo] * 100;
    console.log(`  ${f.nombre.padEnd(42)} ${pct4(viejo).padStart(7)}  →  ${pct4(nuevo).padStart(7)}   (cód. ${f.codigoBPS})`);
  }
  console.log(`  ${"SNIS adicional (sale de la suma: personal)".padEnd(42)} ${pct4(APORTES_PATRONALES_VIEJOS.snisAdicionalPct * 100).padStart(7)}  →  ${"—".padStart(7)}   (cód. 108; sigue en ${pct4(SNIS_ADICIONAL_PERSONAL_PCT)}% como retención personal informativa)`);
  console.log(`  ${"TOTAL (APU.aportesPatronalesPct)".padEnd(42)} ${pct4(APORTES_PATRONALES_PCT_VIEJO).padStart(7)}  →  ${pct4(pctNuevoTotal).padStart(7)}`);
  console.log(`  ${"FOCER personal (informativo)".padEnd(42)} ${pct4(FOCER_PERSONAL_PCT_VIEJO * 100).padStart(7)}  →  ${pct4(FOCER_PERSONAL_PCT).padStart(7)}   (cód. 146; solo si vale exactamente 3,0)\n`);

  const soloProyecto = process.argv.find((a) => a.startsWith("--proyecto="))?.split("=")[1];
  const excluir = (process.argv.find((a) => a.startsWith("--excluir="))?.slice("--excluir=".length) ?? "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  const txTimeoutMs = Number(process.argv.find((a) => a.startsWith("--tx-timeout-ms="))?.split("=")[1] ?? 120_000);
  if (excluir.length) console.log(`Excluidos por --excluir: ${excluir.join(", ")}\n`);
  const proyectos = await db.proyecto.findMany({
    where: soloProyecto ? { id: soloProyecto } : undefined,
    orderBy: { nombre: "asc" },
    include: {
      leyesSociales: true,
      contrato: { select: { id: true } },
      liquidacionFinal: { select: { id: true } },
      _count: { select: { certificaciones: true } },
      capitulos: {
        orderBy: { orden: "asc" },
        include: {
          rubros: {
            orderBy: { codigo: "asc" },
            include: { apu: { include: { materiales: true, manoObra: true, equipos: true } } },
          },
        },
      },
    },
  });

  // Costo Directo / Costos Indirectos / Utilidad / Costo Total / Precio Final
  // — mismas funciones puras que la pantalla, el PDF, el contrato y la
  // liquidación (costoAgregado.ts).
  type RubroSnap = { id: string; cantidad: number; precioUnit: number };
  function totales(
    p: (typeof proyectos)[number],
    rubros: RubroSnap[],
    apuData: Record<string, ApuParaCosto>
  ) {
    const caps = [{ rubros: rubros.map((r) => ({ id: r.id, cantidad: r.cantidad, precioUnit: r.precioUnit })) }];
    const cd = calcularCostoDirectoAgregado(caps, apuData).total;
    const ci = calcularCostosIndirectosAgregados(
      p.modoGastosGenerales, p.gastosGeneralesDetallado, p.gastosGeneralesPctDefault, cd, p.gastosGeneralesItems, p.imprevistosPct
    );
    const exento = calcularCostosIndirectosExento(p.modoGastosGenerales, p.gastosGeneralesDetallado);
    const util = calcularUtilidadAgregada(caps, apuData);
    const costoTotal = cd + ci + util;
    const precioFinal = costoTotal + (costoTotal - exento) * 0.22;
    return { cd, costoTotal, precioFinal };
  }

  let totalLeyes = 0;
  let totalApu = 0;
  let ejemplo: string | null = null;
  const plan: {
    proyectoId: string;
    nombre: string;
    leyesId: string | null;
    apus: { rubroId: string; pctNuevo: number; precioNuevo: number }[];
    cambiaFocerPersonal: boolean;
  }[] = [];

  for (const p of proyectos) {
    const nombre = p.nombre.trim();
    console.log("═".repeat(100));
    console.log(`${nombre}   [estado ${p.estado}]`);
    if (excluir.some((x) => nombre.toLowerCase().includes(x))) {
      console.log("  ⛔ EXCLUIDO por --excluir: no se lee para el plan ni se modifica.");
      continue;
    }

    const motivos: string[] = [];
    if (p.estado === "FINALIZADO") motivos.push("estado FINALIZADO");
    if (p.contrato) motivos.push("tiene contrato");
    if (p._count.certificaciones > 0) motivos.push(`${p._count.certificaciones} certificación(es)`);
    if (p.liquidacionFinal) motivos.push("tiene liquidación final");
    if (motivos.length > 0) {
      console.log(`  ⛔ NO SE TOCA: ${motivos.join(", ")}.`);
      const apus = p.capitulos.flatMap((c) => c.rubros).filter((r) => r.apu);
      console.log(`     (tiene ${apus.length} APU, de los cuales ${apus.filter((r) => igual(r.apu!.aportesPatronalesPct, APORTES_PATRONALES_PCT_VIEJO)).length} con 10,2)`);
      continue;
    }

    // ── LeyesSociales ──
    const ley = p.leyesSociales;
    let estadoLey: "viejo" | "nuevo" | "personalizado" | "sin_fila";
    if (!ley) estadoLey = "sin_fila";
    else if (CAMPOS.every((c) => igual(ley[c], APORTES_PATRONALES_VIEJOS[c]))) estadoLey = "viejo";
    else if (CAMPOS_NUEVOS.every((c) => igual(ley[c], nuevos[c]))) estadoLey = "nuevo";
    else estadoLey = "personalizado";

    const textoLey = {
      viejo: "→ se actualizan los 5 fondos patronales (los 6 valores viejos exactos)",
      nuevo: "= ya tiene los valores nuevos",
      personalizado: "· fondos personalizados a mano: NO se toca",
      sin_fila: "· sin fila todavía (se crea con los valores nuevos cuando se abra la pestaña)",
    }[estadoLey];
    console.log(`  LeyesSociales: ${textoLey}`);
    if (ley && estadoLey === "personalizado") {
      console.log(`     valores actuales: ${CAMPOS.map((c) => `${c.replace("Pct", "")} ${pct4(ley[c] * 100)}`).join(" · ")}`);
    }
    if (estadoLey === "viejo") totalLeyes++;

    // ── APU / rubros ──
    const rubros = p.capitulos.flatMap((c) => c.rubros);
    const sinApu = rubros.filter((r) => !r.apu);
    const personalizados = rubros.filter((r) => r.apu && !igual(r.apu.aportesPatronalesPct, APORTES_PATRONALES_PCT_VIEJO));
    const con102 = rubros.filter((r) => r.apu && igual(r.apu.aportesPatronalesPct, APORTES_PATRONALES_PCT_VIEJO));
    const actualizaApu = estadoLey !== "personalizado";
    const congelados = con102.filter((r) => r.precioCongelado != null);
    const aCambiar = actualizaApu ? con102.filter((r) => r.precioCongelado == null) : [];

    console.log(
      `  Rubros: ${rubros.length} · con APU ${rubros.length - sinApu.length} (con 10,2: ${con102.length}) · ` +
        `sin APU (no cambian): ${sinApu.length} · APU con % distinto de 10,2 (no se tocan): ${personalizados.length}`
    );
    if (!actualizaApu && con102.length > 0) {
      console.log(`  ⚠ ${con102.length} APU con 10,2 NO se tocan porque los fondos del proyecto están personalizados (decide Luis).`);
    }
    if (actualizaApu && congelados.length > 0) {
      console.log(`  ❄ ${congelados.length} rubro(s) con precioCongelado — NO se tocan, esperan decisión de Luis:`);
      for (const r of congelados) console.log(`     ${r.codigo.padEnd(8)} ${r.descripcion.slice(0, 60)}  (precio ${money(r.precioUnit)}, congelado ${money(r.precioCongelado!)})`);
    }
    console.log(`  APU a cambiar: ${aCambiar.length}`);
    totalApu += aCambiar.length;

    // Totales antes / después
    const apuDataAntes: Record<string, ApuParaCosto> = {};
    const apuDataDespues: Record<string, ApuParaCosto> = {};
    const rubrosAntes: RubroSnap[] = [];
    const rubrosDespues: RubroSnap[] = [];
    const idsCambiar = new Set(aCambiar.map((r) => r.id));
    const apuNuevos: { rubroId: string; pctNuevo: number; precioNuevo: number }[] = [];
    let driftRubros = 0;
    let driftMonto = 0;

    for (const r of rubros) {
      rubrosAntes.push({ id: r.id, cantidad: r.cantidad, precioUnit: r.precioUnit });
      if (!r.apu) {
        rubrosDespues.push({ id: r.id, cantidad: r.cantidad, precioUnit: r.precioUnit });
        continue;
      }
      const apuViejo: ApuParaCosto = {
        materiales: r.apu.materiales, manoObra: r.apu.manoObra, equipos: r.apu.equipos,
        aportesPatronalesPct: r.apu.aportesPatronalesPct, utilidadPct: r.apu.utilidadPct,
      };
      apuDataAntes[r.id] = apuViejo;
      if (idsCambiar.has(r.id)) {
        const apuNuevo: ApuParaCosto = { ...apuViejo, aportesPatronalesPct: pctNuevoTotal };
        const precioNuevo = redondear2(calcularPrecioUnitario(costoDirectoUnitario(apuNuevo), r.apu.utilidadPct));
        // Deriva previa: cuánto difería el precio guardado de recalcularlo hoy
        // con el % viejo (ediciones anteriores, redondeos). Se muestra aparte
        // para que no se confunda con el efecto de los aportes.
        const precioViejoRecalc = redondear2(calcularPrecioUnitario(costoDirectoUnitario(apuViejo), r.apu.utilidadPct));
        if (Math.abs(r.precioUnit - precioViejoRecalc) > 0.005) {
          driftRubros++;
          driftMonto += (precioViejoRecalc - r.precioUnit) * r.cantidad;
        }
        apuDataDespues[r.id] = apuNuevo;
        rubrosDespues.push({ id: r.id, cantidad: r.cantidad, precioUnit: precioNuevo });
        apuNuevos.push({ rubroId: r.id, pctNuevo: pctNuevoTotal, precioNuevo });
      } else {
        apuDataDespues[r.id] = apuViejo;
        rubrosDespues.push({ id: r.id, cantidad: r.cantidad, precioUnit: r.precioUnit });
      }
    }

    const antes = totales(p, rubrosAntes, apuDataAntes);
    const despues = totales(p, rubrosDespues, apuDataDespues);
    console.log(`  ┌──────────────────┬──────────────────┬──────────────────┬──────────────────┐`);
    console.log(`  │                  │ ANTES            │ DESPUÉS          │ DIFERENCIA       │`);
    console.log(`  ├──────────────────┼──────────────────┼──────────────────┼──────────────────┤`);
    for (const [nom, a, d] of [
      ["Costo Directo", antes.cd, despues.cd],
      ["Costo Total", antes.costoTotal, despues.costoTotal],
      ["Precio Final", antes.precioFinal, despues.precioFinal],
    ] as const) {
      console.log(`  │ ${nom.padEnd(16)} │ ${money(a).padStart(16)} │ ${money(d).padStart(16)} │ ${signed(d - a).padStart(16)} │`);
    }
    console.log(`  └──────────────────┴──────────────────┴──────────────────┴──────────────────┘`);
    console.log(`  (${p.moneda}; Precio Final con IVA 22% sobre la base no exenta)`);

    // Montos informativos de la tarjeta Leyes Sociales/BPS (no entran a ningún
    // precio): empresa patronal, retención personal, AUC y Caja de Profesionales.
    if (ley) {
      const b = ley.montoImponibleMO;
      const sumaViejaEmpresa = CAMPOS.reduce((acc, c) => acc + ley[c], 0); // los 6 que sumaba la tarjeta
      const sumaNuevaEmpresa = estadoLey === "viejo" ? CAMPOS_NUEVOS.reduce((acc, c) => acc + nuevos[c], 0) : CAMPOS_NUEVOS.reduce((acc, c) => acc + ley[c], 0);
      const personalAntes = ley.focerPersonalPct;
      const cambiaFP = estadoLey === "viejo" && igual(ley.focerPersonalPct, FOCER_PERSONAL_PCT_VIEJO);
      const personalDespues = (cambiaFP ? FOCER_PERSONAL_PCT / 100 : ley.focerPersonalPct) + ley.snisAdicionalPct; // FOCER personal + SNIS
      const cajaPct = CAJA_PROFESIONALES_PCT[CAJA_PROFESIONALES_TIPO_DEFAULT];
      console.log(`  Montos informativos de la tarjeta (monto imponible $${money(b)}):`);
      console.log(`     Aportes empresa (patronal): $${money(b * sumaViejaEmpresa)} (${pct4(sumaViejaEmpresa * 100)}%) → $${money(b * sumaNuevaEmpresa)} (${pct4(sumaNuevaEmpresa * 100)}%)`);
      console.log(`     Retención personal:         $${money(b * personalAntes)} (FOCER pers. ${pct4(personalAntes * 100)}%) → $${money(b * personalDespues)} (FOCER pers. + SNIS adicional ${pct4(personalDespues * 100)}%)`);
      console.log(`     AUC (propietario):          $${money(b * ley.aucPct)} (sin cambio)`);
      console.log(`     Caja de Profesionales:      — (no existía) → $${money(montoCajaProfesionales(b, CAJA_PROFESIONALES_TIPO_DEFAULT))} (${CAJA_PROFESIONALES_TIPO_DEFAULT} ${cajaPct}%, informativa, junto al AUC)`);
    }
    if (driftRubros > 0) {
      console.log(
        `  ℹ ${driftRubros} rubro(s) a cambiar ya tenían el precio guardado distinto de recalcularlo hoy con 10,2 ` +
          `(ediciones previas/redondeos): ese arrastre previo suma ${signed(driftMonto)} a la diferencia de arriba.`
      );
    }

    // Ejemplo concreto (una sola vez: el primer rubro con mano de obra)
    if (ejemplo === null) {
      const rEj = aCambiar.find((r) => r.apu!.manoObra.length > 0 && r.cantidad > 0);
      if (rEj) {
        const a = rEj.apu!;
        const sumMat = a.materiales.reduce((s, m) => s + m.rendimiento * m.precioUnit, 0);
        const sumMO = sumManoObra(a.manoObra, a.equipos);
        const sumEq = sumEquipos(a.equipos);
        const apViejo = montoAportesPatronales(sumMO, a.aportesPatronalesPct);
        const apNuevo = montoAportesPatronales(sumMO, pctNuevoTotal);
        const cdViejo = sumMat + sumMO + sumEq + apViejo;
        const cdNuevo = sumMat + sumMO + sumEq + apNuevo;
        const pViejo = calcularPrecioUnitario(cdViejo, a.utilidadPct);
        const pNuevo = redondear2(calcularPrecioUnitario(cdNuevo, a.utilidadPct));
        ejemplo = [
          `EJEMPLO A MANO — ${nombre}, rubro ${rEj.codigo} «${rEj.descripcion.slice(0, 60)}» (por 1 ${rEj.unidad})`,
          `  Materiales ${money(sumMat)} + Mano de obra ${money(sumMO)} + Equipos ${money(sumEq)}`,
          `  Aportes patronales (solo sobre la mano de obra):`,
          `    antes  ${money(sumMO)} × ${pct4(a.aportesPatronalesPct)}% = ${money(apViejo)}`,
          `    ahora  ${money(sumMO)} × ${pct4(pctNuevoTotal)}% = ${money(apNuevo)}`,
          `  Costo Directo: antes ${money(cdViejo)} → ahora ${money(cdNuevo)}`,
          `  × (1 + Utilidad ${a.utilidadPct}%):  antes ${money(pViejo)} (guardado ${money(rEj.precioUnit)}) → ahora ${money(pNuevo)}`,
        ].join("\n");
      }
    }

    if (aCambiar.length > 0 || estadoLey === "viejo") {
      plan.push({
        proyectoId: p.id,
        nombre,
        leyesId: estadoLey === "viejo" ? ley!.id : null,
        apus: apuNuevos,
        cambiaFocerPersonal: estadoLey === "viejo" && igual(ley!.focerPersonalPct, FOCER_PERSONAL_PCT_VIEJO),
      });
    }
  }

  console.log("═".repeat(100));
  if (ejemplo) console.log("\n" + ejemplo);
  console.log(`\nRESUMEN: LeyesSociales a actualizar: ${totalLeyes} · APU a actualizar: ${totalApu}`);

  if (!aplicar) {
    console.log("\nDRY RUN: no se escribió nada. Para aplicar: --apply (solo con la aprobación de Luis).");
    await db.$disconnect();
    return;
  }

  // ── APLICAR ──
  // Una transacción POR PROYECTO, cada una con su try/catch: un problema en un
  // proyecto se loguea completo (mensaje + stack) y no bloquea a los otros.
  let leyesOk = 0;
  let apuOk = 0;
  const fallas: { proyecto: string; error: unknown }[] = [];
  for (const pl of plan) {
    const t0 = Date.now();
    try {
      const res = await db.$transaction(
        async (tx) => {
          // Re-chequeo dentro de la transacción: si el proyecto cambió a
          // FINALIZADO entre la lectura y ahora, no se toca.
          const vivo = await tx.proyecto.findUnique({ where: { id: pl.proyectoId }, select: { estado: true } });
          if (!vivo || vivo.estado === "FINALIZADO") return { leyes: 0, apus: 0 };
          let leyes = 0;
          let apus = 0;
          if (pl.leyesId) {
            const r = await tx.leyesSociales.updateMany({
              where: { id: pl.leyesId, ...Object.fromEntries(CAMPOS.map((c) => [c, aprox(APORTES_PATRONALES_VIEJOS[c])])) },
              data: { ...nuevos },
            });
            leyes += r.count;
            // FOCER personal (informativo) 3,0 → 0,5, solo si sigue valiendo 3,0.
            if (pl.cambiaFocerPersonal) {
              await tx.leyesSociales.updateMany({
                where: { id: pl.leyesId, focerPersonalPct: aprox(FOCER_PERSONAL_PCT_VIEJO) },
                data: { focerPersonalPct: FOCER_PERSONAL_PCT / 100 },
              });
            }
          }
          for (const a of pl.apus) {
            // Rubro primero (con el guard de precioCongelado null): si no se
            // pudo, el APU tampoco se toca, así no queda un APU nuevo con un
            // precio viejo. Precios como número directo (sin String()).
            const rr = await tx.rubro.updateMany({
              where: { id: a.rubroId, precioCongelado: null },
              data: { precioUnit: a.precioNuevo },
            });
            if (rr.count === 0) continue;
            const ra = await tx.aPU.updateMany({
              where: { rubroId: a.rubroId, aportesPatronalesPct: aprox(APORTES_PATRONALES_PCT_VIEJO) },
              data: { aportesPatronalesPct: a.pctNuevo },
            });
            if (ra.count === 0) throw new Error(`APU de ${a.rubroId} cambió durante la corrida — se revierte este proyecto`);
            apus += ra.count;
          }
          return { leyes, apus };
        },
        // La transacción por defecto de Prisma dura 5 s: con la base remota y
        // ~20 rubros (2 escrituras c/u) se vencía y revertía todo el proyecto.
        { timeout: txTimeoutMs, maxWait: 20_000 }
      );
      leyesOk += res.leyes;
      apuOk += res.apus;
      console.log(`  ✔ ${pl.nombre}: LeyesSociales ${res.leyes} · APU ${res.apus}  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    } catch (e) {
      fallas.push({ proyecto: pl.nombre, error: e });
      console.error(`  ✖ ${pl.nombre}: FALLÓ tras ${((Date.now() - t0) / 1000).toFixed(1)} s — se revirtió SOLO este proyecto.`);
      console.error(e instanceof Error ? `${e.message}\n${e.stack}` : e);
    }
  }
  console.log(`\nAPLICADO: LeyesSociales actualizadas ${leyesOk} · APU actualizados ${apuOk}${fallas.length ? ` · PROYECTOS CON FALLA: ${fallas.map((f) => f.proyecto).join(", ")}` : ""}`);
  await db.$disconnect();
  if (fallas.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
