// Limpieza y Retiro de Obra — precios reales de LIMP-001 y LIMP-002 con lo que
// cotiza Luis (reemplaza las estimaciones "Estimado por IA").
//
// LIMP-001 y LIMP-002 YA existen en PrecioMTOP (gl y m2): este script ACTUALIZA
// esas filas, no crea materiales nuevos, para que 28.1, 28.9 y 28.6 sigan
// vinculados (clonarApu matchea el material por descripción contenida, así que
// al cambiar la descripción del precio hay que cambiar la del insumo de la
// Biblioteca en el mismo paso: se hace acá).
//
// Datos: scripts/limpieza-precios-2026-10.datos.json (los trae Luis). Mientras
// falte alguno, el script lo dice y NO calcula ni escribe nada.
//
// Cálculo (precios de tienda CON IVA, como todo el catálogo; la app suma el 22%
// al final de la cascada):
//  · LIMP-001 (gl) = kit mensual SOLO de consumibles:
//        2 × paquete de bolsas (x10) + 1 × bidón de desengrasante de 5 L
//        + 2 × par de guantes + 4 × trapo de piso
//    Escobas, cepillo, pala y secador NO entran (van en Gastos Generales).
//  · LIMP-002 (m2) = (precio del bidón de limpiapisos ÷ 5 L) × (X ml de
//        concentrado por balde ÷ 1.000) ÷ (m² que cubre un balde)
//        + (precio del trapo ÷ m² por trapo)
//    SIN dividir otra vez por los litros del balde. Dos SUPUESTOS, anotados como
//    tales en la procedencia y en el reporte salvo que Luis dé otro dato:
//    40 m² por balde y 1 trapo cada 100 m². Sin protector.
//  Los precios se redondean a 2 decimales (convención del catálogo).
//
// Qué escribe (una sola transacción, timeout 120 s):
//  1. PrecioMTOP LIMP-001 / LIMP-002 (proveedor null a propósito: con
//     proveedor poblado el job de verificación los re-verificaría solo):
//       descripcion  "Insumos de limpieza periódica (consumibles)" /
//                    "Insumos de limpieza fina de pisos (limpiapisos concentrado y trapos)"
//                    (sin la palabra "protector")
//       precioUnitario = precioConIva = precio nuevo; precioAnterior = el viejo
//       notaProcedencia con comercio, fecha, "IVA incluido" y la cuenta
//       (sin fechaUltimaVerificacion: queda "pendiente de verificar")
//  2. MaterialAPUEstandar: el insumo de 28.1, 28.9 y 28.6 cambia de descripción
//     para seguir matcheando con la fila de precio.
//  3. SubrubroEstandar.precioUY de 28.1, 28.9 y 28.6: se recalcula COMPLETO,
//     igual que seed-limpieza-retiro-obra-2026-10.ts: (insumo × rendimiento +
//     Σ jornal ÷ rendimiento de la mano de obra) × (1 + GG) × (1 + utilidad) del
//     propio APU, redondeado a 2 decimales. (Una primera versión ajustaba por
//     la diferencia de precio sobre un valor ya redondeado y dejó 28.6 un
//     centavo arriba del seed; esta segunda pasada lo corrige.)
//  NO toca: proyectos (los rubros ya clonados no tienen vínculo vivo con la
//  Biblioteca; se listan los MaterialAPU que apuntan a estas filas), MAT-
//  INSUMOS-LIMPIEZA-FINAL, 28.2/28.3/28.4/28.5/28.7/28.8 ni ningún otro precio.
//
// Idempotente: si la fila ya tiene los valores nuevos no hace nada (segunda
// corrida = 0 cambios). Cada UPDATE lleva en el where el valor leído.
//
// Mantener sincronizado con scripts/seed-limpieza-retiro-obra-2026-10.ts
// (PRECIOS_MTOP_NUEVOS), para que volver a correrlo no revierta nada.
//
// Ejecutar (dry-run): npx tsx scripts/actualizar-precios-limpieza-2026-10.ts
// Ejecutar (real):     npx tsx scripts/actualizar-precios-limpieza-2026-10.ts --apply   (solo con el OK de Luis)
// Otro archivo de datos: ... --datos=ruta/al/archivo.json

import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import fs from "fs";
import path from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const DESC_LIMP_001 = "Insumos de limpieza periódica (consumibles)";
const DESC_LIMP_002 = "Insumos de limpieza fina de pisos (limpiapisos concentrado y trapos)";
// Rubros de la Biblioteca que usan cada material.
const RUBROS_LIMP_001 = ["28.1", "28.9"];
const RUBROS_LIMP_002 = ["28.6"];

const redondear2 = (n: number) => Math.round(n * 100) / 100;
const money = (n: number) => n.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money4 = (n: number) => n.toLocaleString("es-UY", { minimumFractionDigits: 4, maximumFractionDigits: 4 });

type Item = { comercio?: string | null };
type Datos = {
  fecha?: string;
  // true: los valores son ESTIMACIONES de mercado, no cotizaciones (la procedencia lo dice).
  estimacion?: boolean;
  bolsas?: Item & { precioPaqueteX10?: number | null };
  desengrasante?: Item & { precioBidon5L?: number | null };
  guantes?: Item & { precioPar?: number | null };
  trapo?: Item & { precioUnidad?: number | null };
  limpiapisos?: Item & { precioBidon5L?: number | null; dilucionMlPorBalde?: number | null; m2PorBalde?: number | null; m2PorTrapo?: number | null; litrosBalde?: number | null };
};

// Supuesto por defecto: 1 trapo de piso cada 100 m² (a confirmar con Luis).
const M2_POR_TRAPO_SUPUESTO = 100;

const esPositivo = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;

function leerDatos(ruta: string): { d: Required<{ [K in keyof Datos]: NonNullable<Datos[K]> }> | null; faltan: string[] } {
  const crudo: Datos = JSON.parse(fs.readFileSync(ruta, "utf8"));
  const faltan: string[] = [];
  const req = (ok: boolean, nombre: string) => { if (!ok) faltan.push(nombre); };
  req(esPositivo(crudo.bolsas?.precioPaqueteX10), "bolsas.precioPaqueteX10");
  req(!!crudo.bolsas?.comercio?.trim(), "bolsas.comercio");
  req(esPositivo(crudo.desengrasante?.precioBidon5L), "desengrasante.precioBidon5L");
  req(esPositivo(crudo.guantes?.precioPar), "guantes.precioPar");
  req(esPositivo(crudo.trapo?.precioUnidad), "trapo.precioUnidad");
  req(esPositivo(crudo.limpiapisos?.precioBidon5L), "limpiapisos.precioBidon5L");
  req(esPositivo(crudo.limpiapisos?.dilucionMlPorBalde), "limpiapisos.dilucionMlPorBalde");
  req(esPositivo(crudo.limpiapisos?.m2PorBalde), "limpiapisos.m2PorBalde");
  req(esPositivo(crudo.limpiapisos?.m2PorTrapo), "limpiapisos.m2PorTrapo");
  return { d: faltan.length ? null : (crudo as never), faltan };
}

// Comercio de un ítem; si no lo trae, el de las bolsas (el único renglón de la
// planilla que lo pide explícitamente).
const comercioDe = (d: NonNullable<ReturnType<typeof leerDatos>["d"]>, it?: Item | null) =>
  it?.comercio?.trim() || d.bolsas.comercio?.trim() || "comercio sin indicar";

async function main() {
  const aplicar = process.argv.includes("--apply");
  const arg = process.argv.find((a) => a.startsWith("--datos="));
  const ruta = arg ? arg.slice("--datos=".length) : path.join(process.cwd(), "scripts", "limpieza-precios-2026-10.datos.json");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}`);
  console.log(`Datos: ${ruta}\n`);

  const { d, faltan } = leerDatos(ruta);
  if (!d) {
    console.log("Faltan datos de Luis — no se calcula ni se escribe nada. Completar en el archivo de datos:");
    for (const f of faltan) console.log(`  · ${f}`);
    await db.$disconnect();
    return;
  }
  const fecha = d.fecha ?? "2026-10";

  // ── Cálculo ──
  const kit = redondear2(2 * d.bolsas.precioPaqueteX10! + d.desengrasante.precioBidon5L! + 2 * d.guantes.precioPar! + 4 * d.trapo.precioUnidad!);
  const lp = d.limpiapisos;
  const productoPorM2 = (lp.precioBidon5L! / 5) * (lp.dilucionMlPorBalde! / 1000) / lp.m2PorBalde!;
  const trapoPorM2 = d.trapo.precioUnidad! / lp.m2PorTrapo!;
  const porM2Exacto = productoPorM2 + trapoPorM2;
  const porM2 = redondear2(porM2Exacto);
  const supBalde = lp.m2PorBalde === 40 ? " (SUPUESTO, a confirmar)" : "";
  const supTrapo = lp.m2PorTrapo === M2_POR_TRAPO_SUPUESTO ? " (SUPUESTO, a confirmar)" : "";

  console.log("── Cálculo ──");
  console.log(`  LIMP-001 (kit mensual de consumibles) = 2 × ${money(d.bolsas.precioPaqueteX10!)} (bolsas x10) + 1 × ${money(d.desengrasante.precioBidon5L!)} (desengrasante 5 L) + 2 × ${money(d.guantes.precioPar!)} (guantes) + 4 × ${money(d.trapo.precioUnidad!)} (trapo)`);
  console.log(`      = $${money(kit)} /gl   (no incluye escobas, cepillo, pala ni secador: van en Gastos Generales)`);
  console.log(`  LIMP-002 = (${money(lp.precioBidon5L!)} ÷ 5 L) × (${lp.dilucionMlPorBalde} ml ÷ 1.000) ÷ ${lp.m2PorBalde} m² por balde + ${money(d.trapo.precioUnidad!)} (trapo) ÷ ${lp.m2PorTrapo} m² por trapo`);
  console.log(`      = $${money4(productoPorM2)} (limpiapisos) + $${money4(trapoPorM2)} (trapos) = $${money4(porM2Exacto)} → $${money(porM2)} /m²`);
  console.log(`      supuestos: ${lp.m2PorBalde} m² por balde${supBalde}; 1 trapo cada ${lp.m2PorTrapo} m²${supTrapo}`);

  const est = d.estimacion === true;
  const AVISO_ESTIMACION = " ESTIMACIÓN sin cotización, rango de mercado; reemplazar por precios de tienda cuando se compren.";
  const comercioLimp001 = [...new Set([comercioDe(d, d.bolsas), comercioDe(d, d.desengrasante), comercioDe(d, d.guantes), comercioDe(d, d.trapo)])].join(" / ");
  const nota001 =
    `Kit mensual de consumibles, ${fecha} (${comercioLimp001}): 2 paquetes de bolsas de residuos x10 ($${money(d.bolsas.precioPaqueteX10!)} c/u), ` +
    `1 bidón de desengrasante de 5 L ($${money(d.desengrasante.precioBidon5L!)}), 2 pares de guantes ($${money(d.guantes.precioPar!)} c/u), 4 trapos de piso ($${money(d.trapo.precioUnidad!)} c/u). ` +
    `${est ? "Precios estimados" : "Precios de tienda publicados"}, IVA incluido (mismo criterio que el resto del catálogo). ` +
    "No incluye escobas, cepillo, pala ni secador: las herramientas van en Gastos Generales." + (est ? AVISO_ESTIMACION : "") + " Pendiente de verificar.";
  const nota002 =
    `Limpiapisos concentrado, bidón de 5 L a $${money(lp.precioBidon5L!)} (${comercioDe(d, lp)}, ${fecha}), y trapo de piso a $${money(d.trapo.precioUnidad!)}. ` +
    `${est ? "Precios estimados" : "Precios de tienda publicados"}, IVA incluido (mismo criterio que el resto del catálogo). ` +
    `Cálculo: (precio del bidón ÷ 5 L) × (${lp.dilucionMlPorBalde} ml de concentrado por balde${lp.litrosBalde ? ` de ${lp.litrosBalde} L` : ""} ÷ 1.000) ÷ ${lp.m2PorBalde} m² por balde + (precio del trapo ÷ ${lp.m2PorTrapo} m² por trapo). ` +
    `Supuestos a confirmar: ${lp.m2PorBalde} m² por balde${lp.m2PorBalde === 40 ? "" : " (dato de Luis)"} y 1 trapo cada ${lp.m2PorTrapo} m²${lp.m2PorTrapo === M2_POR_TRAPO_SUPUESTO ? "" : " (dato de Luis)"}. ` +
    (est ? AVISO_ESTIMACION.trimStart() + " " : "") +
    "Pendiente de verificar.";

  const objetivos = [
    { codigo: "LIMP-001", descNueva: DESC_LIMP_001, precio: kit, nota: nota001, rubros: RUBROS_LIMP_001 },
    { codigo: "LIMP-002", descNueva: DESC_LIMP_002, precio: porM2, nota: nota002, rubros: RUBROS_LIMP_002 },
  ];

  // ── Lectura y plan ──
  type Plan = {
    codigo: string; fila: NonNullable<Awaited<ReturnType<typeof db.precioMTOP.findFirst>>>; descNueva: string; precio: number; nota: string;
    cambiaFila: boolean;
    insumos: { id: string; apuId: string; codigoRubro: string; descActual: string; rendimiento: number }[];
    rubrosPrecio: { id: string; codigo: string; precioUY: number; nuevo: number; factor: number; rendimiento: number }[];
  };
  const planes: Plan[] = [];
  const categorias = await db.categoriaLaboral.findMany();
  for (const o of objetivos) {
    const fila = await db.precioMTOP.findFirst({ where: { codigo: o.codigo, proveedor: null } });
    if (!fila) throw new Error(`${o.codigo} no existe en PrecioMTOP (esto actualiza, no crea)`);
    const cambiaFila =
      fila.descripcion !== o.descNueva || Math.abs(fila.precioUnitario - o.precio) > 1e-9 || Math.abs(fila.precioConIva - o.precio) > 1e-9 || fila.notaProcedencia !== o.nota;

    const insumos: Plan["insumos"] = [];
    const rubrosPrecio: Plan["rubrosPrecio"] = [];
    for (const codRubro of o.rubros) {
      const sub = await db.subrubroEstandar.findUnique({
        where: { codigo: codRubro },
        include: { apuEstandar: { include: { materiales: true, manoObra: true, equipos: true } } },
      });
      if (!sub?.apuEstandar) throw new Error(`No se encontró ${codRubro} con APU`);
      const lineas = sub.apuEstandar.materiales.filter((m) => m.descripcion === fila.descripcion || m.descripcion === o.descNueva);
      if (lineas.length !== 1) throw new Error(`${codRubro}: se esperaba 1 insumo de ${o.codigo} y hay ${lineas.length}`);
      const linea = lineas[0];
      insumos.push({ id: linea.id, apuId: sub.apuEstandar.id, codigoRubro: codRubro, descActual: linea.descripcion, rendimiento: linea.rendimiento });
      const apu = sub.apuEstandar;
      if (apu.materiales.length !== 1 || apu.equipos.length !== 0) throw new Error(`${codRubro}: se esperaba 1 material y sin equipos (APU distinto del que el seed arma)`);
      const sumMat = linea.rendimiento * o.precio;
      const sumMO = apu.manoObra.reduce((acc, mo) => {
        const c = categorias.find((x) => x.nombre.trim().toLowerCase() === mo.categoria.trim().toLowerCase());
        if (!c) throw new Error(`Categoría laboral "${mo.categoria}" no existe`);
        return acc + c.jornal / mo.rendimiento;
      }, 0);
      const factor = (1 + apu.gastosGeneralesPct / 100) * (1 + apu.utilidadPct / 100);
      rubrosPrecio.push({ id: sub.id, codigo: codRubro, precioUY: sub.precioUY, nuevo: redondear2((sumMat + sumMO) * factor), factor, rendimiento: linea.rendimiento });
    }
    planes.push({ codigo: o.codigo, fila, descNueva: o.descNueva, precio: o.precio, nota: o.nota, cambiaFila, insumos, rubrosPrecio });
  }

  // El clon matchea por descripción contenida (insensible a mayúsculas, id asc): la
  // nueva descripción no puede estar contenida en OTRA fila con id anterior.
  console.log("\n── Verificación del matching al clonar ──");
  for (const p of planes) {
    const candidatos = await db.precioMTOP.findMany({ where: { descripcion: { contains: p.descNueva, mode: "insensitive" } }, orderBy: { id: "asc" }, select: { id: true, codigo: true } });
    const otros = candidatos.filter((c) => c.id !== p.fila.id);
    const primero = candidatos[0];
    console.log(`  «${p.descNueva}» → ${otros.length ? "también la contienen: " + otros.map((c) => c.codigo).join(", ") : "solo " + p.codigo}${primero && primero.id !== p.fila.id ? "  ⚠ GANA OTRA FILA" : ""}`);
    if (otros.some((c) => c.id < p.fila.id)) throw new Error(`Otra fila contiene «${p.descNueva}» con id anterior: el clon matchearía mal — revisar`);
  }

  // ── Informe ──
  let cambios = 0;
  console.log("\n── Cambios ──");
  for (const p of planes) {
    console.log(`\n  PrecioMTOP ${p.codigo} (${p.fila.unidad})  ${p.cambiaFila ? "→ SE ACTUALIZA" : "= ya tiene los valores nuevos"}`);
    console.log(`    descripción: «${p.fila.descripcion}» → «${p.descNueva}»`);
    console.log(`    precio:      $${money(p.fila.precioUnitario)} → $${money(p.precio)}   (variación ${(((p.precio - p.fila.precioUnitario) / p.fila.precioUnitario) * 100).toFixed(1)}%)`);
    console.log(`    procedencia: ${p.nota}`);
    if (p.cambiaFila) cambios++;
    for (const i of p.insumos) {
      const cambia = i.descActual !== p.descNueva;
      console.log(`    insumo ${i.codigoRubro} (MaterialAPUEstandar): ${cambia ? `«${i.descActual}» → «${p.descNueva}»` : "ya con la descripción nueva"}`);
      if (cambia) cambios++;
    }
    for (const r of p.rubrosPrecio) {
      const cambia = Math.abs(r.nuevo - r.precioUY) > 1e-9;
      console.log(`    rubro ${r.codigo} precioUY: $${money(r.precioUY)} → $${money(r.nuevo)}  [${cambia ? `recalculado: (insumo × ${r.rendimiento} + mano de obra) × ${r.factor.toFixed(2)}` : "sin cambio"}]`);
      if (cambia) cambios++;
    }
  }

  // Proyectos: solo informar (los clones no tienen vínculo vivo con la Biblioteca).
  const ids = planes.map((p) => p.fila.id);
  const enProyectos = await db.materialAPU.findMany({
    where: { precioMTOPId: { in: ids } },
    select: { id: true, descripcion: true, precioUnit: true, apu: { select: { rubro: { select: { codigo: true, capitulo: { select: { proyecto: { select: { nombre: true } } } } } } } } },
  });
  console.log("\n── Proyectos (NO se modifican) ──");
  if (enProyectos.length === 0) console.log("  Ningún MaterialAPU de proyecto apunta a estas filas.");
  for (const m of enProyectos) {
    console.log(`  ⚠ «${m.apu.rubro.capitulo.proyecto.nombre.trim()}» rubro ${m.apu.rubro.codigo}: MaterialAPU «${m.descripcion}» con precio copiado $${money(m.precioUnit)} — queda como está.`);
  }

  console.log("\n── No se toca ──");
  console.log("  Proyectos, MAT-INSUMOS-LIMPIEZA-FINAL, rubros 28.2/28.3/28.4/28.5/28.7/28.8 y cualquier otro precio.");

  if (aplicar && cambios > 0) {
    await db.$transaction(
      async (tx) => {
        for (const p of planes) {
          if (p.cambiaFila) {
            const r = await tx.precioMTOP.updateMany({
              where: { id: p.fila.id, precioUnitario: p.fila.precioUnitario, descripcion: p.fila.descripcion },
              data: {
                descripcion: p.descNueva,
                precioUnitario: p.precio,
                precioConIva: p.precio,
                precioAnterior: p.fila.precioUnitario,
                notaProcedencia: p.nota,
                fechaLista: fecha,
              },
            });
            if (r.count !== 1) throw new Error(`${p.codigo}: la fila cambió mientras tanto — se aborta sin escribir`);
          }
          for (const i of p.insumos) {
            if (i.descActual === p.descNueva) continue;
            const r = await tx.materialAPUEstandar.updateMany({ where: { id: i.id, descripcion: i.descActual }, data: { descripcion: p.descNueva } });
            if (r.count !== 1) throw new Error(`${i.codigoRubro}: el insumo cambió mientras tanto — se aborta sin escribir`);
          }
          for (const rp of p.rubrosPrecio) {
            if (Math.abs(rp.nuevo - rp.precioUY) <= 1e-9) continue;
            const r = await tx.subrubroEstandar.updateMany({ where: { id: rp.id, precioUY: rp.precioUY }, data: { precioUY: rp.nuevo } });
            if (r.count !== 1) throw new Error(`${rp.codigo}: el precio cambió mientras tanto — se aborta sin escribir`);
          }
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
