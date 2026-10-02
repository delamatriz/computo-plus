// Carga precios de referencia de alquiler de equipos (mercado uruguayo 2025)
// en la tabla PrecioEquipo, en la base de PRODUCCIÓN.
// Ejecutar: DATABASE_URL="postgresql://..." npx tsx scripts/seed-precios-equipos.ts

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

const equipos = [
  // Equipos de hormigón
  { codigo: "EQ-HORMIGONERA", descripcion: "Hormigonera", unidad: "hs", precioHora: 350 },
  { codigo: "EQ-HORMIGONERA-CHICA", descripcion: "Hormigonera chica", unidad: "hs", precioHora: 250 },
  { codigo: "EQ-VIBRADOR", descripcion: "Vibrador de inmersión", unidad: "hs", precioHora: 180 },

  // Equipos de demolición
  { codigo: "EQ-MARTILLO-NEUM", descripcion: "Martillo neumático", unidad: "hs", precioHora: 450 },
  { codigo: "EQ-COMPRESOR", descripcion: "Compresor de aire", unidad: "hs", precioHora: 380 },
  { codigo: "EQ-ROTOMARTILLO", descripcion: "Rotomartillo eléctrico", unidad: "hs", precioHora: 150 },

  // Equipos de movimiento de tierra
  { codigo: "EQ-RETROEXCAVADORA", descripcion: "Retroexcavadora", unidad: "hs", precioHora: 2500 },
  { codigo: "EQ-PLANCHA-VIBRADORA", descripcion: "Plancha vibradora", unidad: "hs", precioHora: 800 },
  { codigo: "EQ-MINICARGADORA", descripcion: "Minicargadora", unidad: "hs", precioHora: 2200 },
  { codigo: "EQ-VOLQUETA", descripcion: "Volqueta 6m3", unidad: "hs", precioHora: 1800 },

  // Equipos de elevación y altura
  { codigo: "EQ-ANDAMIO-TUBULAR", descripcion: "Andamio tubular", unidad: "m2/mes", precioHora: 85 },
  { codigo: "EQ-BALANCIN", descripcion: "Balancín", unidad: "hs", precioHora: 1200 },
  { codigo: "EQ-TORRE-ANDAMIO", descripcion: "Torre de andamio", unidad: "hs", precioHora: 600 },
  { codigo: "EQ-GRUA-TORRE", descripcion: "Grúa torre", unidad: "hs", precioHora: 4500 },
  { codigo: "EQ-MALACATE", descripcion: "Malacate eléctrico", unidad: "hs", precioHora: 450 },
  { codigo: "EQ-ELEVADOR-OBRA", descripcion: "Elevador de obra", unidad: "hs", precioHora: 800 },

  // Equipos de acabados
  { codigo: "EQ-AMOLADORA", descripcion: "Amoladora angular", unidad: "hs", precioHora: 120 },
  { codigo: "EQ-TALADRO", descripcion: "Taladro percutor", unidad: "hs", precioHora: 80 },
  { codigo: "EQ-SIERRA-CIRCULAR", descripcion: "Sierra circular", unidad: "hs", precioHora: 150 },
  { codigo: "EQ-LIJADORA", descripcion: "Lijadora de piso", unidad: "hs", precioHora: 350 },
  { codigo: "EQ-PULIDORA", descripcion: "Pulidora de piso", unidad: "hs", precioHora: 400 },
  { codigo: "EQ-COMPRESOR-PINTURA", descripcion: "Compresor para pintura", unidad: "hs", precioHora: 300 },
];

async function main() {
  let creados = 0;
  let actualizados = 0;

  for (const eq of equipos) {
    const existente = await p.precioEquipo.findUnique({ where: { codigo: eq.codigo } });

    await p.precioEquipo.upsert({
      where: { codigo: eq.codigo },
      update: {
        descripcion: eq.descripcion,
        unidad: eq.unidad,
        precioHora: eq.precioHora,
      },
      create: eq,
    });

    if (existente) {
      actualizados++;
      console.log(`↻ ${eq.codigo} — actualizado ($${eq.precioHora}/${eq.unidad})`);
    } else {
      creados++;
      console.log(`✓ ${eq.codigo} — creado ($${eq.precioHora}/${eq.unidad})`);
    }
  }

  console.log("\n── Resumen ──");
  console.log(`Creados:      ${creados}`);
  console.log(`Actualizados: ${actualizados}`);
  console.log(`Total:        ${equipos.length}`);

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
