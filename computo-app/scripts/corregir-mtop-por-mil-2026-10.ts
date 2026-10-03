// Lista MTOP N°599 — 20 filas con "1.000" mal parseado (precio sin dividir por 1.000).
//
// Qué pasó: el archivo prisma/seed-mtop-data.ts (AUTO-GENERADO, del 7/jun/2026,
// el parser original no está en el repo) leyó la cantidad "1.000 u" con el
// punto como decimal → cantidad 1,000 = 1, y dejó el precio de lista (que es
// por 1.000) como si fuera por unidad. "1000 pie" (Madera cerejeira, código
// 245), escrita SIN punto, se leyó bien (cantidad 1000, precioUnitario =
// precioConIva / 1000): es el formato correcto, y a ese se llevan las 20.
//
// Filas afectadas (ladrillos, tejas, ticholos, azulejos, maderas, piedra laja,
// Asfalto R.C.): las que cumplen EXACTAMENTE el patrón
//   proveedor null · numeroLista 599 · cantidadUnidad "1.000 …" · cantidad 1 ·
//   precioUnitario == precioConIva (el precio de lista, sin dividir).
//
// Corrección por fila (formato de la fila 245):
//   cantidad        1  → 1000
//   precioUnitario  precioConIva / 1000, redondeado a 2 decimales (como el
//                   resto de la Lista MTOP)
//   precioConIva    NO cambia (es el precio de lista por 1.000)
//   cantidadUnidad y unidad NO cambian ("1.000 u" describe la presentación; la
//                   unidad ya es la unidad simple: u, pies, kg, l)
//   notaProcedencia "Corregido oct-2026: el precio de la lista era por 1.000
//                   unidades. …" (las 20 tenían la nota vacía)
//   precioAnterior  el precioUnitario viejo (auditoría)
//
// Seguridad: ningún APU ni proyecto toca estas filas hoy. Aun así el script lo
// verifica ANTES de escribir (MaterialAPU.precioMTOPId, y por texto contenido
// —como clona clonarApu: descripcion contains, insensible a mayúsculas— contra
// MaterialAPUEstandar y MaterialAPU de proyectos) y ABORTA si alguna fila está en
// uso: en ese caso hay que decidir a mano qué hacer con los precios ya copiados.
// No toca APUs, proyectos ni ninguna otra fila de PrecioMTOP.
//
// Idempotente: una fila ya corregida (cantidad 1000 y la nota de corrección)
// no cumple el patrón y se informa como "ya corregida"; segunda corrida = 0
// cambios. Cada UPDATE lleva en el where el valor leído (cantidad y precio): si
// alguien editó la fila entre la lectura y la escritura, no se pisa y se aborta
// la transacción. Una sola transacción, timeout de 120 s.
//
// Ejecutar (dry-run): npx tsx scripts/corregir-mtop-por-mil-2026-10.ts
// Ejecutar (real):     npx tsx scripts/corregir-mtop-por-mil-2026-10.ts --apply

import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const ESPERADAS = 20;
const TOL_PRECIO = 0.005; // precioUnitario == precioConIva (a menos de medio centavo)
const NOTA = "Corregido oct-2026: el precio de la lista era por 1.000 unidades.";
const redondear2 = (n: number) => Math.round(n * 100) / 100;
const money = (n: number) => n.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);

  const todas = await db.precioMTOP.findMany({
    where: { proveedor: null, numeroLista: 599, cantidadUnidad: { startsWith: "1.000" } },
    orderBy: { codigo: "asc" },
  });

  const afectadas = todas.filter(
    (f) =>
      /^1\.000\s/.test(f.cantidadUnidad) &&
      Math.abs(f.cantidad - 1) < 1e-9 &&
      Math.abs(f.precioUnitario - f.precioConIva) <= TOL_PRECIO
  );
  const yaCorregidas = todas.filter((f) => !afectadas.includes(f));

  if (afectadas.length > ESPERADAS) {
    throw new Error(`Se esperaban ${ESPERADAS} filas con el patrón y hay ${afectadas.length} — revisar antes de seguir`);
  }

  // ── Verificación de uso (aborta si alguna fila está en uso) ──
  const ids = afectadas.map((f) => f.id);
  const conId = await db.materialAPU.count({ where: { precioMTOPId: { in: ids } } });
  const descripcionesFilas = afectadas.map((f) => ({ codigo: f.codigo, d: f.descripcion.toLowerCase() }));
  const usos: string[] = [];
  const mats = await db.materialAPUEstandar.findMany({ select: { descripcion: true } });
  const matsProy = await db.materialAPU.findMany({ select: { descripcion: true } });
  for (const [origen, lista] of [["Biblioteca (MaterialAPUEstandar)", mats], ["proyectos (MaterialAPU)", matsProy]] as const) {
    const vistas = new Set<string>();
    for (const m of lista) {
      const d = m.descripcion?.trim().toLowerCase();
      if (!d || vistas.has(d)) continue;
      vistas.add(d);
      for (const f of descripcionesFilas) if (f.d.includes(d)) usos.push(`${origen}: «${m.descripcion}» está contenida en ${f.codigo}`);
    }
  }
  console.log("── Uso de las filas ──");
  console.log(`  MaterialAPU con precioMTOPId en estas filas: ${conId}`);
  console.log(`  Descripciones de materiales (Biblioteca ${mats.length} + proyectos ${matsProy.length}) contenidas en alguna: ${usos.length}`);
  for (const u of usos) console.log(`    ⚠ ${u}`);
  if (conId > 0 || usos.length > 0) {
    throw new Error("Alguna de las filas está en uso por un APU o un proyecto — no se escribe nada; decidir a mano");
  }
  console.log("  ✔ Ninguna está en uso: corregirlas no cambia ningún APU ni proyecto.\n");

  // ── Tabla ──
  console.log(`── Filas con el patrón (${afectadas.length} de ${ESPERADAS} esperadas) ──`);
  const plan = afectadas.map((f) => {
    const nuevo = redondear2(f.precioConIva / 1000);
    return { f, nuevo, exacto: f.precioConIva / 1000 };
  });
  console.log("  cód  unidad  cantidad        precioConIva   precioUnitario ANTES → DESPUÉS      descripción");
  for (const { f, nuevo, exacto } of plan) {
    console.log(
      `  ${f.codigo.padEnd(4)} ${f.unidad.padEnd(6)}  ${String(f.cantidad).padStart(4)} → 1000  ${money(f.precioConIva).padStart(14)}   ${money(f.precioUnitario).padStart(12)} → ${money(nuevo).padStart(9)}` +
        `${Math.abs(nuevo - exacto) > 1e-9 ? ` (exacto ${exacto.toFixed(4)})` : ""}   ${f.descripcion}`
    );
  }
  if (yaCorregidas.length > 0) {
    console.log("\n── Ya con '1.000' pero fuera del patrón (no se tocan) ──");
    for (const f of yaCorregidas) console.log(`  ${f.codigo} «${f.descripcion}» — cantidad ${f.cantidad}, precioUnitario ${money(f.precioUnitario)}, precioConIva ${money(f.precioConIva)}`);
  }

  console.log("\n── Qué se escribe en cada fila ──");
  console.log("  cantidad 1 → 1000 · precioUnitario = precioConIva / 1000 (2 decimales) · precioAnterior = precioUnitario viejo");
  console.log(`  notaProcedencia = «${NOTA} Precio unitario = precio de lista / 1.000.» (hoy vacía en las 20)`);
  console.log("  NO cambian: precioConIva, cantidadUnidad, unidad, proveedor, lista, fecha, APU, proyectos ni ninguna otra fila.");

  if (aplicar && plan.length > 0) {
    await db.$transaction(
      async (tx) => {
        for (const { f, nuevo } of plan) {
          const r = await tx.precioMTOP.updateMany({
            where: { id: f.id, cantidad: f.cantidad, precioUnitario: f.precioUnitario },
            data: {
              cantidad: 1000,
              precioUnitario: nuevo,
              precioAnterior: f.precioUnitario,
              notaProcedencia: f.notaProcedencia ? `${f.notaProcedencia} ${NOTA}` : `${NOTA} Precio unitario = precio de lista / 1.000.`,
            },
          });
          if (r.count !== 1) throw new Error(`${f.codigo}: la fila cambió mientras tanto — se aborta sin escribir`);
        }
      },
      { timeout: 120_000 }
    );
  }

  console.log(`\nRESUMEN: filas a corregir: ${plan.length}${yaCorregidas.length ? ` · ya corregidas / fuera del patrón: ${yaCorregidas.length}` : ""}`);
  console.log(aplicar ? "APLICADO." : "DRY RUN: no se escribió nada. Para aplicar: --apply (con la aprobación de Luis).");
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
