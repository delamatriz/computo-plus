// Fase 2, Etapa 7 — agrega "Seguridad y Trabajos en Altura" a
// CapituloCatalogo. Caso especial: no tiene (ni va a tener) biblioteca de
// SubrubroEstandar propia — sus rubros siempre se generan a mano vía
// lib/seguridadAltura.ts según la modalidad de altura declarada. La fila
// existe solo para que ese capítulo real tenga capituloCatalogoId,
// consistente con el resto del catálogo.
//
// Idempotente: upsert por nombre.
//
// Ejecutar: npx tsx scripts/seed-capitulo-catalogo-seguridad-altura.ts

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const NOMBRE = "Seguridad y Trabajos en Altura";

async function main() {
  const maxOrden = await db.capituloCatalogo.aggregate({ _max: { orden: true } });
  const orden = (maxOrden._max.orden ?? -1) + 1;

  const resultado = await db.capituloCatalogo.upsert({
    where: { nombre: NOMBRE },
    create: { nombre: NOMBRE, orden, activo: true },
    update: {},
  });
  console.log("CapituloCatalogo:", resultado);

  const total = await db.capituloCatalogo.count();
  console.log(`Total CapituloCatalogo: ${total}`);

  await db.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
