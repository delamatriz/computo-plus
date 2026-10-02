// Fase 2 del bug "clona a $0" — Tanda 4 (Instalación Sanitaria),
// sub-tanda 4a: Cañerías + cámara de inspección (5 códigos, 2
// materiales compartidos).
//
// Confirmado (sin material mal asignado): en los 5 el material del
// APU coincide con lo que el código describe. Ninguno usado en Rubro
// real de HOGAR/Matisse Monet.
//
// Fuentes de precio:
//  - Tapa y contratapa hierro fundido 60x60cm (compartido 7.2.8/
//    sanitaria-014): EMAT (Uruguay), suma de 2 componentes reales —
//    contratapa desde $186,29 + tapa reforzada (punto medio del rango
//    real $186,29-$1.219,90 según capacidad de carga, ~$700) →
//    $886,29. Combinación de 2 SKU, no un set único encontrado.
//  - Sifón desconector: Todoobra.com.uy, REDI, 110mm "con registro"
//    (acceso de limpieza) — $4.258,53 c/IVA, real. Reemplaza una
//    primera estimación de 160mm ($161,58, EMAT) que resultó ser de
//    un componente suelto, no la unidad completa de 110mm que en
//    realidad necesita el código (diámetro típico de desagüe cloacal
//    residencial en Uruguay).
//  - Caño PVC presión 20mm: Gianni S.A. (Uruguay), tubo PVC soldable
//    20mm PN12 con junta elástica, 6m, USD 8 → USD 1,33/ml → $54,33/ml
//    real. Es soldable (no roscable), pero el costo del caño en sí no
//    cambia por el método de unión — mismo producto de presión para
//    agua fría. Reemplaza una estimación gruesa inicial de $45/ml.
//  - Caño acero galvanizado 1/2": interpolado entre dos diámetros
//    reales confirmados (3/4" Sodimac $110,67/ml, 1-1/4" Casa Korman
//    $221,33/ml), escalando hacia abajo con el mismo criterio.
//  - Caño acero galvanizado 3/4": Sodimac Uruguay, real, $332/3m →
//    $110,67/ml.
//
// Sin cambios de mano de obra. GG 15% / Utilidad 10%, sin leyes
// sociales.
//
// Ejecutar (dry-run): npx tsx scripts/fix-sanitaria-canerias.ts
// Ejecutar (real):     npx tsx scripts/fix-sanitaria-canerias.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;
const USD_UYU = 40.85;

const TAPA_CONTRATAPA_U = 186.29 + 700;
const SIFON_DESCONECTOR_110_U = 4258.53;
const CANO_PVC_20MM_ML = 1.33 * USD_UYU;
const CANO_GALV_12_ML = 83;
const CANO_GALV_34_ML = 110.67;

type MaterialNuevo = { codigoMTOP: string; descripcion: string; unidad: string; precio: number };
type Def = { codigo: string; materialesNuevos: MaterialNuevo[] };

const DEFS: Def[] = [
  { codigo: "7.2.8", materialesNuevos: [{ codigoMTOP: "MAT-TAPA-CONTRATAPA-6060", descripcion: "Tapa y contratapa hierro fundido 60x60cm", unidad: "u", precio: TAPA_CONTRATAPA_U }] },
  {
    codigo: "sanitaria-014",
    materialesNuevos: [
      { codigoMTOP: "MAT-TAPA-CONTRATAPA-6060", descripcion: "Tapa y contratapa hierro fundido 60x60cm", unidad: "u", precio: TAPA_CONTRATAPA_U },
      { codigoMTOP: "MAT-SIFON-DESCONECTOR-110", descripcion: "Sifón desconector", unidad: "u", precio: SIFON_DESCONECTOR_110_U },
    ],
  },
  { codigo: "sanitaria-001", materialesNuevos: [{ codigoMTOP: "MAT-CANO-PVC-PRESION-20", descripcion: "Caño PVC presión 20mm", unidad: "ml", precio: CANO_PVC_20MM_ML }] },
  { codigo: "sanitaria-004", materialesNuevos: [{ codigoMTOP: "MAT-CANO-GALV-12", descripcion: "Caño acero galvanizado 1/2 pulgada", unidad: "ml", precio: CANO_GALV_12_ML }] },
  { codigo: "sanitaria-005", materialesNuevos: [{ codigoMTOP: "MAT-CANO-GALV-34", descripcion: "Caño acero galvanizado 3/4 pulgada", unidad: "ml", precio: CANO_GALV_34_ML }] },
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
      include: { apuEstandar: { include: { materiales: true, manoObra: true } } },
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
