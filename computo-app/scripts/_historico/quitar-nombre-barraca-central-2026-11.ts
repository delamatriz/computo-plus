// Catálogo de precios — saca el nombre "Barraca Central" de las descripciones
// de la lista importada el 30/10/2026 como "Base Generica COMPUTO+".
//
// Por qué: esa lista es de Barraca Central, pero todavía no hay permiso para
// publicarla con su nombre, así que se importó con el proveedor genérico
// "Base Generica COMPUTO+" (decisión de Luis, se mantiene). Cuatro
// descripciones igual nombraban a la barraca ("Membrana Líquida Barraca
// Central Premium 20kg (Blanco)") y el catálogo es global: lo ven todas las
// empresas.
//
// SOLO texto de PrecioMTOP.descripcion, y solo en filas con proveedor
// "Base Generica COMPUTO+" del catálogo global (empresaId null). No toca
// precios, códigos, proveedor ni nada de proyectos o APUs. Las copias que ya
// existan en APUs (MaterialAPU, MaterialAPUEstandar, MaterialAPUEmpresa) se
// informan pero NO se modifican.
//
// Idempotente: una segunda corrida no encuentra nada que cambiar.
//
// Ejecutar (dry-run): npx tsx scripts/quitar-nombre-barraca-central-2026-11.ts
// Ejecutar (real):     npx tsx scripts/quitar-nombre-barraca-central-2026-11.ts --apply

import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const PROVEEDOR = "Base Generica COMPUTO+";
const NOMBRE = /\s*barraca central\s*/i;

function sinNombre(descripcion: string): string {
  return descripcion.replace(NOMBRE, " ").replace(/\s{2,}/g, " ").trim();
}

async function main() {
  const aplicar = process.argv.includes("--apply");
  const filtroTexto = { contains: "barraca central", mode: "insensitive" as const };

  const filas = await db.precioMTOP.findMany({
    where: { proveedor: PROVEEDOR, empresaId: null, descripcion: filtroTexto },
    select: { id: true, codigo: true, descripcion: true },
    orderBy: { codigo: "asc" },
  });

  console.log(`${aplicar ? "APLICANDO" : "DRY-RUN"} — ${filas.length} descripción(es) con "Barraca Central":`);
  for (const f of filas) console.log(`  ${f.codigo}: "${f.descripcion}" → "${sinNombre(f.descripcion)}"`);

  const [enApu, enEstandar, enEmpresa] = await Promise.all([
    db.materialAPU.count({ where: { descripcion: filtroTexto } }),
    db.materialAPUEstandar.count({ where: { descripcion: filtroTexto } }),
    db.materialAPUEmpresa.count({ where: { descripcion: filtroTexto } }),
  ]);
  console.log(
    `Copias en APUs (no se tocan): proyectos ${enApu} · biblioteca estándar ${enEstandar} · biblioteca de empresas ${enEmpresa}`
  );

  if (!aplicar || filas.length === 0) return;

  for (const f of filas) {
    await db.precioMTOP.update({ where: { id: f.id }, data: { descripcion: sinNombre(f.descripcion) } });
  }
  const quedan = await db.precioMTOP.count({ where: { proveedor: PROVEEDOR, descripcion: filtroTexto } });
  console.log(`Listo: ${filas.length} actualizada(s). Quedan con "Barraca Central": ${quedan}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
