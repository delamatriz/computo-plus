// Carga la lista MTOP N°599 (313 materiales) en la base de PRODUCCIÓN.
// Ejecutar: DATABASE_URL="postgresql://..." npx tsx scripts/seed-mtop-prod.ts

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { MATERIALES } from "../prisma/seed-mtop-data";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const db = new PrismaClient({ adapter });

async function main() {
  let cargados = 0;
  for (const m of MATERIALES) {
    await db.precioMTOP.upsert({
      where: { codigo: m.codigo },
      create: { ...m, numeroLista: 599, fechaLista: "2025-11" },
      update: { ...m, numeroLista: 599, fechaLista: "2025-11" },
    });
    cargados++;
  }
  console.log(`✓ MTOP N°599: ${cargados} materiales cargados en producción`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
