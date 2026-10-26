// Biblioteca — corrige SubrubroEstandar.origen para que "sau_ago2022" quede
// SOLO en los rubros que de verdad conservan el precio de la lista SAU de
// agosto 2022.
//
// Por qué: "sau_ago2022" es el @default de SubrubroEstandar.origen (y
// "2022-08" el de fechaBase). Los scripts de carga de 2026 crearon rubros sin
// completar esos campos, y los de recálculo pisaron precioUY con el precio del
// APU sin tocar el origen. Resultado (relevado el 2026-10-26): 249 rubros
// activos con origen "sau_ago2022", de los que solo 8 tienen el precio SAU
// original. /rubros dejó de mostrar la sigla SAU hasta que esto se corrija.
//
// Qué escribe (solo SubrubroEstandar.origen de rubros activos con origen
// "sau_ago2022"):
//  - SAU real → queda "sau_ago2022" (no se toca): la descripción está en la
//    lista SAU (prisma/seed-subrubros-sau-data.ts) Y precioUY es exactamente
//    el precio SAU de esa lista.
//  - Descripción de la lista SAU pero precio distinto (recalculado desde el
//    APU) → "sau_ago2022_recalculado". Incluye las carpinterías que se pasaron
//    de UNI a m² (descripción con "(por m²)").
//  - Descripción que no está en la lista SAU (cargado después por script, con
//    el origen por defecto) → "carga_script_2026".
//
// No toca precioUY, fechaBase, APU, materiales ni ningún proyecto. fechaBase
// queda como está: en varios rubros también es el "2022-08" por defecto, pero
// la fecha real no está registrada en ningún lado (decide Luis aparte).
// Ninguna parte de la app lee el valor de SubrubroEstandar.origen.
//
// Seguridad: aborta sin escribir si los SAU reales no son exactamente los 8
// códigos esperados (CODIGOS_SAU_REALES_ESPERADOS). Cada update lleva el
// origen leído en el where: si cambió mientras tanto, aborta la transacción.
// Con --apply imprime antes un respaldo JSON (id, codigo, origen anterior).
//
// Idempotente: una segunda corrida encuentra 0 cambios (los ya corregidos ya
// no tienen origen "sau_ago2022").
//
// Ejecutar (dry-run): npx tsx scripts/corregir-origen-sau-2026-10.ts
// Ejecutar (real):     npx tsx scripts/corregir-origen-sau-2026-10.ts --apply

import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { SUBRUBROS_SAU } from "../prisma/seed-subrubros-sau-data";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const ORIGEN_SAU = "sau_ago2022";
const ORIGEN_SAU_RECALCULADO = "sau_ago2022_recalculado";
const ORIGEN_CARGA_SCRIPT = "carga_script_2026";

// Relevados el 2026-10-26: espejos, cortinas de enrollar, losas stalton y espuma plast.
const CODIGOS_SAU_REALES_ESPERADOS = ["16.3.1", "16.3.2", "21.1", "21.2", "6.2.1", "6.2.2", "6.2.3", "9.2.6"];

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
// Para reconocer rubros de la lista SAU que después se pasaron de UNI a m²:
// la descripción ganó el sufijo "(por m²)" y en uno se corrigió la errata
// "1.10mm" → "1.10m" (Reja). Solo se usa para clasificar, nunca para decidir
// si un rubro es SAU real (eso exige además el precio SAU exacto).
const normLista = (s: string) =>
  norm(s).replace(/\s*\(por m[²2]\)\s*$/, "").replace(/mm\b/g, "m");
const mismoPrecio = (a: number, b: number) => Math.abs(a - b) < 0.005;

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);

  const precioSauPorDescripcion = new Map(SUBRUBROS_SAU.map((s) => [norm(s.descripcion), s.precioUY]));
  const descripcionesLista = new Set(SUBRUBROS_SAU.map((s) => normLista(s.descripcion)));

  const rubros = await db.subrubroEstandar.findMany({
    where: { activo: true, origen: ORIGEN_SAU },
    select: { id: true, codigo: true, descripcion: true, precioUY: true, fechaBase: true, origen: true },
    orderBy: { codigo: "asc" },
  });

  const reales: typeof rubros = [];
  const cambios: { id: string; codigo: string; descripcion: string; antes: string; despues: string; fechaBase: string }[] = [];
  for (const r of rubros) {
    const precioSau = precioSauPorDescripcion.get(norm(r.descripcion));
    if (precioSau !== undefined && mismoPrecio(precioSau, r.precioUY)) {
      reales.push(r);
      continue;
    }
    cambios.push({
      id: r.id,
      codigo: r.codigo,
      descripcion: r.descripcion,
      antes: r.origen,
      despues: descripcionesLista.has(normLista(r.descripcion)) ? ORIGEN_SAU_RECALCULADO : ORIGEN_CARGA_SCRIPT,
      fechaBase: r.fechaBase,
    });
  }

  console.log(`── Rubros activos con origen "${ORIGEN_SAU}": ${rubros.length} ──`);
  console.log(`\n  Quedan como SAU real (precio SAU original): ${reales.length}`);
  for (const r of reales) console.log(`    = ${r.codigo} | ${r.descripcion} | $${r.precioUY} | fechaBase ${r.fechaBase}`);

  const codigosReales = reales.map((r) => r.codigo).sort();
  const esperados = [...CODIGOS_SAU_REALES_ESPERADOS].sort();
  if (codigosReales.join(",") !== esperados.join(",")) {
    throw new Error(
      `Los SAU reales no son los ${esperados.length} esperados — no se escribe nada. Encontrados: ${codigosReales.join(", ") || "(ninguno)"}`
    );
  }
  console.log(`  ✔ Son exactamente los ${esperados.length} esperados.`);

  const recalculados = cambios.filter((c) => c.despues === ORIGEN_SAU_RECALCULADO);
  const cargados = cambios.filter((c) => c.despues === ORIGEN_CARGA_SCRIPT);
  console.log(`\n  → "${ORIGEN_SAU_RECALCULADO}" (de la lista SAU, precio recalculado desde el APU): ${recalculados.length}`);
  console.log(`  → "${ORIGEN_CARGA_SCRIPT}" (no está en la lista SAU, cargado después por script): ${cargados.length}`);
  for (const c of cargados) console.log(`    ${c.codigo} | ${c.descripcion} | fechaBase ${c.fechaBase}`);

  const fechaDefault = cambios.filter((c) => c.fechaBase === "2022-08").length;
  console.log(`\n── No se toca ──`);
  console.log(`  precioUY, fechaBase, APU, materiales y proyectos.`);
  console.log(`  Ojo: ${fechaDefault} de los ${cambios.length} que cambian de origen siguen con fechaBase "2022-08" (el valor por defecto) — la fecha real no está registrada.`);

  if (aplicar && cambios.length > 0) {
    console.log("\n── Respaldo (origen anterior) ──");
    console.log(JSON.stringify(cambios.map(({ id, codigo, antes }) => ({ id, codigo, origen: antes }))));
    await db.$transaction(
      async (tx) => {
        for (const c of cambios) {
          const r = await tx.subrubroEstandar.updateMany({ where: { id: c.id, origen: c.antes }, data: { origen: c.despues } });
          if (r.count !== 1) throw new Error(`${c.codigo}: el origen cambió mientras tanto — se aborta sin escribir`);
        }
      },
      { timeout: 120_000, maxWait: 10_000 }
    );
  }

  console.log(`\nRESUMEN: ${cambios.length} cambio(s) de origen · ${reales.length} rubros quedan como SAU real.`);
  console.log(aplicar ? "APLICADO." : "DRY RUN: no se escribió nada. Para aplicar: --apply (con la aprobación de Luis).");
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
