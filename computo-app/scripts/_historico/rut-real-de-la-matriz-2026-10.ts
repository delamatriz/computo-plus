// Datos — RUT real de la empresa De La Matriz.
//
// Por qué: la empresa principal ("DE LA MATRIZ", slug "delamatriz", la de los
// proyectos reales) tenía un RUT de relleno ("123455678910") que salía en el
// membrete de los PDF. Luis pasó el real. (Ojo: existe otra empresa "De La
// Matriz", slug "de-la-matriz", en prueba, con RUT "PENDIENTE-de-la-matriz":
// esa NO se toca.)
//
// Qué escribe: SOLO Empresa.rut de la empresa con slug "delamatriz" y el RUT
// anterior exacto. No toca ningún otro campo, empresa, usuario ni proyecto.
//
// Seguridad: aborta sin escribir si no encuentra exactamente esa empresa con
// ese RUT anterior, o si el RUT nuevo ya lo tiene otra empresa (Empresa.rut
// es @unique). El update lleva el RUT leído en el where: si cambió mientras
// tanto, no escribe. Con --apply imprime antes un respaldo (id y RUT anterior).
//
// Idempotente: si la empresa ya tiene el RUT nuevo, no hace nada.
//
// Ejecutar (dry-run): npx tsx scripts/rut-real-de-la-matriz-2026-10.ts
// Ejecutar (real):     npx tsx scripts/rut-real-de-la-matriz-2026-10.ts --apply

import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const SLUG = "delamatriz";
const RUT_ANTERIOR = "123455678910";
const RUT_REAL = "214709490014";

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);

  const empresa = await db.empresa.findFirst({ where: { slug: SLUG }, select: { id: true, nombre: true, rut: true, slug: true } });
  if (!empresa) throw new Error(`No hay ninguna empresa con slug "${SLUG}" — no se escribe nada`);
  console.log(`Empresa: ${empresa.nombre} (slug ${empresa.slug}) — RUT actual: ${empresa.rut}`);

  if (empresa.rut === RUT_REAL) {
    console.log("\n= Ya tiene el RUT real. Nada para hacer.");
    await db.$disconnect();
    return;
  }
  if (empresa.rut !== RUT_ANTERIOR) {
    throw new Error(`El RUT actual no es el esperado ("${RUT_ANTERIOR}") — no se pisa, revisar a mano`);
  }
  const otra = await db.empresa.findFirst({ where: { rut: RUT_REAL, NOT: { id: empresa.id } }, select: { nombre: true } });
  if (otra) throw new Error(`El RUT ${RUT_REAL} ya lo tiene otra empresa ("${otra.nombre}") — no se escribe nada`);

  console.log(`\n── Cambio ──\n  Empresa.rut: "${empresa.rut}" → "${RUT_REAL}"`);
  console.log("\n── No se toca ──\n  Ningún otro campo de la empresa, ni usuarios ni proyectos.");

  if (aplicar) {
    console.log(`\n── Respaldo ──\n${JSON.stringify({ id: empresa.id, rut: empresa.rut })}`);
    const r = await db.empresa.updateMany({ where: { id: empresa.id, rut: RUT_ANTERIOR }, data: { rut: RUT_REAL } });
    if (r.count !== 1) throw new Error("El RUT cambió mientras tanto — no se escribió nada");
  }

  console.log(`\nRESUMEN: 1 cambio.`);
  console.log(aplicar ? "APLICADO." : "DRY RUN: no se escribió nada. Para aplicar: --apply.");
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
