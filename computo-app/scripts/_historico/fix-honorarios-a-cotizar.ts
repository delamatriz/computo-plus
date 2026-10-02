// FIX puntual — badge "A cotizar" para los 12 subrubros de Honorarios
// profesionales (admin-001 a admin-012, capítulo "Gastos Administrativos
// y Conexiones"). Encontrado en la auditoría completa de la biblioteca:
// estos 12 no matchean contra ningún PrecioMTOP (correcto — un honorario
// no es un material de catálogo), pero a diferencia de los otros 20
// materiales con el mismo problema, no tienen ningún PrecioMTOP con
// motivoVerificacion="sin_precio_referencia" que los cubra — resuelven
// hoy a precioUnit: $0 silencioso, sin el badge "A cotizar".
//
// Dónde vive cada cosa (confirmado antes de escribir esto):
// - El TEXTO que menciona "SAU" vive en DOS lugares: SubrubroEstandar.
//   descripcion (título del subrubro, distinto por cada uno de los 12) y
//   MaterialAPUEstandar.descripcion (el material "Honorario profesional
//   — a completar manualmente según arancel SAU vigente", literalmente
//   idéntico en los 12 — una fila por subrubro, mismo texto).
// - motivoVerificacion NO vive en MaterialAPUEstandar (ese modelo no
//   tiene ese campo — ni precioUnit propio siquiera). El badge "A
//   cotizar" se resuelve en vivo contra el PrecioMTOP que matchea por
//   texto (ver /api/subrubros-estandar/[id]/descompuesto y
//   /clonar-apu) — como estos 12 no matchean nada hoy, la única forma
//   de que aparezca el badge es CREAR un PrecioMTOP con
//   motivoVerificacion="sin_precio_referencia" cuya descripción
//   contenga el texto (ya corregido, sin "SAU") del material. Como los
//   12 comparten el mismo texto de material, alcanza con UN solo
//   PrecioMTOP nuevo (mismo patrón que los otros 22 "MAT-PEND-*"
//   existentes — texto de PrecioMTOP igual al texto del material).
//
// Uso:
//   npx tsx scripts/fix-honorarios-a-cotizar.ts            (dry-run, no escribe nada)
//   npx tsx scripts/fix-honorarios-a-cotizar.ts --apply     (aplica los cambios)

import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const TEXTO_MATERIAL_VIEJO = "Honorario profesional — a completar manualmente según arancel SAU vigente";
const TEXTO_MATERIAL_NUEVO = "Honorario profesional — a completar manualmente según arancel profesional vigente";

const CODIGO_PRECIO_MTOP_NUEVO = "MAT-PEND-HONORARIO-PROFESIONAL";

function sacarSAU(texto: string): string {
  return texto.replace(/según arancel SAU vigente/g, "según arancel profesional vigente");
}

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(`Modo: ${aplicar ? "APLICAR" : "DRY RUN (nada se escribe)"}\n`);

  const subrubros = await db.subrubroEstandar.findMany({
    where: { codigo: { in: Array.from({ length: 12 }, (_, i) => `admin-${String(i + 1).padStart(3, "0")}`) } },
    include: { apuEstandar: { include: { materiales: true } } },
    orderBy: { codigo: "asc" },
  });

  if (subrubros.length !== 12) {
    console.log(`⚠ Se esperaban 12 subrubros admin-001..admin-012, se encontraron ${subrubros.length}. Revisar antes de seguir.`);
  }

  console.log("═══════════════════════════════════════════════");
  console.log("1. SubrubroEstandar.descripcion — 12 registros");
  console.log("═══════════════════════════════════════════════\n");
  for (const s of subrubros) {
    const nuevo = sacarSAU(s.descripcion);
    const cambia = nuevo !== s.descripcion;
    console.log(`[${s.codigo}] id=${s.id}`);
    console.log(`  Actual:    "${s.descripcion}"`);
    console.log(`  Propuesto: "${nuevo}"${cambia ? "" : "  (sin cambios — no contenía el texto esperado, revisar)"}\n`);
  }

  console.log("═══════════════════════════════════════════════");
  console.log("2. MaterialAPUEstandar.descripcion — 12 registros (mismo texto compartido)");
  console.log("═══════════════════════════════════════════════\n");
  for (const s of subrubros) {
    for (const m of s.apuEstandar?.materiales ?? []) {
      if (m.descripcion !== TEXTO_MATERIAL_VIEJO) {
        console.log(`[${s.codigo}] material.id=${m.id} — texto INESPERADO, no coincide con lo auditado: "${m.descripcion}" (se deja sin tocar)`);
        continue;
      }
      console.log(`[${s.codigo}] material.id=${m.id}`);
      console.log(`  Actual:    "${m.descripcion}"`);
      console.log(`  Propuesto: "${TEXTO_MATERIAL_NUEVO}"\n`);
    }
  }

  console.log("═══════════════════════════════════════════════");
  console.log("3. PrecioMTOP nuevo (para que resuelva el match y dispare el badge)");
  console.log("═══════════════════════════════════════════════\n");
  const yaExiste = await db.precioMTOP.findUnique({ where: { codigo: CODIGO_PRECIO_MTOP_NUEVO } });
  const propuesto = {
    codigo: CODIGO_PRECIO_MTOP_NUEVO,
    descripcion: TEXTO_MATERIAL_NUEVO,
    cantidadUnidad: "1 gl",
    unidad: "gl",
    cantidad: 1,
    precioConIva: 0,
    precioUnitario: 0,
    numeroLista: 0,
    fechaLista: new Date().toISOString().slice(0, 7),
    requiereVerificacion: true,
    motivoVerificacion: "sin_precio_referencia",
  };
  if (yaExiste) {
    console.log(`Ya existe un PrecioMTOP con código ${CODIGO_PRECIO_MTOP_NUEVO} — se reusaría / actualizaría en vez de crear uno nuevo:`);
    console.log(JSON.stringify(yaExiste, null, 2));
  } else {
    console.log("No existe — se crearía:");
    console.log(JSON.stringify(propuesto, null, 2));
  }

  if (!aplicar) {
    console.log("\nDry-run — nada se escribió. Correr con --apply para aplicar estos cambios.");
    await db.$disconnect();
    return;
  }

  console.log("\n── Aplicando ──\n");

  for (const s of subrubros) {
    const nuevaDescSubrubro = sacarSAU(s.descripcion);
    if (nuevaDescSubrubro !== s.descripcion) {
      await db.subrubroEstandar.update({ where: { id: s.id }, data: { descripcion: nuevaDescSubrubro } });
      console.log(`✓ [${s.codigo}] SubrubroEstandar.descripcion actualizado`);
    }
    for (const m of s.apuEstandar?.materiales ?? []) {
      if (m.descripcion === TEXTO_MATERIAL_VIEJO) {
        await db.materialAPUEstandar.update({ where: { id: m.id }, data: { descripcion: TEXTO_MATERIAL_NUEVO } });
        console.log(`✓ [${s.codigo}] MaterialAPUEstandar.descripcion actualizado`);
      }
    }
  }

  if (yaExiste) {
    await db.precioMTOP.update({ where: { codigo: CODIGO_PRECIO_MTOP_NUEVO }, data: propuesto });
    console.log(`✓ PrecioMTOP ${CODIGO_PRECIO_MTOP_NUEVO} actualizado`);
  } else {
    await db.precioMTOP.create({ data: propuesto });
    console.log(`✓ PrecioMTOP ${CODIGO_PRECIO_MTOP_NUEVO} creado`);
  }

  console.log("\nAplicado.");
  await db.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await db.$disconnect();
  process.exit(1);
});
