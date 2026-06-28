// Carga 10 capítulos estándar nuevos (21-30) en la base de PRODUCCIÓN.
// Ejecutar: DATABASE_URL="postgresql://..." npx tsx scripts/seed-capitulos-nuevos.ts

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

const capitulos = [
  { nombre: "Instalación de Gas", orden: 21 },
  { nombre: "Instalación Contra Incendio", orden: 22 },
  { nombre: "Ascensor", orden: 23 },
  { nombre: "Honorarios Profesionales", orden: 24 },
  { nombre: "Derechos de Construcción y Permisos", orden: 25 },
  { nombre: "Ensayo de Suelos", orden: 26 },
  { nombre: "Conexiones de Servicios", orden: 27 },
  { nombre: "Seguridad y Trabajos en Altura", orden: 28 },
  { nombre: "Instalación Energías Renovables", orden: 29 },
  { nombre: "Gastos Generales de Obra", orden: 30 },
];

async function main() {
  for (const { nombre, orden } of capitulos) {
    await p.capituloEstandar.upsert({
      where: { nombre },
      update: { orden, origen: "estandar" },
      create: { nombre, orden, origen: "estandar", vecesUsado: 1 },
    });
  }
  console.log(`Capítulos nuevos cargados OK (${capitulos.length} capítulos)`);
  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
