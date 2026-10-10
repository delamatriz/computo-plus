// Multi-tenant (oct-2026) — backfill de Sugerencia.empresaId.
//
// Sugerencia no tenía empresaId: todas las filas existentes son de antes del
// multi-tenant, cuando la única empresa era DE LA MATRIZ. Les asigna esa
// empresa a las que tienen empresaId en null.
//
// Idempotente: el updateMany filtra por empresaId null, así que una segunda
// corrida da 0 cambios y nunca pisa una sugerencia ya asignada.
//
// Ejecutar (dry-run, no escribe nada):  npx tsx scripts/backfill-sugerencias-empresa.ts
// Ejecutar (real):                       npx tsx scripts/backfill-sugerencias-empresa.ts --apply

import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(aplicar ? "Modo: APPLY (escribe en la base)" : "Modo: DRY-RUN (no escribe nada)");

  const empresas = await db.empresa.findMany({
    where: { nombre: { contains: "De La Matriz", mode: "insensitive" } },
    select: { id: true, nombre: true, slug: true },
  });
  if (empresas.length !== 1) {
    console.error(`Se esperaba 1 empresa "De La Matriz", hay ${empresas.length}:`, empresas);
    process.exitCode = 1;
    return;
  }
  const empresa = empresas[0];
  console.log(`Empresa destino: ${empresa.nombre} (slug=${empresa.slug ?? "—"}, id=${empresa.id})`);

  const total = await db.sugerencia.count();
  const sinEmpresa = await db.sugerencia.findMany({
    where: { empresaId: null },
    select: { id: true, mensaje: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`Sugerencias: ${total} en total, ${sinEmpresa.length} sin empresaId`);
  for (const s of sinEmpresa) {
    const resumen = s.mensaje.replace(/\s+/g, " ").slice(0, 60);
    console.log(`  - ${s.createdAt.toISOString().slice(0, 10)}  ${s.id}  "${resumen}"`);
  }

  if (sinEmpresa.length === 0) {
    console.log("Nada que hacer.");
    return;
  }
  if (!aplicar) {
    console.log(`\nDry-run: se asignarían ${sinEmpresa.length} sugerencias a ${empresa.nombre}. Correr con --apply para escribir.`);
    return;
  }

  const resultado = await db.sugerencia.updateMany({
    where: { empresaId: null },
    data: { empresaId: empresa.id },
  });
  console.log(`\n✓ ${resultado.count} sugerencias asignadas a ${empresa.nombre}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
