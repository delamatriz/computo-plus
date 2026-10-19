// Crea un usuario SUPERADMIN en una empresa existente (oct-2026). No hay otra forma: el panel
// /admin solo crea ADMIN o USUARIO (ROLES_ASIGNABLES en lib/roles.ts) y el seed crea un ADMIN.
//
// Idempotente: si ya existe un usuario con ese mail, no lo toca (ni rol ni contraseña) y solo
// informa. La empresa tiene que existir y estar ACTIVA: un SUPERADMIN en una empresa en prueba o
// vencida termina redirigido a /planes por src/proxy.ts.
//
// La contraseña sale de SEED_SUPERADMIN_PASSWORD_2 (.env.local), nunca va escrita acá ni se
// imprime. Se guarda hasheada con bcrypt (cost 12, igual que el seed y /api/admin/usuarios).
//
// Ejecutar (dry-run, no escribe): npx tsx scripts/crear-superadmin.ts
// Ejecutar (real):                npx tsx scripts/crear-superadmin.ts --apply
// Antes de --apply en producción: npx tsx scripts/backup-db.ts

import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const SUPERADMIN = { email: "computo@delamatriz.com", nombre: "Luis Rodríguez" };
const SLUG_EMPRESA = "delamatriz"; // DE LA MATRIZ
const LARGO_MINIMO_PASSWORD = 8;

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(aplicar ? "MODO APLICAR — escribe en la base" : "DRY RUN — no escribe nada");

  const empresa = await db.empresa.findUnique({ where: { slug: SLUG_EMPRESA }, select: { id: true, nombre: true, estado: true } });
  if (!empresa) throw new Error(`No existe la empresa con slug "${SLUG_EMPRESA}".`);
  console.log(`Empresa: ${empresa.nombre} (${empresa.id}) — estado ${empresa.estado}`);
  if (empresa.estado !== "ACTIVA") throw new Error(`La empresa está ${empresa.estado}: un SUPERADMIN ahí quedaría bloqueado. Abortado.`);

  const password = process.env.SEED_SUPERADMIN_PASSWORD_2 ?? "";
  if (password.length < LARGO_MINIMO_PASSWORD) {
    throw new Error(`SEED_SUPERADMIN_PASSWORD_2 falta en .env.local o tiene menos de ${LARGO_MINIMO_PASSWORD} caracteres.`);
  }
  console.log(`Contraseña: tomada de SEED_SUPERADMIN_PASSWORD_2 (${password.length} caracteres, no se muestra).`);

  const existente = await db.user.findUnique({
    where: { email: SUPERADMIN.email },
    select: { id: true, rol: true, empresa: { select: { nombre: true } } },
  });
  if (existente) {
    console.log(`\n= Ya existe ${SUPERADMIN.email} (${existente.id}, rol ${existente.rol}, empresa ${existente.empresa.nombre}) — no se toca.`);
    return;
  }

  console.log(`\n→ Se crearía: ${SUPERADMIN.email} · "${SUPERADMIN.nombre}" · rol SUPERADMIN · emailVerificado true · empresa ${empresa.nombre}`);
  if (!aplicar) {
    console.log("\nDRY RUN: no se escribió nada. Para crear el usuario: --apply");
    return;
  }

  const u = await db.user.create({
    data: {
      email: SUPERADMIN.email,
      nombre: SUPERADMIN.nombre,
      rol: "SUPERADMIN",
      emailVerificado: true,
      empresaId: empresa.id,
      passwordHash: await bcrypt.hash(password, 12),
    },
    select: { id: true, email: true, rol: true },
  });
  console.log(`\nCREADO: ${u.email} (${u.id}) rol ${u.rol}.`);
}

main()
  .catch((e) => {
    console.error("ERROR:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
