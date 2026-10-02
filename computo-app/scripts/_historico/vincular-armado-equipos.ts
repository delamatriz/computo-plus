// Vincula las líneas de mano de obra de armado/desarme de Grúa torre y Torre
// de andamio a su línea de Equipo correspondiente (equipoRelacionadoId), para
// que el modo de costeo (Alquilado/Propio) pueda incluirlas o excluirlas
// automáticamente del Costo Directo. Ver corregir-equipos-altura-instalacion.ts
// para el origen de estas líneas de armado.
//
// Alcance:
//   1. Biblioteca estándar (impl-eq-003 Torre de andamio, impl-eq-004 Grúa
//      torre) — para que las próximas clonaciones ya vengan vinculadas.
//   2. Rubros reales ya clonados en producción antes de esta feature — se
//      detectan por tener una única línea de Equipo cuya descripción
//      coincide con "torre de andamio" o "grúa torre" en su APU.
//
// Regla de qué mano de obra se vincula:
//   - Torre de andamio: TODAS sus líneas de mano de obra son de armado
//     (no tiene operación diaria — ver corregir-equipos-altura-instalacion.ts).
//   - Grúa torre: todas las líneas EXCEPTO "Oficial maquinista" (esa es la
//     operación mensual, no el armado puntual).
//
// Modo dry-run (default): solo reporta. Modo aplicar: agregar --apply.
//
// Ejecutar:
//   npx tsx scripts/vincular-armado-equipos.ts              (dry-run)
//   npx tsx scripts/vincular-armado-equipos.ts --apply       (escribe en DB)

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

const modoAplicar = process.argv.includes("--apply");

function esArmadoGruaTorre(categoria: string): boolean {
  return !categoria.trim().toLowerCase().includes("maquinista");
}

async function main() {
  console.log(modoAplicar ? "=== MODO APLICAR — se va a escribir en la base ===" : "=== MODO DRY-RUN — no se escribe nada ===");
  let vinculosEstandar = 0;
  let vinculosReales = 0;

  // ══════════════════ 1 — Biblioteca estándar ══════════════════
  for (const { codigo, filtro, nombre } of [
    { codigo: "impl-eq-003", nombre: "Torre de andamio", filtro: () => true },
    { codigo: "impl-eq-004", nombre: "Grúa torre", filtro: esArmadoGruaTorre },
  ]) {
    const sub = await p.subrubroEstandar.findFirst({
      where: { codigo },
      include: { apuEstandar: { include: { equipos: true, manoObra: true } } },
    });
    const apu = sub?.apuEstandar;
    if (!apu) { console.log(`⊘ ${codigo} — no encontrado en la biblioteca estándar`); continue; }
    if (apu.equipos.length !== 1) { console.log(`⊘ ${codigo} — se esperaba 1 equipo, hay ${apu.equipos.length}, se omite`); continue; }

    const equipo = apu.equipos[0];
    const lineasALinkear = apu.manoObra.filter((mo) => filtro(mo.categoria) && !mo.equipoRelacionadoId);
    if (lineasALinkear.length === 0) {
      console.log(`⊘ ${codigo} (${nombre}) — ya está todo vinculado o no hay líneas para vincular`);
      continue;
    }
    console.log(`${modoAplicar ? "✓" : "→"} [estándar] ${codigo} — ${nombre}: vincular ${lineasALinkear.length} línea(s) de MO (${lineasALinkear.map((m) => m.categoria).join(", ")}) → equipo "${equipo.descripcion}"`);
    if (modoAplicar) {
      for (const mo of lineasALinkear) {
        await p.manoObraAPUEstandar.update({ where: { id: mo.id }, data: { equipoRelacionadoId: equipo.id } });
      }
    }
    vinculosEstandar += lineasALinkear.length;
  }

  // ══════════════════ 2 — Rubros reales ya clonados en producción ══════════════════
  for (const { patron, nombre, filtro } of [
    { patron: "torre de andamio", nombre: "Torre de andamio", filtro: () => true },
    { patron: "grúa torre", nombre: "Grúa torre", filtro: esArmadoGruaTorre },
  ]) {
    const equiposCoincidentes = await p.equipoAPU.findMany({
      where: { descripcion: { contains: patron, mode: "insensitive" } },
      include: { apu: { include: { equipos: true, manoObra: true, rubro: true } } },
    });

    for (const equipo of equiposCoincidentes) {
      const apu = equipo.apu;
      if (apu.equipos.length !== 1) {
        console.log(`⊘ [real] rubro "${apu.rubro.descripcion}" (${apu.rubro.codigo}) — APU tiene ${apu.equipos.length} equipos, no solo "${nombre}", se omite por ambigüedad`);
        continue;
      }
      const lineasALinkear = apu.manoObra.filter((mo) => filtro(mo.categoria) && !mo.equipoRelacionadoId);
      if (lineasALinkear.length === 0) continue;

      console.log(`${modoAplicar ? "✓" : "→"} [real] rubro "${apu.rubro.descripcion}" (${apu.rubro.codigo}) — ${nombre}: vincular ${lineasALinkear.length} línea(s) de MO (${lineasALinkear.map((m) => m.categoria).join(", ")})`);
      if (modoAplicar) {
        for (const mo of lineasALinkear) {
          await p.manoObraAPU.update({ where: { id: mo.id }, data: { equipoRelacionadoId: equipo.id } });
        }
      }
      vinculosReales += lineasALinkear.length;
    }
  }

  console.log("\n── Resumen ──");
  console.log(`Líneas vinculadas en biblioteca estándar: ${vinculosEstandar}`);
  console.log(`Líneas vinculadas en rubros reales:       ${vinculosReales}`);
  if (!modoAplicar) {
    console.log("\nEsto fue un dry-run — no se escribió nada. Revisá el detalle y volvé a correr con --apply.");
  }

  await p.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
