// Normaliza Rubro.unidad a mayúscula en toda la base (ej. "m²" -> "M2").
// toUpperCase() no convierte "²"/"³" (no son letras), así que también se
// reemplazan por "2"/"3" explícitamente para que coincida con la
// convención ya usada en el resto del proyecto (p.ej. "M2", no "M²").
// Cambio puramente de formato de texto — no toca ningún precio ni cálculo,
// así que se corre directo, sin dry-run.
//
// Ejecutar: npx tsx scripts/normalizar-unidades-rubro.ts

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

function normalizar(unidad: string): string {
  return unidad.toUpperCase().replace(/²/g, "2").replace(/³/g, "3");
}

async function main() {
  const rubros = await p.rubro.findMany({ select: { id: true, descripcion: true, unidad: true } });

  let normalizados = 0;
  for (const rubro of rubros) {
    const upper = normalizar(rubro.unidad);
    if (upper !== rubro.unidad) {
      await p.rubro.update({ where: { id: rubro.id }, data: { unidad: upper } });
      console.log(`✓ "${rubro.descripcion}" — unidad "${rubro.unidad}" → "${upper}"`);
      normalizados++;
    }
  }

  console.log("\n── Resumen ──");
  console.log(`Rubros revisados:    ${rubros.length}`);
  console.log(`Rubros normalizados: ${normalizados}`);

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
