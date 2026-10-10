// Seed de Multi-tenant Fase 1 (oct-2026): empresa inicial "De La Matriz"
// (slug "delamatriz") y asignación de los proyectos sin empresa.
//
// Idempotente:
//   1. Busca la empresa por slug "delamatriz".
//   2. Si no está y hay UNA sola empresa sin slug (la que ya existía antes de
//      multi-tenant, "DE LA MATRIZ"), le pone ese slug — no crea otra.
//   3. Si no hay ninguna empresa, la crea.
//   4. Si hay varias sin slug, aborta sin escribir (no adivina cuál es).
//   5. Asigna a esa empresa todos los Proyecto con empresaId vacío.
//   6. Crea el primer usuario ADMIN (luis@delamatriz.com) si no existe. Si ya
//      existe no lo toca — no le pisa la contraseña si se cambió después.
//      La contraseña inicial sale de SEED_ADMIN_PASSWORD (.env.local), nunca
//      va escrita en este archivo.
// No cambia el nombre de la empresa existente ni ningún otro dato.
//
// (Reemplaza al seed de demostración de la época de SQLite, que creaba un
// proyecto de ejemplo con id "1" — ver historial de git.)
//
// Ejecutar (dry-run): npx tsx prisma/seed.ts
// Ejecutar (real):     npx tsx prisma/seed.ts --apply

import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const SLUG = "delamatriz";
const NOMBRE_SI_SE_CREA = "DE LA MATRIZ";
const ADMIN = { email: "luis@delamatriz.com", nombre: "Luis", rol: "ADMIN" };

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);

  // ── Empresa ──
  let empresa = await db.empresa.findUnique({ where: { slug: SLUG } });
  if (empresa) {
    console.log(`= Empresa «${empresa.nombre}» ya tiene slug "${SLUG}" (${empresa.id}).`);
  } else {
    const sinSlug = await db.empresa.findMany({ where: { slug: null } });
    const total = await db.empresa.count();
    if (sinSlug.length === 1) {
      console.log(`→ Empresa existente «${sinSlug[0].nombre}» (${sinSlug[0].id}): slug null → "${SLUG}".`);
      if (aplicar) empresa = await db.empresa.update({ where: { id: sinSlug[0].id }, data: { slug: SLUG } });
      else empresa = { ...sinSlug[0], slug: SLUG };
    } else if (total === 0) {
      console.log(`→ No hay empresas: se crea «${NOMBRE_SI_SE_CREA}» con slug "${SLUG}".`);
      if (aplicar) empresa = await db.empresa.create({ data: { nombre: NOMBRE_SI_SE_CREA, rut: "000000000000", slug: SLUG } });
    } else {
      throw new Error(`Hay ${sinSlug.length} empresas sin slug (de ${total}) — no se sabe cuál es "${SLUG}". No se escribe nada.`);
    }
  }

  // ── Proyectos sin empresa ──
  const sinEmpresa = await db.proyecto.findMany({ where: { empresaId: null }, select: { id: true, nombre: true } });
  console.log(`\nProyectos sin empresa: ${sinEmpresa.length}`);
  for (const p of sinEmpresa) console.log(`  → ${p.nombre} (${p.id})`);
  if (sinEmpresa.length > 0 && aplicar && empresa) {
    const r = await db.proyecto.updateMany({ where: { empresaId: null }, data: { empresaId: empresa.id } });
    console.log(`  Asignados: ${r.count}`);
  }

  // ── Primer usuario ADMIN ──
  const existente = await db.user.findUnique({ where: { email: ADMIN.email } });
  if (existente) {
    console.log(`
= Usuario ${ADMIN.email} ya existe (${existente.id}, rol ${existente.rol}) — no se toca.`);
  } else {
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!password) throw new Error("Falta SEED_ADMIN_PASSWORD en .env.local para crear el usuario ADMIN.");
    console.log(`
→ Se crea el usuario ${ADMIN.email} (${ADMIN.nombre}, ${ADMIN.rol}) en la empresa ${empresa?.id ?? "(nueva)"}.`);
    if (aplicar) {
      if (!empresa) throw new Error(`No hay empresa "${SLUG}" para asignarle el usuario.`);
      const passwordHash = await bcrypt.hash(password, 12);
      const u = await db.user.upsert({
        where: { email: ADMIN.email },
        update: {},
        create: { ...ADMIN, passwordHash, empresaId: empresa.id },
      });
      console.log(`  Creado: ${u.id}`);
    }
  }

  const totales = await db.proyecto.groupBy({ by: ["empresaId"], _count: { _all: true } });
  console.log(`\nProyectos por empresa: ${totales.map((t) => `${t.empresaId ?? "(sin empresa)"}: ${t._count._all}`).join(" · ")}`);
  console.log(aplicar ? "\nAPLICADO." : "\nDRY RUN: no se escribió nada. Para aplicar: --apply");
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
