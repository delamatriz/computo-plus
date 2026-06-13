import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

const cats = [
  { nombre: "Peón", categoria: "peon", jornal: 950 },
  { nombre: "Medio oficial", categoria: "medio_oficial", jornal: 1080 },
  { nombre: "Oficial", categoria: "oficial", jornal: 1200 },
  { nombre: "Oficial especializado", categoria: "oficial_especializado", jornal: 1380 },
  { nombre: "Capataz", categoria: "capataz", jornal: 1520 },
  { nombre: "Electricista oficial", categoria: "electricista_oficial", jornal: 1250 },
  { nombre: "Plomero oficial", categoria: "plomero_oficial", jornal: 1230 },
  { nombre: "Pintor oficial", categoria: "pintor_oficial", jornal: 1180 },
];

async function main() {
  for (const cat of cats) {
    const existente = await p.categoriaLaboral.findFirst({ where: { categoria: cat.categoria } });
    if (existente) {
      await p.categoriaLaboral.update({ where: { id: existente.id }, data: { jornal: cat.jornal, nombre: cat.nombre } });
    } else {
      await p.categoriaLaboral.create({ data: cat });
    }
  }
  console.log("Categorías cargadas OK");
  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
