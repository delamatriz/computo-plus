// Biblioteca — dos rubros nuevos en Albañilería › Patología de Fachada, para
// completar el flujo hidrolavado (7.14.1) → saneado → recomposición:
//
//  · 7.14.5 "Recomposición de revoques en fachada" (M2): el APU de 7.6.5
//    (revoque grueso muro exterior) MÁS el insumo y la mano de obra de 7.10.1
//    (puente de adherencia, SikaTop Modul), todo COPIADO sin cambiar ningún
//    valor. Hereda GG, utilidad y % de piedra de 7.6.5 (0 / 10 / 0,3).
//  · 7.14.6 "Recomposición de hormigón en fachada" (M2), GG 0 y utilidad 10:
//      mortero de reparación estructural 42 kg/m² (material NUEVO, abajo)
//      + puente de adherencia (SikaTop Modul 0,2 kg; Oficial albañil a
//        53,33 m²/jornada, igual que 7.10.1)
//      + mano de obra: Oficial trabajo en altura y Peón a 8 m²/jornada c/u.
//    Sin equipos y sin pasivante (el pasivante va aparte, 7.14.3, por ML).
//
// Material nuevo (PrecioMTOP): MAT-MORTERO-REPARACION-ESTRUCTURAL, "Mortero de
// reparación estructural de un componente", kg, $80/kg con IVA (precio de
// tienda con IVA, como todo el catálogo), sin proveedor y sin
// fechaUltimaVerificacion = "pendiente de verificar". ESTIMACIÓN TÉCNICA sin
// cotización (Luis delegó la estimación); la procedencia lo dice. Si ya existe
// no se toca (nunca pisa un precio corregido a mano).
//
// Las notas internas (SubrubroEstandar.notasInternas) son advertencias para
// quien arma el presupuesto: solo tooltip, no se imprimen.
//
// Seguridad:
//  · 7.14.5 y 7.14.6 tienen que estar LIBRES (o ya ser estos mismos rubros).
//  · Los APU origen (7.6.5 y 7.10.1) se leen en vivo; si ya no tienen la forma
//    esperada (los insumos que se copian) se aborta.
//  · La descripción nueva del material no puede estar contenida en ninguna otra
//    fila de PrecioMTOP, ni "secuestrar" el precio de otro material de la
//    Biblioteca (clonarApu matchea por descripción contenida, insensible a
//    mayúsculas, primer id): si alguna descripción de insumo existente quedaría
//    resolviendo a esta fila nueva, aborta.
//  · No toca ningún proyecto ni ningún otro rubro, material o precio.
//
// Idempotente: segunda corrida = 0 cambios. Una transacción, timeout 120 s.
//
// Ejecutar (dry-run): npx tsx scripts/agregar-recomposicion-fachada-2026-10.ts
// Ejecutar (real):     npx tsx scripts/agregar-recomposicion-fachada-2026-10.ts --apply   (solo con el OK de Luis)

import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-10";
const CODIGO_REVOQUES = "7.14.5";
const CODIGO_HORMIGON = "7.14.6";
const DESC_REVOQUES = "Recomposición de revoques en fachada";
const DESC_HORMIGON = "Recomposición de hormigón en fachada";
const NOTA_REVOQUES = "Usar sobre la misma superficie del saneado de revoques; la cantidad normalmente iguala la del saneado. El revoque fino va aparte.";
const NOTA_HORMIGON =
  "Espesor medio 2 cm; mortero y mano de obra son estimaciones. El pasivante de armaduras se presupuesta aparte (Tratamiento de hierros expuestos, por ML). El andamio o balancín va aparte, en Implantación.";

const MORTERO = {
  codigo: "MAT-MORTERO-REPARACION-ESTRUCTURAL",
  descripcion: "Mortero de reparación estructural de un componente",
  unidad: "kg",
  precio: 80,
  rendimiento: 42,
  nota:
    "ESTIMACIÓN sin cotización. Referencia: ficha de Sika MonoTop-412 S, ~19 kg de polvo por cm de espesor y m2, saco de 25 kg; espesor medio 2 cm más 10% de pérdidas. " +
    "Precio estimado ($2.000 el saco de 25 kg; rango $60 a $112/kg); reemplazar por cotización.",
};

const money = (n: number) => n.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const redondear2 = (n: number) => Math.round(n * 100) / 100;

type Insumos = {
  materiales: { descripcion: string; unidad: string; rendimiento: number }[];
  manoObra: { categoria: string; jornadaHs: number; rendimiento: number }[];
  equipos: { descripcion: string; unidad: string; rendimiento: number }[];
};

async function cargarApu(codigo: string) {
  const s = await db.subrubroEstandar.findUnique({
    where: { codigo },
    include: { apuEstandar: { include: { materiales: true, manoObra: true, equipos: true } } },
  });
  if (!s?.apuEstandar) throw new Error(`No se encontró ${codigo} con APU`);
  return s;
}

const clave = (xs: (string | number)[][]) => JSON.stringify(xs.map((x) => x.join("|")).sort());
const claveInsumos = (i: Insumos) =>
  JSON.stringify([
    clave(i.materiales.map((m) => [m.descripcion, m.unidad, m.rendimiento])),
    clave(i.manoObra.map((m) => [m.categoria, m.jornadaHs, m.rendimiento])),
    clave(i.equipos.map((m) => [m.descripcion, m.unidad, m.rendimiento])),
  ]);

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);

  const albanileria = await db.capituloCatalogo.findUnique({ where: { nombre: "Albañilería" } });
  if (!albanileria) throw new Error("No existe el capítulo Albañilería");
  const patologia = await db.subcapituloCatalogo.findFirst({ where: { capituloCatalogoId: albanileria.id, nombre: "Patología de Fachada" } });
  if (!patologia) throw new Error("No existe el subcapítulo Patología de Fachada");

  // ── Orígenes (leídos en vivo, valores sin tocar) ──
  const r765 = await cargarApu("7.6.5");
  const r7101 = await cargarApu("7.10.1");
  const a765 = r765.apuEstandar!;
  const a7101 = r7101.apuEstandar!;
  if (a7101.materiales.length !== 1 || a7101.manoObra.length !== 1 || a7101.equipos.length !== 0) throw new Error("7.10.1 ya no tiene la forma esperada (1 material, 1 mano de obra, sin equipos)");
  if (a765.gastosGeneralesPct !== 0 || a765.utilidadPct !== 10) throw new Error("7.6.5 ya no tiene GG 0 / utilidad 10");
  const modul = a7101.materiales[0];
  const moPuente = a7101.manoObra[0];
  if (!/sikatop modul/i.test(modul.descripcion) || modul.rendimiento !== 0.2) throw new Error("El insumo de 7.10.1 ya no es SikaTop Modul a 0,2 kg");

  const insumos765: Insumos = {
    materiales: a765.materiales.map((m) => ({ descripcion: m.descripcion, unidad: m.unidad, rendimiento: m.rendimiento })),
    manoObra: a765.manoObra.map((m) => ({ categoria: m.categoria, jornadaHs: m.jornadaHs, rendimiento: m.rendimiento })),
    equipos: a765.equipos.map((m) => ({ descripcion: m.descripcion, unidad: m.unidad, rendimiento: m.rendimiento })),
  };
  const insumosPuente = {
    material: { descripcion: modul.descripcion, unidad: modul.unidad, rendimiento: modul.rendimiento },
    mo: { categoria: moPuente.categoria, jornadaHs: moPuente.jornadaHs, rendimiento: moPuente.rendimiento },
  };

  const def5: Insumos = {
    materiales: [...insumos765.materiales, insumosPuente.material],
    manoObra: [...insumos765.manoObra, insumosPuente.mo],
    equipos: insumos765.equipos,
  };
  const def6: Insumos = {
    materiales: [{ descripcion: MORTERO.descripcion, unidad: MORTERO.unidad, rendimiento: MORTERO.rendimiento }, insumosPuente.material],
    manoObra: [
      { categoria: "Oficial trabajo en altura", jornadaHs: 8, rendimiento: 8 },
      { categoria: "Peón", jornadaHs: 8, rendimiento: 8 },
      insumosPuente.mo,
    ],
    equipos: [],
  };

  // ── Precios de referencia (mismos que usa clonarApu) ──
  const jornales = await db.categoriaLaboral.findMany();
  const jornalDe = (cat: string) => {
    const c = jornales.find((x) => x.nombre.trim().toLowerCase() === cat.trim().toLowerCase());
    if (!c) throw new Error(`Categoría laboral "${cat}" no existe`);
    return c.jornal;
  };
  const precioMat = async (descripcion: string): Promise<{ precio: number; codigo: string }> => {
    if (descripcion === MORTERO.descripcion) return { precio: MORTERO.precio, codigo: MORTERO.codigo + " (nuevo)" };
    const p = await db.precioMTOP.findFirst({ where: { descripcion: { contains: descripcion, mode: "insensitive" } }, orderBy: { id: "asc" } });
    if (!p) throw new Error(`Sin precio para el material «${descripcion}»`);
    return { precio: p.precioUnitario, codigo: p.codigo };
  };
  const precioEq = async (descripcion: string) => {
    const e = await db.precioEquipo.findFirst({ where: { descripcion: { contains: descripcion, mode: "insensitive" } } });
    if (!e) throw new Error(`Sin costo para el equipo «${descripcion}»`);
    return e.precioHora;
  };

  async function calcular(nombre: string, d: Insumos, gg: number, util: number) {
    console.log(`  Cálculo a mano de ${nombre}:`);
    let sumMat = 0, sumMO = 0, sumEq = 0;
    for (const m of d.materiales) {
      const p = await precioMat(m.descripcion);
      sumMat += m.rendimiento * p.precio;
      console.log(`     MAT  ${m.descripcion.slice(0, 52).padEnd(52)} ${String(m.rendimiento).padStart(7)} ${m.unidad.padEnd(3)} × $${money(p.precio).padStart(9)} [${p.codigo}] = ${money(m.rendimiento * p.precio).padStart(10)}`);
    }
    for (const m of d.manoObra) {
      const j = jornalDe(m.categoria);
      sumMO += j / m.rendimiento;
      console.log(`     MO   ${m.categoria.padEnd(52)} jornal $${money(j)} ÷ ${m.rendimiento.toFixed(4).padStart(7)} m²/jornada           = ${money(j / m.rendimiento).padStart(10)}`);
    }
    for (const m of d.equipos) {
      const c = await precioEq(m.descripcion);
      sumEq += m.rendimiento * c;
      console.log(`     EQ   ${m.descripcion.padEnd(52)} ${String(m.rendimiento.toFixed(5)).padStart(7)}     × $${money(c).padStart(9)}              = ${money(m.rendimiento * c).padStart(10)}`);
    }
    const cd = sumMat + sumMO + sumEq;
    const precio = redondear2(cd * (1 + gg / 100) * (1 + util / 100));
    console.log(`     Materiales ${money(sumMat)} + Mano de obra ${money(sumMO)} + Equipos ${money(sumEq)} = Costo Directo ${money(cd)}  ×  (1 + GG ${gg}%) × (1 + utilidad ${util}%)  =  $${money(precio)}/M2`);
    return precio;
  }

  // ── Material nuevo ──
  console.log("── Material nuevo (PrecioMTOP) ──");
  const existente = await db.precioMTOP.findFirst({ where: { codigo: MORTERO.codigo, proveedor: null } });
  console.log(`  ${existente ? "= ya existe (no se toca)" : "+ crea"} ${MORTERO.codigo} — «${MORTERO.descripcion}» — $${money(MORTERO.precio)}/${MORTERO.unidad} (IVA incluido) — fechaLista ${FECHA} — sin proveedor — pendiente de verificar`);
  console.log(`      procedencia: ${MORTERO.nota}`);

  // La descripción nueva no puede estar contenida en otra fila, ni secuestrar el precio de otro insumo.
  const quienContiene = await db.precioMTOP.findMany({
    where: { descripcion: { contains: MORTERO.descripcion, mode: "insensitive" }, ...(existente ? { id: { not: existente.id } } : {}) },
    select: { codigo: true, descripcion: true },
  });
  console.log(`  Verificación — otras filas de PrecioMTOP que contienen «${MORTERO.descripcion}»: ${quienContiene.length === 0 ? "ninguna ✔" : quienContiene.map((x) => x.codigo).join(", ")}`);
  if (quienContiene.length > 0) throw new Error("La descripción del material nuevo está contenida en otra fila de PrecioMTOP — no se escribe nada");

  const insumosExistentes = [
    ...new Set([
      ...(await db.materialAPUEstandar.findMany({ select: { descripcion: true } })).map((m) => m.descripcion),
      ...(await db.materialAPU.findMany({ select: { descripcion: true } })).map((m) => m.descripcion),
    ]),
  ];
  const secuestrados: string[] = [];
  for (const d of insumosExistentes) {
    if (!d || !MORTERO.descripcion.toLowerCase().includes(d.trim().toLowerCase())) continue;
    // Los insumos de los rubros nuevos (7.14.6) usan justo esta descripción: son los propios, no un caso ajeno.
    if (d.trim().toLowerCase() === MORTERO.descripcion.toLowerCase()) continue;
    // ¿Hoy ya resuelve a otra fila (con id anterior que gana)? Entonces no cambia nada.
    const hoy = await db.precioMTOP.findFirst({ where: { descripcion: { contains: d, mode: "insensitive" }, ...(existente ? { id: { not: existente.id } } : {}) }, orderBy: { id: "asc" } });
    if (!hoy) secuestrados.push(d);
  }
  console.log(`  Verificación — insumos existentes (Biblioteca ${insumosExistentes.length} descripciones distintas, incl. proyectos) cuya descripción está contenida en la del material nuevo y hoy NO tienen precio: ${secuestrados.length === 0 ? "ninguno ✔ (no cambia el precio de nada existente)" : secuestrados.join(" ; ")}`);
  if (secuestrados.length > 0) throw new Error("El material nuevo cambiaría el precio de insumos existentes — no se escribe nada");

  // ── Rubros ──
  const rubros = [
    { codigo: CODIGO_REVOQUES, descripcion: DESC_REVOQUES, notas: NOTA_REVOQUES, insumos: def5, gg: a765.gastosGeneralesPct, util: a765.utilidadPct, piedra: a765.porcentajePiedra, esperado: 779.87 },
    { codigo: CODIGO_HORMIGON, descripcion: DESC_HORMIGON, notas: NOTA_HORMIGON, insumos: def6, gg: 0, util: 10, piedra: a765.porcentajePiedra, esperado: null as number | null },
  ];
  const hermanos = await db.subrubroEstandar.findMany({ where: { subcapituloId: patologia.id } });
  let proximoOrden = hermanos.reduce((mx, h) => Math.max(mx, h.orden ?? -1), -1) + 1;

  console.log("\n── Rubros nuevos (SubrubroEstandar + APUEstandar) ──");
  const planes: { def: (typeof rubros)[number]; precio: number; yaExiste: boolean; apuIgual: boolean; orden: number }[] = [];
  for (const r of rubros) {
    const ex = await db.subrubroEstandar.findUnique({ where: { codigo: r.codigo }, include: { apuEstandar: { include: { materiales: true, manoObra: true, equipos: true } } } });
    if (ex && ex.descripcion !== r.descripcion) throw new Error(`El código ${r.codigo} ya está ocupado por «${ex.descripcion}» — no se escribe nada`);
    console.log(`\n  ${ex ? "= ya existe" : "+ crea"} ${r.codigo} — «${r.descripcion}» (M2) — Albañilería › Patología de Fachada — GG ${r.gg}% · utilidad ${r.util}% · % piedra ${r.piedra}`);
    const precio = await calcular(r.codigo, r.insumos, r.gg, r.util);
    if (r.esperado != null) {
      // El esperado es la suma de los DOS precios ya redondeados (7.6.5 + 7.10.1); el
      // APU combinado se redondea una sola vez, así que puede diferir 1 centavo.
      const dif = precio - r.esperado;
      console.log(`     Control: 7.6.5 ($${money(r765.precioUY)}) + 7.10.1 ($${money(r7101.precioUY)}) = $${money(r765.precioUY + r7101.precioUY)} (suma de dos precios redondeados) · APU combinado $${money(precio)} · diferencia ${dif >= 0 ? "+" : "−"}$${money(Math.abs(dif))} ${Math.abs(dif) < 0.015 ? "✔ solo redondeo" : "✖ NO COINCIDE"}`);
      if (Math.abs(dif) >= 0.015) throw new Error(`${r.codigo}: el precio calculado (${precio}) no coincide con el esperado (${r.esperado}) — no se escribe nada`);
    }
    console.log(`     notasInternas: «${r.notas}»`);
    const apuIgual = !!ex?.apuEstandar && claveInsumos({
      materiales: ex.apuEstandar.materiales, manoObra: ex.apuEstandar.manoObra, equipos: ex.apuEstandar.equipos,
    }) === claveInsumos(r.insumos);
    planes.push({ def: r, precio, yaExiste: !!ex, apuIgual, orden: ex?.orden ?? proximoOrden++ });
  }

  console.log("\n── No se toca ──");
  console.log("  Ningún proyecto, ni 7.6.5, ni 7.10.1, ni ningún otro rubro, material o precio.");

  const cambios = (existente ? 0 : 1) + planes.filter((p) => !p.yaExiste || !p.apuIgual).length;
  if (aplicar && cambios > 0) {
    await db.$transaction(
      async (tx) => {
        if (!existente) {
          await tx.precioMTOP.create({
            data: {
              codigo: MORTERO.codigo, descripcion: MORTERO.descripcion, cantidadUnidad: `1 ${MORTERO.unidad}`, unidad: MORTERO.unidad, cantidad: 1,
              precioConIva: MORTERO.precio, precioUnitario: MORTERO.precio, numeroLista: 0, fechaLista: FECHA, notaProcedencia: MORTERO.nota,
            },
          });
        }
        for (const p of planes) {
          const sub = await tx.subrubroEstandar.upsert({
            where: { codigo: p.def.codigo },
            create: {
              codigo: p.def.codigo, descripcion: p.def.descripcion, unidad: "M2", precioUY: p.precio, fechaBase: FECHA, origen: "manual", orden: p.orden,
              notasInternas: p.def.notas, capituloId: albanileria.id, subcapituloId: patologia.id,
            },
            update: {}, // si ya existe no se pisa nada (precio, orden y notas pueden estar corregidos a mano)
          });
          if (p.yaExiste && p.apuIgual) continue;
          const apu = (await tx.aPUEstandar.findUnique({ where: { subrubroId: sub.id } })) ??
            (await tx.aPUEstandar.create({ data: { subrubroId: sub.id, gastosGeneralesPct: p.def.gg, utilidadPct: p.def.util, porcentajePiedra: p.def.piedra } }));
          await tx.materialAPUEstandar.deleteMany({ where: { apuId: apu.id } });
          await tx.manoObraAPUEstandar.deleteMany({ where: { apuId: apu.id } });
          await tx.equipoAPUEstandar.deleteMany({ where: { apuId: apu.id } });
          for (const m of p.def.insumos.materiales) await tx.materialAPUEstandar.create({ data: { apuId: apu.id, ...m } });
          for (const m of p.def.insumos.manoObra) await tx.manoObraAPUEstandar.create({ data: { apuId: apu.id, ...m } });
          for (const m of p.def.insumos.equipos) await tx.equipoAPUEstandar.create({ data: { apuId: apu.id, ...m } });
        }
      },
      { timeout: 120_000 }
    );
  }

  console.log(`\nRESUMEN: ${cambios} cambio(s).`);
  console.log(aplicar ? "APLICADO." : "DRY RUN: no se escribió nada. Para aplicar: --apply (solo con el OK de Luis).");
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
