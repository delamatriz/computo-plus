// Corrige un bug de matching: el material "Cemento Portland" (genérico, sin
// especificar color) matcheaba por `contains` contra "Cemento Portland
// BLANCO (en bolsa)" ($54,44/kg) en vez del cemento gris estructural común,
// porque ambas descripciones de MTOP comparten el substring "Cemento
// Portland" y el matching no desambiguaba.
//
// Confirmado con el usuario: el cemento de referencia para obra privada
// (arquitecto independiente / constructora mediana que compra en bolsa con
// reparto, no a granel en planta) es "Cemento portland gris (Montevideo, en
// bolsa, en obra)" — código MTOP 141, $25,70/kg.
//
// Fix: renombrar la descripción del material de "Cemento Portland" al texto
// exacto de ese ítem de MTOP. Esto además de corregir el precio actual,
// hace que el propio matching por `contains` sea inequívoco para siempre
// (ya no hace falta parchear la lógica de matching) — sigue el mismo
// patrón que ya usan los materiales hermanos en los mismos APU (ej. "Arena
// gruesa (en obra)", "Balasto natural (en obra)"), que sí llevan el nombre
// completo de MTOP en vez de una versión genérica.
//
// Excluidos a propósito — 7 subrubros de terminación "lustrado"/"alisado"/
// "monolítica" (ej. "REVOQUE ARENA Y PORTLAND LUSTRADO") donde el cemento
// BLANCO puede ser una elección de obra legítima (terminación pulida más
// clara), no un bug. Quedan con "Cemento Portland" sin tocar, para que se
// revisen a mano.
//
// Modo dry-run (default): solo reporta. Modo aplicar: agregar --apply.
//
// Ejecutar:
//   npx tsx scripts/fix-cemento-portland-generico.ts              (dry-run)
//   npx tsx scripts/fix-cemento-portland-generico.ts --apply       (escribe en DB)

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

const modoAplicar = process.argv.includes("--apply");

const DESCRIPCION_NUEVA = "Cemento Portland gris (Montevideo, en bolsa, en obra)";
const PRECIO_GRIS = 25.70;

// Subrubros de terminación pulida/lustrada — excluidos de este fix porque
// el cemento blanco puede ser una elección de obra deliberada, no un bug.
const CODIGOS_EXCLUIDOS_LUSTRADO = [
  "6.2.6",  // REVOQUE ARENA Y PORTLAND LUSTRADO
  "6.2.16", // ARENA Y PORTLAND LUSTRADO PARA TANQUES DE AGUA
  "6.4.14", // UMBRAL DE PORTLAND LUSTRADO ancho=30cm
  "6.4.20", // ESCALÓN DE ARENA Y PORTLAND LUSTRADO h=7cm
  "6.3.4",  // ALISADO DE ARENA Y PORTLAND e=2cm
  "6.6.2",  // CAPA ALISADO DE ARENA Y PÓRTLAND 2cm
  "6.4.8",  // BALDOSA DE MONOLÍTICA 40x40cm
];

async function main() {
  console.log(modoAplicar ? "=== MODO APLICAR — se va a escribir en la base ===" : "=== MODO DRY-RUN — no se escribe nada ===");

  // 1 — Catálogo (MaterialAPUEstandar)
  const materialesEstandar = await p.materialAPUEstandar.findMany({
    where: { descripcion: { equals: "Cemento Portland", mode: "insensitive" } },
    include: { apu: { include: { subrubro: true } } },
  });

  const aCorregir = materialesEstandar.filter((m) => !CODIGOS_EXCLUIDOS_LUSTRADO.includes(m.apu.subrubro.codigo));
  const excluidos = materialesEstandar.filter((m) => CODIGOS_EXCLUIDOS_LUSTRADO.includes(m.apu.subrubro.codigo));

  console.log(`\nMaterialAPUEstandar con "Cemento Portland" genérico: ${materialesEstandar.length}`);
  console.log(`→ A corregir (renombrar a cemento gris): ${aCorregir.length}`);
  console.log(`→ Excluidos (terminación lustrada/alisada, revisar a mano): ${excluidos.length}\n`);

  for (const m of aCorregir) {
    console.log(`${modoAplicar ? "✓" : "→"} [${m.apu.subrubro.capitulo}] ${m.apu.subrubro.codigo} — "${m.apu.subrubro.descripcion}"`);
    if (modoAplicar) {
      await p.materialAPUEstandar.update({ where: { id: m.id }, data: { descripcion: DESCRIPCION_NUEVA } });
    }
  }

  console.log("\n── Excluidos (sin tocar — revisar a mano) ──");
  for (const m of excluidos) {
    console.log(`⚠ [${m.apu.subrubro.capitulo}] ${m.apu.subrubro.codigo} — "${m.apu.subrubro.descripcion}"`);
  }

  // 2 — Rubros reales ya clonados en proyectos (MaterialAPU)
  const materialesReales = await p.materialAPU.findMany({
    where: { descripcion: { equals: "Cemento Portland", mode: "insensitive" } },
    include: { apu: { include: { rubro: { include: { capitulo: { include: { proyecto: true } } } } } } },
  });

  console.log(`\nMaterialAPU reales (proyectos) con "Cemento Portland" genérico: ${materialesReales.length}`);
  for (const m of materialesReales) {
    console.log(
      `${modoAplicar ? "✓" : "→"} [${m.apu.rubro.capitulo.proyecto.nombre} / ${m.apu.rubro.capitulo.nombre}] "${m.apu.rubro.descripcion}" — ` +
      `precioUnit $${m.precioUnit} → $${PRECIO_GRIS}`
    );
    if (modoAplicar) {
      await p.materialAPU.update({
        where: { id: m.id },
        data: { descripcion: DESCRIPCION_NUEVA, precioUnit: PRECIO_GRIS },
      });
    }
  }

  console.log("\n── Resumen ──");
  console.log(`Catálogo corregido: ${aCorregir.length}`);
  console.log(`Catálogo excluido (lustrado/alisado — revisar a mano): ${excluidos.length}`);
  console.log(`Rubros reales corregidos: ${materialesReales.length}`);

  if (!modoAplicar) {
    console.log("\nEsto fue un dry-run — no se escribió nada en la base.");
    console.log("Volvé a correr con --apply para aplicar los cambios.");
  }

  await p.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
