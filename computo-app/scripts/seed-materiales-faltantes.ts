// Carga precios de referencia de mercado (no MTOP oficial) para los
// materiales más usados en APUEstandar que no tenían match en PrecioMTOP
// (hierro para armado, selladores, accesorios sanitarios, tornillería,
// Durlock, granito, pintura anticorrosiva, soporte mural), en la base
// de PRODUCCIÓN.
// numeroLista=0 y fechaLista="2026-07" marcan estas entradas como
// referencia de mercado, distinguiéndolas de la Lista MTOP N°599 oficial.
// Ejecutar: DATABASE_URL="postgresql://..." npx tsx scripts/seed-materiales-faltantes.ts

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

const materiales = [
  // Hierro y acero
  { codigo: "MAT-HIERRO-ARM", descripcion: "Hierro para hormigón armado",
    cantidadUnidad: "1 kg", unidad: "kg", cantidad: 1,
    precioUnitario: 240, precioConIva: 240 },

  // Selladores y adhesivos
  { codigo: "MAT-SILICONA-VEN", descripcion: "Silicona para ventanas",
    cantidadUnidad: "1 u", unidad: "u", cantidad: 1,
    precioUnitario: 280, precioConIva: 280 },
  { codigo: "MAT-PASTINA", descripcion: "Pastina para juntas",
    cantidadUnidad: "1 kg", unidad: "kg", cantidad: 1,
    precioUnitario: 85, precioConIva: 85 },
  { codigo: "MAT-PEG-CERAMICA", descripcion: "Pegamento para cerámica",
    cantidadUnidad: "1 kg", unidad: "kg", cantidad: 1,
    precioUnitario: 65, precioConIva: 65 },
  { codigo: "MAT-SELLADOR-SIL", descripcion: "Sellador silicona",
    cantidadUnidad: "1 u", unidad: "u", cantidad: 1,
    precioUnitario: 320, precioConIva: 320 },
  { codigo: "MAT-HIDROFUGO", descripcion: "Hidrófugo líquido",
    cantidadUnidad: "1 l", unidad: "l", cantidad: 1,
    precioUnitario: 180, precioConIva: 180 },
  { codigo: "MAT-IMP-ASFALTICA", descripcion: "Imprimación asfáltica",
    cantidadUnidad: "1 l", unidad: "l", cantidad: 1,
    precioUnitario: 145, precioConIva: 145 },
  { codigo: "MAT-SELLADOR-GRANITO", descripcion: "Sellador para granito",
    cantidadUnidad: "1 l", unidad: "l", cantidad: 1,
    precioUnitario: 420, precioConIva: 420 },

  // Accesorios sanitarios y plomería
  { codigo: "MAT-ACC-PVC-SAN", descripcion: "Accesorios PVC sanitario",
    cantidadUnidad: "1 gl", unidad: "gl", cantidad: 1,
    precioUnitario: 850, precioConIva: 850 },
  { codigo: "MAT-ACC-COLOC-SAN", descripcion: "Accesorios de colocación sanitaria",
    cantidadUnidad: "1 gl", unidad: "gl", cantidad: 1,
    precioUnitario: 650, precioConIva: 650 },
  { codigo: "MAT-CANO-COBRE", descripcion: "Caño cobre 1/4 y 3/8",
    cantidadUnidad: "1 ml", unidad: "ml", cantidad: 1,
    precioUnitario: 380, precioConIva: 380 },

  // Herrajes y tornillería
  { codigo: "MAT-TORN-MET", descripcion: "Tornillos y herrajes metálicos",
    cantidadUnidad: "1 gl", unidad: "gl", cantidad: 1,
    precioUnitario: 450, precioConIva: 450 },
  { codigo: "MAT-TORN-MUEBLE", descripcion: "Tornillos y herrajes mueble",
    cantidadUnidad: "1 gl", unidad: "gl", cantidad: 1,
    precioUnitario: 380, precioConIva: 380 },
  { codigo: "MAT-TORN-DURLOCK", descripcion: "Tornillos autoperforantes Durlock",
    cantidadUnidad: "1 u", unidad: "u", cantidad: 1,
    precioUnitario: 4, precioConIva: 4 },
  { codigo: "MAT-TORN-CHAPA", descripcion: "Tornillos autoperforantes para chapa",
    cantidadUnidad: "1 u", unidad: "u", cantidad: 1,
    precioUnitario: 6, precioConIva: 6 },
  { codigo: "MAT-ELECTRODOS", descripcion: "Electrodos de soldadura",
    cantidadUnidad: "1 u", unidad: "u", cantidad: 1,
    precioUnitario: 25, precioConIva: 25 },

  // Durlock y construcción en seco
  { codigo: "MAT-DURLOCK", descripcion: "Placa Durlock 9.5mm",
    cantidadUnidad: "1 m2", unidad: "m2", cantidad: 1,
    precioUnitario: 520, precioConIva: 520 },

  // Granito y mármol
  { codigo: "MAT-GRANITO-GRIS", descripcion: "Granito gris mesada",
    cantidadUnidad: "1 m2", unidad: "m2", cantidad: 1,
    precioUnitario: 4800, precioConIva: 4800 },

  // Pintura anticorrosiva
  { codigo: "MAT-ANTICORR", descripcion: "Pintura anticorrosiva",
    cantidadUnidad: "1 l", unidad: "l", cantidad: 1,
    precioUnitario: 285, precioConIva: 285 },

  // Soporte mural
  { codigo: "MAT-SOPORTE-MURAL", descripcion: "Soporte mural exterior",
    cantidadUnidad: "1 u", unidad: "u", cantidad: 1,
    precioUnitario: 420, precioConIva: 420 },
];

async function main() {
  let creados = 0;
  let actualizados = 0;

  for (const m of materiales) {
    const existente = await p.precioMTOP.findUnique({ where: { codigo: m.codigo } });

    await p.precioMTOP.upsert({
      where: { codigo: m.codigo },
      update: {
        descripcion: m.descripcion,
        cantidadUnidad: m.cantidadUnidad,
        unidad: m.unidad,
        cantidad: m.cantidad,
        precioUnitario: m.precioUnitario,
        precioConIva: m.precioConIva,
        numeroLista: 0,
        fechaLista: "2026-07",
      },
      create: {
        ...m,
        numeroLista: 0,
        fechaLista: "2026-07",
      },
    });

    if (existente) {
      actualizados++;
      console.log(`↻ ${m.codigo} — actualizado ($${m.precioUnitario}/${m.unidad}) — ${m.descripcion}`);
    } else {
      creados++;
      console.log(`✓ ${m.codigo} — creado ($${m.precioUnitario}/${m.unidad}) — ${m.descripcion}`);
    }
  }

  console.log("\n── Resumen ──");
  console.log(`Creados:      ${creados}`);
  console.log(`Actualizados: ${actualizados}`);
  console.log(`Total:        ${materiales.length}`);

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
