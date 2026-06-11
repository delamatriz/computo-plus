// AUTO-GENERADO — Lista MTOP N°599 Noviembre 2025
// 313 materiales: 287 principales + 26 nuevos
// Ejecutar: npx tsx prisma/seed-mtop.ts

import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../src/generated/prisma/client";
import path from "path";
import { MATERIALES } from "./seed-mtop-data";

const dbPath = path.resolve(process.cwd(), "dev.db");
const adapter = new PrismaLibSql({ url: `file:${dbPath}` });
const db = new PrismaClient({ adapter });

async function main() {
  let insertados = 0, actualizados = 0;
  for (const m of MATERIALES) {
    await db.precioMTOP.upsert({
      where: { codigo: m.codigo },
      create: { ...m, numeroLista: 599, fechaLista: "2025-11" },
      update: { ...m, numeroLista: 599, fechaLista: "2025-11" },
    });
    insertados++;
  }
  console.log(`✓ MTOP N°599: ${insertados} materiales cargados en DB`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
