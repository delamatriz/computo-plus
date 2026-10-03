// Biblioteca — procedencia del rendimiento y de la mano de obra de las dos
// imprimaciones asfálticas nuevas (9.2.9 al agua, 9.2.10 solvente).
//
// Por qué: el script reemplazar-imprimacion-cepol-2026-10.ts dejó el
// rendimiento del solvente (0,4 l/m²) como "provisorio, sin dato del
// fabricante". Luis confirmó que ese rendimiento y la mano de obra de
// 40 m²/jornal son los del rubro Cepol del rubrado SAU 2022 (9.2.2): no son
// una estimación suelta. Lo que SIGUE pendiente es el PRECIO del material
// (Mercadolibre). El rendimiento del material al agua (0,5 kg/m²) sigue siendo
// el del fabricante.
//
// SOLO texto. No toca ningún precio, rendimiento, jornal, utilidad ni APU, ni
// ningún proyecto (los rubros clonados no tienen vínculo vivo con la
// Biblioteca). Qué escribe:
//  1. PrecioMTOP MAT-IMP-ASFALTICA-SOLVENTE (proveedor null): en
//     notaProcedencia reemplaza la frase "Rendimiento de 0,4 l/m2 provisorio,
//     sin dato del fabricante: confirmar con la ficha técnica." por la
//     procedencia confirmada, y aclara que el precio sigue pendiente.
//  2. SubrubroEstandar 9.2.10: notasInternas (tooltip de "Ver subrubros
//     típicos"; no se imprime al cliente).
//  3. SubrubroEstandar 9.2.9: notasInternas con la procedencia de la mano de
//     obra (el rendimiento del material al agua queda como "del fabricante").
//
// Seguridad: antes de escribir verifica que el APU de 9.2.10 tenga EXACTAMENTE
// 0,4 l/m² y 40 m²/jornal, que 9.2.9 tenga 40 m²/jornal y 0,5 kg/m², y que el
// APU de Cepol (9.2.2) tenga 0,4 l/m² y 40 m²/jornal — es decir, que lo que
// se anota es verdad. Si algo no coincide, aborta sin escribir.
//
// Idempotente: si el texto nuevo ya está, no hace nada (segunda corrida = 0
// cambios). No pisa una nota que no sea la esperada: si 9.2.9 o 9.2.10 ya
// tienen otra notasInternas, o la nota del material no contiene ni la frase
// vieja ni la nueva, lo informa y NO la toca.
//
// Ejecutar (dry-run): npx tsx scripts/anotar-procedencia-imprimacion-2026-10.ts
// Ejecutar (real):     npx tsx scripts/anotar-procedencia-imprimacion-2026-10.ts --apply

import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const TOL = 1e-9;
const igual = (a: number, b: number) => Math.abs(a - b) < TOL;

const CODIGO_MATERIAL_SOLVENTE = "MAT-IMP-ASFALTICA-SOLVENTE";

// Frase que dejó el script anterior en la nota del material.
const FRASE_VIEJA = "Rendimiento de 0,4 l/m2 provisorio, sin dato del fabricante: confirmar con la ficha técnica.";
const FRASE_NUEVA =
  "Rendimiento de 0,4 l/m2 y mano de obra de 40 m2/jornal: son los del rubro Cepol (rubrado SAU 2022, 9.2.2), confirmados por Luis. " +
  "Lo pendiente es el precio del material (Mercadolibre).";

const NOTA_9_2_10 =
  "Rendimiento de 0,4 l/m2 y mano de obra de 40 m2/jornal: son los del rubro Cepol (rubrado SAU 2022, 9.2.2), confirmados por Luis. " +
  "El precio del material sigue pendiente de verificar (Mercadolibre).";

const NOTA_9_2_9 =
  "La mano de obra de 40 m2/jornal es la del rubro Cepol (rubrado SAU 2022, 9.2.2), confirmada por Luis. " +
  "El rendimiento del material (0,5 kg/m2) es el del fabricante, no el de Cepol.";

const money = (n: number) => n.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Cambio = { donde: string; antes: string | null; despues: string };

async function apuDe(codigo: string) {
  const s = await db.subrubroEstandar.findUnique({
    where: { codigo },
    include: { apuEstandar: { include: { materiales: true, manoObra: true, equipos: true } } },
  });
  if (!s?.apuEstandar) throw new Error(`No se encontró el subrubro ${codigo} con APU`);
  return { sub: s, apu: s.apuEstandar };
}

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);

  // ── Verificación: lo que se va a anotar es verdad ──
  const cepol = await apuDe("9.2.2");
  const solv = await apuDe("9.2.10");
  const agua = await apuDe("9.2.9");
  const lineaMO = (a: typeof cepol) => {
    if (a.apu.manoObra.length !== 1) throw new Error(`${a.sub.codigo}: se esperaba 1 línea de mano de obra, hay ${a.apu.manoObra.length}`);
    return a.apu.manoObra[0];
  };
  const lineaMat = (a: typeof cepol) => {
    if (a.apu.materiales.length !== 1) throw new Error(`${a.sub.codigo}: se esperaba 1 material, hay ${a.apu.materiales.length}`);
    return a.apu.materiales[0];
  };
  const moCepol = lineaMO(cepol), matCepol = lineaMat(cepol);
  const moSolv = lineaMO(solv), matSolv = lineaMat(solv);
  const moAgua = lineaMO(agua), matAgua = lineaMat(agua);

  console.log("── Verificación contra la Biblioteca (solo lectura) ──");
  console.log(`  9.2.2  Cepol (activo=${cepol.sub.activo}): ${matCepol.rendimiento} ${matCepol.unidad}/M2 · ${moCepol.categoria} ${moCepol.rendimiento} M2/jornal (${moCepol.jornadaHs} hs)`);
  console.log(`  9.2.10 solvente:                ${matSolv.rendimiento} ${matSolv.unidad}/M2 · ${moSolv.categoria} ${moSolv.rendimiento} M2/jornal (${moSolv.jornadaHs} hs)  — precioUY $${money(solv.sub.precioUY)}`);
  console.log(`  9.2.9  al agua:                 ${matAgua.rendimiento} ${matAgua.unidad}/M2 · ${moAgua.categoria} ${moAgua.rendimiento} M2/jornal (${moAgua.jornadaHs} hs)  — precioUY $${money(agua.sub.precioUY)}`);
  const errores: string[] = [];
  if (!igual(matSolv.rendimiento, 0.4) || matSolv.unidad !== "l") errores.push("9.2.10 no tiene 0,4 l/m2");
  if (!igual(moSolv.rendimiento, 40)) errores.push("9.2.10 no tiene 40 m2/jornal");
  if (!igual(matCepol.rendimiento, 0.4)) errores.push("Cepol (9.2.2) no tiene 0,4 l/m2");
  if (!igual(moCepol.rendimiento, 40)) errores.push("Cepol (9.2.2) no tiene 40 m2/jornal");
  if (!igual(moAgua.rendimiento, 40)) errores.push("9.2.9 no tiene 40 m2/jornal");
  if (!igual(matAgua.rendimiento, 0.5) || matAgua.unidad !== "kg") errores.push("9.2.9 no tiene 0,5 kg/m2");
  if (errores.length) throw new Error("Lo que se iba a anotar no coincide con la Biblioteca — no se escribe nada: " + errores.join("; "));
  console.log("  ✔ Coincide: la mano de obra y el rendimiento del solvente son idénticos a los de Cepol; el del agua es 0,5 kg/m2 (fabricante).\n");

  const cambios: Cambio[] = [];
  const avisos: string[] = [];

  // ── 1. Nota del material solvente ──
  const mat = await db.precioMTOP.findFirst({ where: { codigo: CODIGO_MATERIAL_SOLVENTE, proveedor: null } });
  if (!mat) throw new Error(`${CODIGO_MATERIAL_SOLVENTE} no existe en PrecioMTOP`);
  const notaMat = mat.notaProcedencia ?? "";
  let notaMatNueva: string | null = null;
  if (notaMat.includes(FRASE_NUEVA)) {
    console.log(`  = PrecioMTOP ${mat.codigo}: la nota ya tiene la procedencia confirmada.`);
  } else if (notaMat.includes(FRASE_VIEJA)) {
    notaMatNueva = notaMat.replace(FRASE_VIEJA, FRASE_NUEVA);
    cambios.push({ donde: `PrecioMTOP ${mat.codigo} · notaProcedencia`, antes: notaMat, despues: notaMatNueva });
  } else {
    avisos.push(`PrecioMTOP ${mat.codigo}: la nota no contiene la frase esperada ni la nueva — NO se toca (revisar a mano). Nota actual: ${notaMat}`);
  }

  // ── 2 y 3. notasInternas de 9.2.10 y 9.2.9 ──
  const notas: { sub: typeof solv.sub; nueva: string }[] = [
    { sub: solv.sub, nueva: NOTA_9_2_10 },
    { sub: agua.sub, nueva: NOTA_9_2_9 },
  ];
  const porEscribir: { id: string; nueva: string }[] = [];
  for (const { sub, nueva } of notas) {
    if (sub.notasInternas === nueva) {
      console.log(`  = SubrubroEstandar ${sub.codigo}: notasInternas ya tiene el texto.`);
    } else if (sub.notasInternas == null || sub.notasInternas.trim() === "") {
      cambios.push({ donde: `SubrubroEstandar ${sub.codigo} («${sub.descripcion}») · notasInternas`, antes: sub.notasInternas, despues: nueva });
      porEscribir.push({ id: sub.id, nueva });
    } else {
      avisos.push(`SubrubroEstandar ${sub.codigo}: ya tiene otra notasInternas — NO se pisa (decide Luis). Actual: ${sub.notasInternas}`);
    }
  }

  // ── Informe ──
  console.log("\n── Cambios ──");
  if (cambios.length === 0) console.log("  (ninguno)");
  for (const c of cambios) {
    console.log(`\n  ${c.donde}`);
    console.log(`    ANTES:   ${c.antes ?? "(vacío)"}`);
    console.log(`    DESPUÉS: ${c.despues}`);
  }
  for (const a of avisos) console.log(`\n  ⚠ ${a}`);

  console.log("\n── No se toca ──");
  console.log("  Precios (PrecioMTOP.precioUnitario/precioConIva, SubrubroEstandar.precioUY), rendimientos, jornales, utilidad, GG, APU y proyectos.");

  if (aplicar && cambios.length > 0) {
    await db.$transaction(
      async (tx) => {
        if (notaMatNueva !== null) {
          // El where lleva la nota leída: si alguien la editó entre la lectura y la escritura, no se pisa.
          const r = await tx.precioMTOP.updateMany({ where: { id: mat.id, notaProcedencia: mat.notaProcedencia }, data: { notaProcedencia: notaMatNueva } });
          if (r.count !== 1) throw new Error(`${mat.codigo}: la nota cambió mientras tanto — se aborta sin escribir`);
        }
        for (const p of porEscribir) {
          const r = await tx.subrubroEstandar.updateMany({ where: { id: p.id, notasInternas: null }, data: { notasInternas: p.nueva } });
          if (r.count !== 1) throw new Error(`SubrubroEstandar ${p.id}: notasInternas cambió mientras tanto — se aborta sin escribir`);
        }
      },
      { timeout: 120_000 }
    );
  }

  console.log(`\nRESUMEN: ${cambios.length} cambio(s) de texto${avisos.length ? ` · ${avisos.length} aviso(s)` : ""}.`);
  console.log(aplicar ? "APLICADO." : "DRY RUN: no se escribió nada. Para aplicar: --apply (con la aprobación de Luis).");
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
