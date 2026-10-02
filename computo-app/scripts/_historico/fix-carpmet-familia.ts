// Fase 2 del bug "clona a $0" — última sub-tanda de Carpinterías:
// familia carpmet- (6 códigos), cierra la Tanda 1 completa.
//
// Confirmado (sin caso de material mal asignado nuevo): en los 6 el
// material del APU coincide con lo que el código describe. "Tornillos
// y herrajes metálicos" (todos), "Silicona para ventanas" (002/003) y
// "Pintura anticorrosiva"/"Electrodos de soldadura" (005/006) ya
// tenían PrecioMTOP real — no hacía falta investigarlos. Ninguno de
// los 6 usado en Rubro real de HOGAR/Matisse Monet.
//
// Casos con par ya resuelto (confirmado, no reusables tal cual):
//  - carpmet-001 comparte TEXTO EXACTO de material con 7.3.14
//    (desactivado por redundante) — pero 7.3.14 nunca tuvo precio
//    propio, así que carpmet-001 necesita investigación nueva igual.
//  - carpmet-004 (portón CORREDIZO 3.00x2.10m) usa un material
//    distinto al de 7.3.15 (portón BATIENTE 2.40x2.10m,
//    "Portón batiente dos hojas de hierro") — confirmado que no es
//    redundante, se reusa solo la TARIFA POR M² de 7.3.15 (mismo
//    criterio "portón metálico genérico"), no el material en sí.
//  - carpmet-005 (Reja tubular, M2) usa el MISMO material que 7.3.13
//    (Reja, UNI) — "Tubo cuadrado acero 25x25x2mm" — que YA tiene
//    PrecioMTOP real desde el fix de Hierro suelto. No necesitaba
//    investigación: solo recalcular y guardar precioUY con el precio
//    ya existente (hoy en $0 porque nunca se guardó, no porque falte
//    precio de material).
//
// Fuentes de precio (002/003/004/006, sin par resoluble):
//  - carpmet-002/003 (Ventana metálica corrediza 1.20x1.10m /
//    1.50x1.10m): misma familia "ventana de hierro genérico, sin
//    vidrio, sin herrajes" que 7.3.12 — se reusa su tarifa por m²
//    real recién aplicada ($1.386,73/m², Lista MTOP + metraje
//    estimado) escalada a cada tamaño. Mismo nivel de incertidumbre
//    que 7.3.12 (⚠️⚠️, heredada).
//  - carpmet-001 (Puerta metálica chapa plegada 0.90x2.10m): ⚠️⚠️
//    estimación gruesa — peso de chapa Nro.18 (doble cara, 1,2mm)
//    sobre el área frontal × Lista MTOP código 78 "Chapa de hierro
//    decapada Nro.18" $129,24/kg + 25% de margen por marco/refuerzos
//    internos de la puerta plegada (sin fuente de ese margen).
//  - carpmet-004 (Portón metálico corredizo 3.00x2.10m): tarifa por m²
//    de 7.3.15 (portón batiente, $7.539,68/m², ya real) reusada para
//    el panel — corredizo y batiente son construcciones similares en
//    chapa/tubo, sin dato que indique que uno sea más caro que el
//    otro. Riel y guía para portón corredizo: reconstruido con 2
//    componentes en vez del rango genérico de MercadoLibre — (a) 3
//    ruedas de acero con rodamientos y caja (2 de piso + 1 guía
//    superior), Carrasco Import (Montevideo), USD 17,70/u real → 3 ×
//    17,70 × $40,85/USD = $2.169,13; (b) riel/canal embutido de 3m,
//    ⚠️⚠️ sin precio de plaza uruguaya encontrado — estimado por peso
//    (perfil U mediano, ~4kg/ml asumido) × Lista MTOP cód. 203
//    $171,92/kg × 3m = $2.063,04. Total $4.232,17 (subió de la
//    estimación anterior de $3.500).
//  - carpmet-006 (Baranda metálica tubular, ML): CORRECCIÓN DE
//    RENDIMIENTO, no solo de precio — el APU original solo tenía
//    2,5ml de tubo por ml de baranda, consistente ÚNICAMENTE con
//    pasamanos (sin parantes verticales). Una baranda real necesita
//    parantes cada ≤12cm (para que no pase un niño) más los 2
//    pasamanos horizontales (superior + inferior). Recalculado:
//    altura 0,90m × (1/0,12m) parantes/ml = 7,50ml de parantes + 2ml
//    de pasamanos = 9,5ml de tubo por ml de baranda (subió de 2,5).
//    Precio del tubo: 38mm pared 2mm asumida × Lista MTOP código 203
//    $171,92/kg → $305,27/ml. Con el rendimiento corregido, el
//    material converge con CYPE Uruguay "Baranda de hueco de acero"
//    ($3.594,66/ml total, ~$3.235/ml solo materiales) — ya no hay
//    divergencia grande.
//
// Sin cambios de mano de obra en ninguno. GG 15% / Utilidad 10%, sin
// leyes sociales.
//
// Ejecutar (dry-run): npx tsx scripts/fix-carpmet-familia.ts
// Ejecutar (real):     npx tsx scripts/fix-carpmet-familia.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;
const PRECIO_KG_MTOP = 171.92; // Lista MTOP código 203 — ya usado en Hierro suelto
const RATE_VENTANA_HIERRO_M2 = 2135.56 / 1.54; // de 7.3.12, ya aplicado
const RATE_PORTON_M2 = 38000 / (2.4 * 2.1); // de 7.3.15, ya aplicado

type MaterialNuevo = { codigoMTOP: string; descripcion: string; unidad: string; precio: number; rendimientoNuevo?: number };
type Def = {
  codigo: string;
  materialesNuevos: MaterialNuevo[]; // materiales del APU que hoy no tienen precio y necesitan uno
};

const DEFS: Def[] = [
  {
    codigo: "carpmet-001",
    materialesNuevos: [
      {
        codigoMTOP: "MAT-PUERTA-CHAPA-PLEGADA-090210",
        descripcion: "Puerta metálica chapa plegada 0.90x2.10m",
        unidad: "u",
        precio: 2 * (0.9 * 2.1) * (0.0012 * 7850) * 129.24 * 1.25,
      },
    ],
  },
  {
    codigo: "carpmet-002",
    materialesNuevos: [
      {
        codigoMTOP: "MAT-VENTANA-HIERRO-120110",
        descripcion: "Ventana metálica corrediza 1.20x1.10m",
        unidad: "u",
        precio: RATE_VENTANA_HIERRO_M2 * (1.2 * 1.1),
      },
    ],
  },
  {
    codigo: "carpmet-003",
    materialesNuevos: [
      {
        codigoMTOP: "MAT-VENTANA-HIERRO-150110",
        descripcion: "Ventana metálica corrediza 1.50x1.10m",
        unidad: "u",
        precio: RATE_VENTANA_HIERRO_M2 * (1.5 * 1.1),
      },
    ],
  },
  {
    codigo: "carpmet-004",
    materialesNuevos: [
      {
        codigoMTOP: "MAT-PORTON-CORREDIZO-300210",
        descripcion: "Portón metálico corredizo 3.00x2.10m",
        unidad: "u",
        precio: RATE_PORTON_M2 * (3.0 * 2.1),
      },
      {
        codigoMTOP: "MAT-RIEL-GUIA-PORTON-CORREDIZO",
        descripcion: "Riel y guía para portón corredizo",
        unidad: "u",
        precio: 3 * 17.7 * 40.85 + 4 * 3.0 * PRECIO_KG_MTOP, // 3 ruedas Carrasco Import + riel 3m estimado por peso
      },
    ],
  },
  {
    codigo: "carpmet-005",
    materialesNuevos: [], // ya resuelto (mismo Tubo cuadrado 25x25x2mm que 7.3.13) — solo recalcular y guardar
  },
  {
    codigo: "carpmet-006",
    materialesNuevos: [
      {
        codigoMTOP: "MAT-TUBO-REDONDO-38MM",
        descripcion: "Tubo redondo acero 38mm",
        unidad: "ml",
        precio: ((Math.PI * (38 * 38 - 34 * 34)) / 4) * 1e-6 * 7850 * PRECIO_KG_MTOP,
        // rendimiento corregido: 2 pasamanos (2ml) + parantes cada 0.12m x 0.90m alto (7.5ml) = 9.5ml/ml — el original (2.5) solo contaba pasamanos
        rendimientoNuevo: 2 + (1 / 0.12) * 0.9,
      },
    ],
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
      if (nuevo) {
        const precio = Math.round(nuevo.precio * 100) / 100;
        const rendimiento = nuevo.rendimientoNuevo ?? m.rendimiento;
        const nota = nuevo.rendimientoNuevo ? ` (rendimiento corregido de ${m.rendimiento} a ${rendimiento.toFixed(3)})` : "";
        console.log(`  material: ${nuevo.descripcion} — $${precio}/${nuevo.unidad} (${nuevo.codigoMTOP}) × rend ${rendimiento.toFixed(3)}${nota}`);
        sumMat += rendimiento * precio;
        if (aplicar && nuevo.rendimientoNuevo) {
          await db.materialAPUEstandar.update({ where: { id: m.id }, data: { rendimiento: nuevo.rendimientoNuevo } });
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

    if (!aplicar) continue;

    for (const nuevo of def.materialesNuevos) {
      const precio = Math.round(nuevo.precio * 100) / 100;
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

    await db.subrubroEstandar.update({ where: { codigo: def.codigo }, data: { precioUY, fechaBase: FECHA } });
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
