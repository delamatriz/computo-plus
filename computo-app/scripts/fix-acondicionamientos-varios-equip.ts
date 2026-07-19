// Fase 2 del bug "clona a $0" — Tanda 3 (Subcontratos -
// Acondicionamientos), sub-tanda 3c: Varios de Equipamiento (6
// códigos, cierra el subcapítulo Equipamiento por completo).
//
// Confirmado (sin material mal asignado): en los 6 el material del
// APU coincide con lo que el código describe. Ninguno usado en Rubro
// real de HOGAR/Matisse Monet.
//
// Hallazgo: "Caño PVC ventilación 110mm" (equip-003) no matcheaba con
// nada, pero es el MISMO caño físico que "Caño PVC desagüe 110mm"
// ($350/ml, ya real) — mismo diámetro/material, solo cambia el uso
// (ventilación vs. desagüe). Se renombra, sin investigar de cero.
//
// Fuentes de precio (USD convertido a $40,85/USD, BROU venta) — gama
// media/estándar, no premium:
//  - Calefón a gas 13L: Sodimac Uruguay, Bosch (único match exacto de
//    13L en catálogo), USD 495 real.
//  - Termotanque eléctrico 80L: Sodimac Uruguay, promedio de 4 modelos
//    gama media (Brilliant/Enxuta/Hyundai/Smartlife, USD 241-279) →
//    USD 260.
//  - Extractor de cocina: Sodimac Uruguay, Cata Profesional 500, USD
//    129 (entre el básico Soler y Palau USD 99 y el premium USD 219).
//  - Accesorios instalación calefón/termotanque: ⚠️ sin fuente puntual,
//    estimación $900/gl cada uno.
//  - Panel piso técnico / Pedestal regulable: ⚠️⚠️ se confirmaron 4
//    proveedores reales en Uruguay (Improtel, Verona, Just Crea,
//    Tecnomadera) pero ninguno publica precio — estimación gruesa
//    USD 90/m² y USD 12/u respectivamente.
//  - Cortina blackout manual: Anne Decor, $5.200/ml de ancho
//    (confección a medida, hasta 2,60m de alto) → derivado a
//    $2.000/m².
//  - Riel para cortina: Sodimac Uruguay, Bemaor, extensible
//    160-290cm $1.089 → ~$480/ml.
//  - Cortina veneciana interior: Bork, lama 25mm (estándar, no la
//    premium de 50mm), $2.000/m² con descuento vigente — baja fuerte
//    frente al valor SAU 2022 ($11.226,60), que probablemente
//    reflejaba una veneciana premium o un criterio de costo distinto.
//
// Sin cambios de mano de obra. GG 15% / Utilidad 10%, sin leyes
// sociales.
//
// Ejecutar (dry-run): npx tsx scripts/fix-acondicionamientos-varios-equip.ts
// Ejecutar (real):     npx tsx scripts/fix-acondicionamientos-varios-equip.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;
const USD_UYU = 40.85;

const CALEFON_U = 495 * USD_UYU;
const ACC_CALEFON_GL = 900;
const TERMOTANQUE_U = 260 * USD_UYU;
const ACC_TERMOTANQUE_GL = 900;
const EXTRACTOR_U = 129 * USD_UYU;
const PANEL_PISO_TECNICO_M2 = 90 * USD_UYU;
const PEDESTAL_PISO_TECNICO_U = 12 * USD_UYU;
const CORTINA_BLACKOUT_M2 = 2000;
const RIEL_CORTINA_ML = 480;
const CORTINA_VENECIANA_M2 = 2000;

type MaterialNuevo = { codigoMTOP: string; descripcion: string; unidad: string; precio: number };
type RenombreSolo = { origenDescripcion: string; descripcion: string };
type Def = { codigo: string; materialesNuevos: MaterialNuevo[]; renombresSolo?: RenombreSolo[] };

const DEFS: Def[] = [
  {
    codigo: "equip-001",
    materialesNuevos: [
      { codigoMTOP: "MAT-CALEFON-GAS-13L", descripcion: "Calefón a gas 13 litros", unidad: "u", precio: CALEFON_U },
      { codigoMTOP: "MAT-ACC-INST-CALEFON", descripcion: "Accesorios instalación calefón", unidad: "gl", precio: ACC_CALEFON_GL },
    ],
  },
  {
    codigo: "equip-002",
    materialesNuevos: [
      { codigoMTOP: "MAT-TERMOTANQUE-ELEC-80L", descripcion: "Termotanque eléctrico 80 litros", unidad: "u", precio: TERMOTANQUE_U },
      { codigoMTOP: "MAT-ACC-INST-TERMOTANQUE", descripcion: "Accesorios instalación termotanque", unidad: "gl", precio: ACC_TERMOTANQUE_GL },
    ],
  },
  {
    codigo: "equip-003",
    materialesNuevos: [{ codigoMTOP: "MAT-EXTRACTOR-COCINA", descripcion: "Extractor de cocina", unidad: "u", precio: EXTRACTOR_U }],
    renombresSolo: [{ origenDescripcion: "Caño PVC ventilación 110mm", descripcion: "Caño PVC desagüe 110mm" }],
  },
  {
    codigo: "7.2.18",
    materialesNuevos: [
      { codigoMTOP: "MAT-PANEL-PISO-TECNICO", descripcion: "Panel piso técnico", unidad: "m2", precio: PANEL_PISO_TECNICO_M2 },
      { codigoMTOP: "MAT-PEDESTAL-PISO-TECNICO", descripcion: "Pedestal regulable para piso técnico", unidad: "u", precio: PEDESTAL_PISO_TECNICO_U },
    ],
  },
  {
    codigo: "7.2.21",
    materialesNuevos: [
      { codigoMTOP: "MAT-CORTINA-BLACKOUT", descripcion: "Cortina blackout manual", unidad: "m2", precio: CORTINA_BLACKOUT_M2 },
      { codigoMTOP: "MAT-RIEL-CORTINA", descripcion: "Riel para cortina", unidad: "ml", precio: RIEL_CORTINA_ML },
    ],
  },
  {
    codigo: "7.2.22",
    materialesNuevos: [{ codigoMTOP: "MAT-CORTINA-VENECIANA-INT", descripcion: "Cortina veneciana interior", unidad: "m2", precio: CORTINA_VENECIANA_M2 }],
  },
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
      const renombreSolo = def.renombresSolo?.find((r) => m.descripcion === r.origenDescripcion || m.descripcion === r.descripcion);

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
      } else if (renombreSolo) {
        const precio = resolverPrecioExistente(renombreSolo.descripcion);
        console.log(`  material: ${renombreSolo.descripcion} — $${precio}/${m.unidad} (renombrado desde "${renombreSolo.origenDescripcion}", ya real, sin PrecioMTOP nuevo) × rend ${m.rendimiento}`);
        sumMat += m.rendimiento * precio;

        if (aplicar && m.descripcion === renombreSolo.origenDescripcion) {
          await db.materialAPUEstandar.update({ where: { id: m.id }, data: { descripcion: renombreSolo.descripcion } });
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
