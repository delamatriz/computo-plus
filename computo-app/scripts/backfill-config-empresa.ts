/**
 * Backfill: crea ConfiguracionEmpresa para De La Matriz con los valores
 * actuales de Configuracion global.
 * Idempotente. Dry-run por default. Pasar --apply para escribir.
 *
 * Uso:
 *   npx tsx scripts/backfill-config-empresa.ts
 *   npx tsx scripts/backfill-config-empresa.ts --apply
 */
import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });
const APPLY = process.argv.includes("--apply");

async function main() {
  const configGlobal = await db.configuracion.findFirst();
  if (!configGlobal) {
    console.log("No existe Configuracion global — nada que migrar.");
    return;
  }

  const { margenEmpresa, margenImprevistos, monedaDefault } = configGlobal;
  console.log("Configuracion global encontrada:");
  console.log(`  margenEmpresa:     ${margenEmpresa}`);
  console.log(`  margenImprevistos: ${margenImprevistos}`);
  console.log(`  monedaDefault:     ${monedaDefault}`);

  const delamatriz = await db.empresa.findFirst({
    where: { slug: "delamatriz" },
    select: { id: true, nombre: true },
  });
  if (!delamatriz) {
    console.error('ERROR: Empresa con slug="delamatriz" no encontrada.');
    process.exit(1);
  }
  console.log(`\nEmpresa: id=${delamatriz.id} nombre="${delamatriz.nombre}"`);

  const existente = await db.configuracionEmpresa.findUnique({
    where: { empresaId: delamatriz.id },
  });

  if (existente) {
    console.log("\nConfiguracionEmpresa ya existe — nada que hacer (idempotente).");
    return;
  }

  console.log("\nSe creará ConfiguracionEmpresa con esos valores.");

  if (!APPLY) {
    console.log("[DRY-RUN] Sin cambios. Pasar --apply para aplicar.");
    return;
  }

  const creado = await db.configuracionEmpresa.create({
    data: { empresaId: delamatriz.id, margenEmpresa, margenImprevistos, monedaDefault },
  });
  console.log(`[APLICADO] id=${creado.id}`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => db.$disconnect());
