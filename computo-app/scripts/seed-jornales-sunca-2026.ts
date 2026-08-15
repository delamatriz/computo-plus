// Actualiza CategoriaLaboral con los jornales SUNCA vigentes
// (Grupo 9, Subgrupo 01 — Consejos de Salarios, abril 2026 – marzo 2027,
// ajuste +5,17% confirmado en la planilla oficial con membrete SUNCA) y
// Configuracion.convenioFechaVigente.
//
// Fuente: planilla oficial SUNCA provista por el usuario (transcripción
// completa de la tabla "Personal incluido en Ley 14.411").
//
// El set "Excluido de Ley 14.411" de esa misma planilla NO se carga acá a
// propósito — decisión confirmada de mantenerlo solo como referencia
// informativa en /leyes-sociales, sin modelar en la base (ver ese archivo).
//
// Respeta la estructura de 25 registros ya existente (ver
// seed-jornales-sunca-2025.ts): las 12 categorías del laudo
// (sunca_cat_i..xii), 3 alias del flujo simplificado (peon/medio_oficial/
// oficial), 2 corregidas (oficial_especializado/capataz), 2 variantes de
// altura (+10%), y 5 oficios propios de la app nivelados a una categoría
// fija — con un cambio de criterio respecto al año pasado: Plomero y
// Pintor oficial también se nivelan a Categoría VIII (antes ya estaban
// ahí en CategoriaLaboral, sin cambios de fondo en esta tabla; el ajuste
// real de esos dos oficios está en las líneas de ManoObraAPU sueltas con
// valores atípicos $1230/$1180, ver recalcular-jornales-sunca-2026.ts).
//
// Modo dry-run (default): solo muestra qué cambiaría, no escribe nada.
// Modo aplicar: agregar --apply para escribir jornal y convenioFechaVigente.
//
// Ejecutar:
//   npx tsx scripts/seed-jornales-sunca-2026.ts              (dry-run)
//   npx tsx scripts/seed-jornales-sunca-2026.ts --apply       (escribe en DB)

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

const modoAplicar = process.argv.includes("--apply");
const redondear = (n: number) => Math.round(n * 100) / 100;

const RECARGO_ALTURA = 0.10;

// Las 12 categorías oficiales del laudo — valores "incluido Ley 14.411"
// de la planilla oficial SUNCA 2026-2027.
const JORNAL_CAT: Record<string, number> = {
  I: 1634.65,
  II: 1738.31,
  III: 1845.49,
  IV: 2010.64,
  V: 2176.19,
  VI: 2355.11,
  VII: 2537.38,
  VIII: 2910.91,
  IX: 3101.94,
  X: 3290.14,
  XI: 3290.14,
  XII: 3481.35,
};

const CATEGORIAS_LAUDO = [
  { categoria: "sunca_cat_i", nombre: "Peón común", jornal: JORNAL_CAT.I },
  { categoria: "sunca_cat_ii", nombre: "Peón práctico", jornal: JORNAL_CAT.II },
  { categoria: "sunca_cat_iii", nombre: "Ayudante", jornal: JORNAL_CAT.III },
  { categoria: "sunca_cat_iv", nombre: "Medio oficial (inferior)", jornal: JORNAL_CAT.IV },
  { categoria: "sunca_cat_v", nombre: "Medio oficial albañil", jornal: JORNAL_CAT.V },
  { categoria: "sunca_cat_vi", nombre: "Oficial (inferior)", jornal: JORNAL_CAT.VI },
  { categoria: "sunca_cat_vii", nombre: "Oficial albañil", jornal: JORNAL_CAT.VII },
  { categoria: "sunca_cat_viii", nombre: "Oficial especializado", jornal: JORNAL_CAT.VIII },
  { categoria: "sunca_cat_ix", nombre: "Capataz", jornal: JORNAL_CAT.IX },
  { categoria: "sunca_cat_x", nombre: "Capataz general", jornal: JORNAL_CAT.X },
  { categoria: "sunca_cat_xi", nombre: "Capataz general superior", jornal: JORNAL_CAT.XI },
  { categoria: "sunca_cat_xii", nombre: "Maestro mayor de obra", jornal: JORNAL_CAT.XII },
];

// Jornales base del flujo simplificado — Categoría I / V / VII.
const JORNAL_PEON = JORNAL_CAT.I;
const JORNAL_MEDIO_OFICIAL = JORNAL_CAT.V;
const JORNAL_OFICIAL = JORNAL_CAT.VII;

const CATEGORIAS_SIMPLIFICADAS = [
  { categoria: "peon", nombre: "Peón", jornal: JORNAL_PEON },
  { categoria: "medio_oficial", nombre: "Medio oficial", jornal: JORNAL_MEDIO_OFICIAL },
  { categoria: "oficial", nombre: "Oficial albañil", jornal: JORNAL_OFICIAL },
];

const CATEGORIAS_EXTENDIDAS = [
  { categoria: "oficial_especializado", nombre: "Oficial especializado", jornal: JORNAL_CAT.VIII },
  { categoria: "capataz", nombre: "Capataz", jornal: JORNAL_CAT.IX },
];

const CATEGORIAS_ALTURA = [
  { categoria: "oficial_altura", nombre: "Oficial trabajo en altura", jornal: redondear(JORNAL_OFICIAL * (1 + RECARGO_ALTURA)) },
  { categoria: "medio_oficial_altura", nombre: "Medio oficial trabajo en altura", jornal: redondear(JORNAL_MEDIO_OFICIAL * (1 + RECARGO_ALTURA)) },
];

// Oficios propios de la app nivelados a Categoría VIII — Plomero y Pintor
// se agregan acá este año (antes solo electricista/gasista), decisión
// confirmada: "mismo criterio que el resto de los oficios 'oficial'".
const CATEGORIAS_OFICIOS_NIVELADOS = [
  { categoria: "electricista_oficial", nombre: "Electricista oficial", jornal: JORNAL_CAT.VIII },
  { categoria: "oficial_gasista", nombre: "Oficial Gasista", jornal: JORNAL_CAT.VIII },
  { categoria: "plomero_oficial", nombre: "Plomero oficial", jornal: JORNAL_CAT.VIII },
  { categoria: "pintor_oficial", nombre: "Pintor oficial", jornal: JORNAL_CAT.VIII },
  { categoria: "oficial_maquinista", nombre: "Oficial maquinista", jornal: JORNAL_CAT.X },
  { categoria: "oficial_escalerista", nombre: "Oficial escalerista", jornal: JORNAL_CAT.X },
];

const TODAS = [
  ...CATEGORIAS_LAUDO,
  ...CATEGORIAS_SIMPLIFICADAS,
  ...CATEGORIAS_EXTENDIDAS,
  ...CATEGORIAS_ALTURA,
  ...CATEGORIAS_OFICIOS_NIVELADOS,
];

const CONVENIO_FECHA_VIGENTE = new Date("2026-04-01T00:00:00.000Z");

async function main() {
  console.log(modoAplicar ? "=== MODO APLICAR — se va a escribir en la base ===" : "=== MODO DRY-RUN — no se escribe nada ===");
  console.log(`Total categorías a actualizar: ${TODAS.length}\n`);

  const existentes = await p.categoriaLaboral.findMany();
  const porCategoria = new Map(existentes.map((c) => [c.categoria, c]));

  let cambios = 0;
  for (const nueva of TODAS) {
    const actual = porCategoria.get(nueva.categoria);
    if (!actual) {
      console.log(`⚠ NO EXISTE en la base: categoria="${nueva.categoria}" — se crearía nueva con jornal $${nueva.jornal}`);
      cambios++;
      continue;
    }
    if (actual.jornal !== nueva.jornal || actual.nombre !== nueva.nombre) {
      console.log(
        `${modoAplicar ? "✓" : "→"} ${nueva.categoria} ("${actual.nombre}" → "${nueva.nombre}"): ` +
        `$${actual.jornal.toFixed(2)} → $${nueva.jornal.toFixed(2)} ` +
        `(${(((nueva.jornal - actual.jornal) / actual.jornal) * 100).toFixed(2)}%)`
      );
      cambios++;
      if (modoAplicar) {
        await p.categoriaLaboral.update({
          where: { id: actual.id },
          data: { nombre: nueva.nombre, jornal: nueva.jornal },
        });
      }
    }
  }

  console.log(`\nCategorías ${modoAplicar ? "actualizadas" : "que cambiarían"}: ${cambios} de ${TODAS.length}`);

  // Configuracion.convenioFechaVigente
  const config = await p.configuracion.findFirst();
  if (!config) {
    console.log("\n⚠ No existe fila en Configuracion todavía.");
  } else {
    const fechaActual = config.convenioFechaVigente ? config.convenioFechaVigente.toISOString().slice(0, 10) : "(sin fecha)";
    console.log(`\nConvenio vigente: ${fechaActual} → ${CONVENIO_FECHA_VIGENTE.toISOString().slice(0, 10)}`);
    if (modoAplicar) {
      await p.configuracion.update({ where: { id: config.id }, data: { convenioFechaVigente: CONVENIO_FECHA_VIGENTE } });
    }
  }

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
