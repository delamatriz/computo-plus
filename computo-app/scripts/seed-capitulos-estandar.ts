// Carga la biblioteca estándar de 20 capítulos en la base de PRODUCCIÓN.
// Ejecutar: DATABASE_URL="postgresql://..." npx tsx scripts/seed-capitulos-estandar.ts

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

const CAPITULOS = [
  "Implantación y Replanteo",
  "Excavaciones y Movimiento de Tierra",
  "Demoliciones y Picados",
  "Cimentaciones",
  "Estructura de Hormigón Armado",
  "Albañilería",
  "Pisos, Zócalos y Revestimientos",
  "Impermeabilizaciones y Aislaciones",
  "Cubierta / Techos",
  "Instalación Sanitaria",
  "Instalación Eléctrica",
  "Instalación Térmica / Aire Acondicionado",
  "Carpintería",
  "Vidrios y Espejos",
  "Yeso y Cielorrasos",
  "Pinturas",
  "Equipamiento",
  "Sistemas Constructivos No Tradicionales",
  "Obra Exterior / Jardín",
  "Imprevistos",
];

async function main() {
  for (let i = 0; i < CAPITULOS.length; i++) {
    const nombre = CAPITULOS[i];
    const orden = i + 1;
    await p.capituloEstandar.upsert({
      where: { nombre },
      update: { orden, origen: "estandar" },
      create: { nombre, orden, origen: "estandar", vecesUsado: 1 },
    });
  }
  console.log(`Biblioteca de capítulos estándar cargada OK (${CAPITULOS.length} capítulos)`);
  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
