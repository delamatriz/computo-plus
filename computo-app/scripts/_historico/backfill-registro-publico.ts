// Backfill del registro público (oct-2026). Al agregar User.emailVerificado
// (@default false) y Empresa.estado (@default PRUEBA), `prisma db push` dejó a
// todos los usuarios y empresas existentes como "sin verificar" y "en prueba".
// Ninguno pasó por el registro público: los usuarios los dio de alta un
// SUPERADMIN (o el seed) y las empresas son clientes reales o de prueba
// interna. Este script los pasa a emailVerificado = true y estado = ACTIVA.
//
// Solo toca empresas sin fechaVencimientoPrueba (las del registro público
// siempre la tienen) y es idempotente.
//
// Ejecutar:
//   npx tsx scripts/backfill-registro-publico.ts           (dry-run)
//   npx tsx scripts/backfill-registro-publico.ts --apply   (escribe)

import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }) });
const APLICAR = process.argv.includes("--apply");

async function main() {
  const empresas = await db.empresa.findMany({
    where: { estado: { not: "ACTIVA" }, fechaVencimientoPrueba: null },
    select: { id: true, nombre: true, estado: true },
    orderBy: { createdAt: "asc" },
  });
  // Usuarios de esas empresas (los del registro público nacen verificados).
  const usuarios = await db.user.findMany({
    where: { emailVerificado: false },
    select: { id: true, email: true, empresa: { select: { nombre: true } } },
    orderBy: { creadoEn: "asc" },
  });

  console.log(`\nEmpresas a ACTIVA (${empresas.length}):`);
  for (const e of empresas) console.log(`  ${e.estado} → ACTIVA  ${e.nombre}`);
  console.log(`\nUsuarios a emailVerificado = true (${usuarios.length}):`);
  for (const u of usuarios) console.log(`  ${u.email}  (${u.empresa.nombre})`);

  if (!APLICAR) {
    console.log("\nDry-run: no se escribió nada. Correr con --apply para aplicar.");
    return;
  }
  const [rEmpresas, rUsuarios] = await db.$transaction([
    db.empresa.updateMany({ where: { id: { in: empresas.map((e) => e.id) } }, data: { estado: "ACTIVA" } }),
    db.user.updateMany({ where: { id: { in: usuarios.map((u) => u.id) } }, data: { emailVerificado: true } }),
  ]);
  console.log(`\n✓ ${rEmpresas.count} empresas a ACTIVA, ${rUsuarios.count} usuarios verificados.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
