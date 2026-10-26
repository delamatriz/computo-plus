// Datos — saca el RUT provisorio de la empresa de prueba "De La Matriz".
//
// Por qué: la empresa de prueba (slug "de-la-matriz", creada el 2026-10-23)
// quedó con RUT "PENDIENTE-de-la-matriz", que no pasa la validación del
// perfil en /configuracion (solo números, 10 a 12 dígitos) y le bloquea el
// guardado a su ADMIN. El RUT es opcional en el perfil.
//
// Qué escribe: SOLO Empresa.rut de esa empresa, a "" (texto vacío).
// Empresa.rut es obligatorio y @unique en el schema: no puede ser null, y el
// texto vacío lo puede tener una sola empresa (se verifica). Los PDF no
// muestran el RUT cuando está vacío. No toca la empresa principal
// ("DE LA MATRIZ", slug "delamatriz") ni ningún otro campo, usuario o proyecto.
//
// Seguridad: aborta sin escribir si la empresa no tiene exactamente el RUT
// provisorio o si otra empresa ya tiene el RUT vacío. El update lleva el RUT
// leído en el where. Con --apply imprime antes un respaldo (id y RUT anterior).
//
// Idempotente: si ya tiene el RUT vacío, no hace nada.
//
// Ejecutar (dry-run): npx tsx scripts/rut-vacio-empresa-prueba-2026-10.ts
// Ejecutar (real):     npx tsx scripts/rut-vacio-empresa-prueba-2026-10.ts --apply

import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const SLUG = "de-la-matriz";
const RUT_PROVISORIO = "PENDIENTE-de-la-matriz";
const RUT_VACIO = "";

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);

  const empresa = await db.empresa.findFirst({ where: { slug: SLUG }, select: { id: true, nombre: true, rut: true, slug: true, estado: true } });
  if (!empresa) throw new Error(`No hay ninguna empresa con slug "${SLUG}" — no se escribe nada`);
  console.log(`Empresa: ${empresa.nombre} (slug ${empresa.slug}, ${empresa.estado}) — RUT actual: "${empresa.rut}"`);

  if (empresa.rut === RUT_VACIO) {
    console.log("\n= Ya tiene el RUT vacío. Nada para hacer.");
    await db.$disconnect();
    return;
  }
  if (empresa.rut !== RUT_PROVISORIO) {
    throw new Error(`El RUT actual no es el provisorio esperado ("${RUT_PROVISORIO}") — no se pisa, revisar a mano`);
  }
  const otra = await db.empresa.findFirst({ where: { rut: RUT_VACIO, NOT: { id: empresa.id } }, select: { nombre: true } });
  if (otra) throw new Error(`Otra empresa ("${otra.nombre}") ya tiene el RUT vacío (es único) — no se escribe nada`);

  console.log(`\n── Cambio ──\n  Empresa.rut: "${empresa.rut}" → "" (vacío)`);
  console.log("\n── No se toca ──\n  La empresa principal (slug delamatriz), ningún otro campo, usuarios ni proyectos.");

  if (aplicar) {
    console.log(`\n── Respaldo ──\n${JSON.stringify({ id: empresa.id, rut: empresa.rut })}`);
    const r = await db.empresa.updateMany({ where: { id: empresa.id, rut: RUT_PROVISORIO }, data: { rut: RUT_VACIO } });
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
