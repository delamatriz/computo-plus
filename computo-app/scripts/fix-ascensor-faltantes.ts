// Fase 2 del bug "clona a $0" — Ascensor, sub-tanda 11a (ÚNICA del
// capítulo): 2 códigos (7.2.30, 7.2.31), sin apalancamiento entre sí.
//
// Confirmado ANTES de investigar (chequeo de duplicados): "Ascensor 8
// personas 12 paradas" y "Ascensor 6 personas 5 paradas" tenían 0
// filas PrecioMTOP preexistentes, sin colisión. Ya existe una familia
// real de 5 ascensores "instalados" (4p/4par, 6p/8par, 8p/6par,
// 10p/8par, camillero 10p/6par) sembrada en otra tanda (no relacionada
// al bug) — ninguna de esas 5 filas coincide en combinación
// capacidad+paradas con los 2 códigos afectados, por eso no
// colisionan ni resuelven.
//
// Metodología — regresión lineal sobre los 5 puntos reales
// (personas, paradas) -> precio, separando el efecto de cada
// variable (pedido explícito): Material = a + b×paradas + c×personas.
// Resuelto con 3 de los 5 puntos y verificado contra los 5:
//   a (intercepto) = -$138.390,49
//   b (por parada adicional) = $9.778,69
//   c (por persona adicional de capacidad) = $168.460,26
// Ajuste PERFECTO contra los 5 puntos reales (diferencia de centavos,
// redondeo de punto flotante) — incluida la variante camillero, que
// resulta ENCAJAR en el mismo modelo sin premium adicional pese a ser
// "uso hospitalario/PH" (posible que el precio de catálogo no
// diferencie cabina reforzada, o que el premium ya esté
// implícitamente contemplado en la capacidad nominal "10 personas").
// La capacidad domina el costo (~17x más que una parada adicional),
// coherente con que una cabina mayor exige motor/cableado/estructura
// de puertas más grandes en TODAS las paradas, mientras que una
// parada extra solo agrega botonera/nivelación en un punto.
//
// Con este modelo:
//   7.2.30 (8 personas, 12 paradas): material = $1.326.635,87
//   7.2.31 (6 personas, 5 paradas): material = $921.264,52
//
// HALLAZGO DE VALIDACIÓN CRUZADA: al pasar estos 2 materiales por la
// fórmula del APU (MO fija de "Oficial especializado" rend=0.02, GG
// 15%/Util 10%), el precioUY resultante coincide CASI EXACTO con el
// precioUY viejo ya guardado (sau_ago2022, nunca recalculado):
//   7.2.30: modelo $1.853.258,36 vs guardado $1.853.258,40
//   7.2.31: modelo $1.340.463,60 vs guardado $1.340.463,60
// ⚠️ NOTA IMPORTANTE (aclaración pedida explícitamente): esto es una
// COINCIDENCIA QUE REFUERZA la confianza en el modelo, NO una
// validación externa independiente. No se descarta que el precio 2022
// haya influido en la carga posterior de la familia de 5 puntos
// reales (ej. si quien sembró esa familia usó el rubro 2022 como
// referencia de calibración). No es una segunda fuente de mercado
// distinta — es la misma línea de datos vista desde dos ángulos.
//
// Sin cambios de mano de obra ni de rendimientos. GG 15% / Utilidad
// 10%, sin leyes sociales.
//
// Ejecutar (dry-run): npx tsx scripts/fix-ascensor-faltantes.ts
// Ejecutar (real):     npx tsx scripts/fix-ascensor-faltantes.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;

const MODELO_INTERCEPTO = -138390.49;
const MODELO_POR_PARADA = 9778.69;
const MODELO_POR_PERSONA = 168460.26;
const precioAscensor = (personas: number, paradas: number) =>
  Math.round((MODELO_INTERCEPTO + MODELO_POR_PARADA * paradas + MODELO_POR_PERSONA * personas) * 100) / 100;

const ASCENSOR_8P_12PAR = precioAscensor(8, 12);
const ASCENSOR_6P_5PAR = precioAscensor(6, 5);

type MaterialNuevo = { codigoMTOP: string; descripcion: string; unidad: string; precio: number };
type Def = { codigo: string; materialesNuevos: MaterialNuevo[] };

const DEFS: Def[] = [
  { codigo: "7.2.30", materialesNuevos: [{ codigoMTOP: "MAT-ASC-8P-12PAR", descripcion: "Ascensor 8 personas 12 paradas", unidad: "gl", precio: ASCENSOR_8P_12PAR }] },
  { codigo: "7.2.31", materialesNuevos: [{ codigoMTOP: "MAT-ASC-6P-5PAR", descripcion: "Ascensor 6 personas 5 paradas", unidad: "gl", precio: ASCENSOR_6P_5PAR }] },
];

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);

  const categoriasLaborales = await db.categoriaLaboral.findMany();
  const jornalPorNombre = (nombre: string) =>
    categoriasLaborales.find((c) => c.nombre.trim().toLowerCase() === nombre.trim().toLowerCase())?.jornal ?? 0;
  const todosPrecios = await db.precioMTOP.findMany();
  const resolverPrecioExistente = (desc: string) =>
    todosPrecios.find((p) => p.descripcion.toLowerCase().includes(desc.toLowerCase()))?.precioUnitario ?? 0;

  for (const def of DEFS) {
    const s = await db.subrubroEstandar.findFirst({
      where: { codigo: def.codigo },
      include: { apuEstandar: { include: { materiales: true, manoObra: true, equipos: true } } },
    });
    if (!s || !s.apuEstandar) {
      console.error(`${def.codigo}: no encontrado — abortando.`);
      continue;
    }

    console.log(`\n${def.codigo} — ${s.descripcion}`);
    let sumMat = 0;

    for (const m of s.apuEstandar.materiales) {
      const nuevo = def.materialesNuevos.find((n) => n.descripcion.toLowerCase() === m.descripcion.toLowerCase());
      if (nuevo) {
        const precio = Math.round(nuevo.precio * 100) / 100;
        console.log(`  material: ${nuevo.descripcion} — $${precio}/${nuevo.unidad} (${nuevo.codigoMTOP}) × rend ${m.rendimiento}`);
        sumMat += m.rendimiento * precio;

        if (aplicar) {
          await db.precioMTOP.upsert({
            where: { codigo: nuevo.codigoMTOP },
            create: {
              codigo: nuevo.codigoMTOP,
              descripcion: nuevo.descripcion,
              cantidadUnidad: `1 ${nuevo.unidad}`,
              unidad: nuevo.unidad,
              cantidad: 1,
              precioConIva: precio,
              precioUnitario: precio,
              numeroLista: 0,
              fechaLista: FECHA,
            },
            update: { precioUnitario: precio, precioConIva: precio },
          });
        }
      } else {
        const precio = resolverPrecioExistente(m.descripcion);
        console.log(`  material: ${m.descripcion} — $${precio}/${m.unidad} (ya real, sin cambios) × rend ${m.rendimiento}`);
        sumMat += m.rendimiento * precio;
      }
    }

    const sumMO = s.apuEstandar.manoObra.reduce((acc, mo) => {
      const jornal = jornalPorNombre(mo.categoria);
      console.log(`  MO: ${mo.categoria} — rendimiento ${mo.rendimiento} U/jornada (sin cambios)`);
      return acc + jornal / mo.rendimiento;
    }, 0);

    if (s.apuEstandar.equipos.length === 0) console.log(`  (sin equipos)`);

    const costoDirecto = sumMat + sumMO;
    const precioUY = Math.round(costoDirecto * (1 + GG_PCT / 100) * (1 + UTIL_PCT / 100) * 100) / 100;

    console.log(`  sumMat=$${sumMat.toFixed(2)} sumMO=$${sumMO.toFixed(2)} costoDirecto=$${costoDirecto.toFixed(2)}`);
    console.log(`  precioUY actual: $${s.precioUY} (fechaBase ${s.fechaBase}) → NUEVO: $${precioUY}`);

    if (aplicar) {
      await db.subrubroEstandar.update({ where: { codigo: def.codigo }, data: { precioUY, fechaBase: FECHA } });
    }
  }

  if (!aplicar) {
    console.log("\nDry-run — nada se escribió.");
  } else {
    console.log("\nAplicado.");
  }
  await db.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await db.$disconnect();
  process.exit(1);
});
