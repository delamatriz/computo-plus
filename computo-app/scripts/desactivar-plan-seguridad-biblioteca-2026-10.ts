// Biblioteca — el subrubro 1.2.6 "Plan de Seguridad e Higiene en el Trabajo
// (redacción y gestión)" (Implantación y Replanteo › Seguridad y Trabajos en
// Altura) era el mismo concepto que el rubro fijo "Estudio y Plan de
// Seguridad" que carga el wizard al tildar "Requiere plan y estudio de
// seguridad" (ver src/lib/seguridadAltura.ts). Luis decidió que queda el del
// wizard: se DESACTIVA 1.2.6 (activo=false). No se borra: es reversible, y la
// Biblioteca, "Ver subrubros típicos" y Cálculo Rápido solo leen subrubros
// activos (mismo criterio que con Cepol 9.2.2 e Hidrolavado 9.2.8).
//
// Seguridad: antes de escribir verifica que 1.2.6 siga siendo el plan de
// seguridad (por la descripción) y que esté en Implantación y Replanteo; si
// no, aborta sin escribir. Los demás 1.2.x no se tocan. Ningún proyecto se
// toca: un rubro de proyecto no guarda el código de la Biblioteca.
//
// Idempotente: si 1.2.6 ya está inactivo con la nota, no hace nada.
//
// Ejecutar (dry-run): npx tsx scripts/desactivar-plan-seguridad-biblioteca-2026-10.ts
// Ejecutar (real):     npx tsx scripts/desactivar-plan-seguridad-biblioteca-2026-10.ts --apply

import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const CODIGO = "1.2.6";
const DESCRIPCION_ESPERADA = "plan de seguridad e higiene en el trabajo";
const CAPITULO_ESPERADO = "Implantación y Replanteo";
const NOTA = "reemplazado por el rubro fijo «Estudio y Plan de Seguridad» del wizard, desactivado oct-2026";

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);

  const s = await db.subrubroEstandar.findUnique({
    where: { codigo: CODIGO },
    include: { capituloCatalogo: true, subcapituloCatalogo: true },
  });
  if (!s) throw new Error(`No existe el subrubro ${CODIGO}`);

  console.log(
    `  ${s.codigo} · ${s.descripcion} · ${s.capituloCatalogo?.nombre ?? "—"} › ${s.subcapituloCatalogo?.nombre ?? "—"} · ${s.unidad} · $${s.precioUY} · activo=${s.activo}`
  );
  if (!s.descripcion.trim().toLowerCase().startsWith(DESCRIPCION_ESPERADA)) {
    throw new Error(`${CODIGO} ya no es el plan de seguridad («${s.descripcion}») — no se escribe nada`);
  }
  if (s.capituloCatalogo?.nombre !== CAPITULO_ESPERADO) {
    throw new Error(`${CODIGO} no está en ${CAPITULO_ESPERADO} — no se escribe nada`);
  }

  const yaListo = !s.activo && (s.notasInternas ?? "").includes(NOTA);
  if (yaListo) {
    console.log(`  = ${CODIGO} ya está desactivado con la nota. Sin cambios.`);
  } else {
    const nota = s.notasInternas && s.notasInternas.trim()
      ? (s.notasInternas.includes(NOTA) ? s.notasInternas : `${s.notasInternas} ${NOTA}`)
      : NOTA;
    console.log(`  → activo ${s.activo} → false · notasInternas: ${s.notasInternas ? `«${s.notasInternas}» → ` : "(vacío) → "}«${nota}»`);
    if (aplicar) {
      const r = await db.subrubroEstandar.updateMany({
        where: { id: s.id, activo: s.activo, notasInternas: s.notasInternas },
        data: { activo: false, notasInternas: nota },
      });
      if (r.count !== 1) throw new Error(`${CODIGO} cambió mientras tanto — se aborta`);
    }
  }

  console.log("\n── No se toca ──");
  console.log("  Los demás 1.2.x, precios, APU ni ningún proyecto.");
  console.log(aplicar ? "\nAPLICADO." : "\nDRY RUN: no se escribió nada. Para aplicar: --apply (con el OK de Luis).");
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
