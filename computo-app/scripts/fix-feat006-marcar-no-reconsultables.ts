// FEAT-AI-006, etapa 3 — marca 3 registros de "retail directo" como
// fuente_no_reconsultable: 2 CYPE con precio compuesto/derivado
// (desglose no indexable vía búsqueda web, confirmado por prueba en
// vivo) + 1 proveedor confirmado "a cotizar" (Waluminio/Aberturas
// Moscú, ficha sin precio numérico publicado, confirmado por prueba
// en vivo).
//
// requiereVerificacion queda en false — no es "necesita revisión
// humana", es "no hay nada que reconsultar automáticamente acá".
// Quedan EXCLUIDOS del ciclo del job de verificación (etapa 3), no en
// su cola de revisión activa.
//
// SOLO METADATA — no toca precioUY ni ningún otro dato de precio.
//
// Ejecutar (dry-run): npx tsx scripts/fix-feat006-marcar-no-reconsultables.ts
// Ejecutar (real):     npx tsx scripts/fix-feat006-marcar-no-reconsultables.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const CODIGOS = [
  "MAT-ADHESIVO-PARQUET",
  "MAT-ADHESIVO-VINILICO",
  "MAT-ALUM-73170B",
];

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);

  for (const codigo of CODIGOS) {
    const existente = await db.precioMTOP.findUnique({ where: { codigo } });
    if (!existente) {
      console.warn(`  ⚠ ${codigo} — NO existe, se salta`);
      continue;
    }
    console.log(`  ${codigo} — motivoVerificacion="fuente_no_reconsultable", requiereVerificacion=false`);
    if (aplicar) {
      await db.precioMTOP.update({
        where: { codigo },
        data: { motivoVerificacion: "fuente_no_reconsultable", requiereVerificacion: false },
      });
    }
  }

  console.log(aplicar ? "\nAplicado." : "\nDry-run — nada se escribió.");
  await db.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await db.$disconnect();
  process.exit(1);
});
