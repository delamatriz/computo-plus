// Actualiza CategoriaLaboral con los jornales SUNCA vigentes
// (Grupo 9, Subgrupo 01 — Consejos de Salarios, abril 2025 – marzo 2026,
// ajuste +5,95% según acta MTSS) y la compensación por trabajo en altura
// vigente desde el convenio 2023-2026 (10% sobre el jornal, antes 9%).
//
// Fuente: valores provistos por el usuario, tomados de fuentes secundarias
// que citan el acta de ajuste del MTSS. Si en algún momento se carga el PDF
// oficial del MTSS al proyecto, esos valores deben priorizarse sobre estos.
//
// Corrige el mapeo de las 3 categorías simplificadas que usa el flujo de
// obra mediana (Peón, Medio oficial, Oficial) — estaban mal mapeadas:
// "Peón" tenía el jornal de Categoría III (Ayudante) y "Oficial" tenía el
// de Categoría VIII (Oficial especializado).
//
// Agrega las 12 categorías completas del laudo (para obras mayores) y
// corrige/agrega las categorías de compensación por altura (10% sobre
// Oficial y Medio Oficial únicamente — Peón no tiene variante de altura,
// nunca debe estar habilitada para esa categoría).
//
// También corrige otros dos corrimientos de categoría detectados en la
// misma auditoría: oficial_especializado tenía el jornal de Cat. IX/Capataz
// y capataz tenía el de Cat. XII/Maestro mayor de obra.
//
// No toca: plomero_oficial, electricista_oficial, pintor_oficial,
// oficial_maquinista, oficial_escalerista — categorías propias de la app
// (no forman parte del laudo general) que no fueron parte de este pedido.
// Los tres oficios (plomero/electricista/pintor) comparten el jornal de
// Cat. VIII ($2.767,81), y maquinista/escalerista comparten el de Cat. X-XI
// ($3.128,40) — no parecen "corridos" (no coinciden con NINGUNA otra
// categoría del laudo desplazada), sino un criterio deliberado de nivelar
// esos oficios a un grado fijo. Se dejan sin tocar.
//
// Ejecutar: npx tsx scripts/seed-jornales-sunca-2025.ts

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

const RECARGO_ALTURA = 0.10; // 10% — subió de 9% a 10% en el convenio 2023-2026
const redondear = (n: number) => Math.round(n * 100) / 100;

// Las 12 categorías oficiales del laudo (Grupo 9.01) — referencia completa
// para obras mayores, no usadas por el flujo simplificado de obra mediana.
const CATEGORIAS_LAUDO = [
  { categoria: "sunca_cat_i", nombre: "Peón común", jornal: 1554.29 },
  { categoria: "sunca_cat_ii", nombre: "Peón práctico", jornal: 1652.86 },
  { categoria: "sunca_cat_iii", nombre: "Ayudante", jornal: 1754.77 },
  { categoria: "sunca_cat_iv", nombre: "Medio oficial (inferior)", jornal: 1911.80 },
  { categoria: "sunca_cat_v", nombre: "Medio oficial albañil", jornal: 2069.21 },
  { categoria: "sunca_cat_vi", nombre: "Oficial (inferior)", jornal: 2239.34 },
  { categoria: "sunca_cat_vii", nombre: "Oficial albañil", jornal: 2412.65 },
  { categoria: "sunca_cat_viii", nombre: "Oficial especializado", jornal: 2767.81 },
  { categoria: "sunca_cat_ix", nombre: "Capataz", jornal: 2949.45 },
  { categoria: "sunca_cat_x", nombre: "Capataz general", jornal: 3128.40 },
  { categoria: "sunca_cat_xi", nombre: "Capataz general superior", jornal: 3128.40 },
  { categoria: "sunca_cat_xii", nombre: "Maestro mayor de obra", jornal: 3310.21 },
];

// Jornales base del flujo simplificado (obra mediana) — se corrigen acá.
const JORNAL_PEON = 1554.29;       // Categoría I — antes tenía el de Cat. III (Ayudante, 1754.77)
const JORNAL_MEDIO_OFICIAL = 2069.21; // Categoría V — ya estaba correcto
const JORNAL_OFICIAL = 2412.65;    // Categoría VII — antes tenía el de Cat. VIII (Oficial especializado, 2767.81)

const CATEGORIAS_SIMPLIFICADAS = [
  { categoria: "peon", nombre: "Peón", jornal: JORNAL_PEON },
  { categoria: "medio_oficial", nombre: "Medio oficial", jornal: JORNAL_MEDIO_OFICIAL },
  { categoria: "oficial", nombre: "Oficial albañil", jornal: JORNAL_OFICIAL },
];

// Categorías extendidas con el mismo tipo de corrimiento detectado en la
// auditoría: cada una tenía cargado el jornal de otra categoría del laudo.
const CATEGORIAS_EXTENDIDAS_CORREGIDAS = [
  // Categoría VIII — antes tenía el de Cat. IX (Capataz, 2949.45)
  { categoria: "oficial_especializado", nombre: "Oficial especializado", jornal: 2767.81 },
  // Categoría IX — antes tenía el de Cat. XII (Maestro mayor de obra, 3310.21)
  { categoria: "capataz", nombre: "Capataz", jornal: 2949.45 },
];

// Compensación por trabajo en altura — 10% sobre Oficial y Medio Oficial.
// Peón NO tiene variante de altura (no realiza ese trabajo).
const CATEGORIAS_ALTURA = [
  {
    categoria: "oficial_altura",
    nombre: "Oficial trabajo en altura",
    jornal: redondear(JORNAL_OFICIAL * (1 + RECARGO_ALTURA)),
  },
  {
    categoria: "medio_oficial_altura",
    nombre: "Medio oficial trabajo en altura",
    jornal: redondear(JORNAL_MEDIO_OFICIAL * (1 + RECARGO_ALTURA)),
  },
];

async function upsertPorCategoria(cats: { categoria: string; nombre: string; jornal: number }[]) {
  let creados = 0;
  let actualizados = 0;

  for (const cat of cats) {
    const existente = await p.categoriaLaboral.findFirst({ where: { categoria: cat.categoria } });
    if (existente) {
      const cambio = existente.jornal !== cat.jornal || existente.nombre !== cat.nombre;
      await p.categoriaLaboral.update({
        where: { id: existente.id },
        data: { jornal: cat.jornal, nombre: cat.nombre },
      });
      if (cambio) {
        console.log(`↻ ${cat.categoria} — "${existente.nombre}" $${existente.jornal} → "${cat.nombre}" $${cat.jornal}`);
        actualizados++;
      } else {
        console.log(`⊘ ${cat.categoria} — sin cambios ($${cat.jornal})`);
      }
    } else {
      await p.categoriaLaboral.create({ data: cat });
      console.log(`✓ ${cat.categoria} — creado ("${cat.nombre}" $${cat.jornal})`);
      creados++;
    }
  }
  return { creados, actualizados };
}

async function main() {
  console.log("=== Categorías simplificadas (flujo obra mediana) ===");
  const r1 = await upsertPorCategoria(CATEGORIAS_SIMPLIFICADAS);

  console.log("\n=== Categorías extendidas con corrimiento corregido ===");
  const r2 = await upsertPorCategoria(CATEGORIAS_EXTENDIDAS_CORREGIDAS);

  console.log("\n=== Compensación por trabajo en altura (10%, Oficial y Medio Oficial) ===");
  const r3 = await upsertPorCategoria(CATEGORIAS_ALTURA);

  console.log("\n=== Categorías completas del laudo SUNCA (obras mayores) ===");
  const r4 = await upsertPorCategoria(CATEGORIAS_LAUDO);

  const total = {
    creados: r1.creados + r2.creados + r3.creados + r4.creados,
    actualizados: r1.actualizados + r2.actualizados + r3.actualizados + r4.actualizados,
  };
  console.log("\n── Resumen ──");
  console.log(`Creados:      ${total.creados}`);
  console.log(`Actualizados: ${total.actualizados}`);
  console.log(`Total categorías procesadas: ${CATEGORIAS_SIMPLIFICADAS.length + CATEGORIAS_EXTENDIDAS_CORREGIDAS.length + CATEGORIAS_ALTURA.length + CATEGORIAS_LAUDO.length}`);

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
