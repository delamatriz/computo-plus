// Fase 2 del bug "clona a $0" — Construcción en seco, sub-tanda 7b:
// Steel Framing (2 códigos: 8.1.1, 8.1.2). Cierra Steel Framing 2/2 y
// deja pendiente en "Sistemas No Tradicionales" solo "Paneles
// Térmicos" (subcapítulo no tocado en esta tanda).
//
// Confirmado ANTES de investigar (per pedido explícito, evitando el
// error de 7a): "Tornillos autoperforantes steel framing", "Perfil
// galvanizado steel framing" y "Placa OSB para steel framing" NO
// tenían ninguna fila PrecioMTOP preexistente — 0 matches en los 3,
// genuinamente parte del bug, sin colisión. "Lana de vidrio aislante"
// SÍ existe (MAT-LANA-VIDRIO, $138,84/m², cargado en la sub-tanda 7a)
// y 8.1.2 la resuelve correctamente sin tocarla.
//
// Sin equipos en ningún APU. Ninguno usado en Rubro real de HOGAR/
// Matisse Monet.
//
// Fuentes de precio (USD convertido a $40,85/USD, BROU venta) — gama
// media/estándar:
//  - Perfil galvanizado steel framing: **Barraca Paraná** (verificado
//    contra EMAT antes de decidir — ver abajo), Perfil PGC (montante)
//    150mm x 6m, calibre 18, línea steel framing estructural
//    (DISTINTO del perfil liviano 35/70mm de yeso usado en 7a), USD
//    55,25 → $376,16/ml real.
//    Verificación de precio pedida por el usuario: EMAT lista el
//    MISMO producto exacto (150mm, cal 18, 6m) a USD 75,51 pero
//    figuraba "Agotado". Se cruzó con Barraca Paraná (especialista
//    dedicado en steel framing, con sección propia del rubro) para el
//    mismo spec exacto — USD 55,25, sin caveat de agotado. Ambas
//    fuentes confirman el mismo orden de magnitud (USD 55-75 por
//    barra de 6m ≈ $9-12,5/ml), descartando que EMAT fuera un precio
//    desactualizado o un error de escala — pero se prefirió Barraca
//    Paraná por ser especialista del rubro y no tener el problema de
//    stock.
//  - Placa OSB para steel framing: Sodimac Uruguay, Masisa OSB Home
//    E1, 11,1mm, 1,22x2,44m (2,97 m²), $1.019 → $342,31/m² real.
//  - Tornillos autoperforantes steel framing: ⚠️ ESTIMACIÓN GRUESA —
//    no se encontró un tornillo "punta broca" (para metal grueso)
//    con precio propio en Uruguay. Cuenta explícita del margen
//    aplicado (pedida por el usuario): base $0,74/u (tornillo "T1
//    flange punta aguja" de EMAT para construcción en seco, USD
//    1,82/100u) + 35% por la mayor robustez del punta broca (para
//    perforar chapa galvanizada estructural) frente al punta aguja
//    (para chapa fina de yeso) = $0,74 × 1,35 = $0,999 ≈ $1,00/u.
//  - Lana de vidrio aislante (8.1.2): YA RESUELTO en la sub-tanda 7a
//    — $138,84/m² (Sodimac, Isover) — se reutiliza sin tocar.
//
// Autocuestionamiento pedido por el usuario: el perfil steel framing
// ($376,16/ml) sale ~7x más caro que el perfil liviano de yeso de
// 7a ($49,84-55,69/ml). Es coherente: el PGC 150mm es calibre 18
// (chapa gruesa estructural) y 150mm de ancho, contra un perfil de
// yeso de calibre fino (~26) y 35-70mm de ancho — más del doble de
// ancho y una chapa mucho más gruesa explican un salto de varias
// veces el precio, no es un error.
//
// Sin cambios de mano de obra ni de rendimientos. GG 15% / Utilidad
// 10%, sin leyes sociales.
//
// Ejecutar (dry-run): npx tsx scripts/fix-steel-framing.ts
// Ejecutar (real):     npx tsx scripts/fix-steel-framing.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;
const USD_UYU = 40.85;

const PERFIL_STEEL_ML = (55.25 / 6) * USD_UYU;
const PLACA_OSB_M2 = 1019 / (1.22 * 2.44);
// ⚠️ ESTIMACIÓN GRUESA — sin fuente de mercado uruguayo verificada
// para el tornillo punta broca específico (ver header). Base $0,74/u
// (T1 aguja EMAT) + 35% de margen por mayor robustez = $1,00/u.
// Revisar si en el futuro Sodimac/EMAT/Barraca publica precio propio.
const TORNILLO_AGUJA_BASE_U = (1.82 / 100) * USD_UYU;
const MARGEN_PUNTA_BROCA = 0.35;
const TORNILLOS_STEEL_U = Math.round(TORNILLO_AGUJA_BASE_U * (1 + MARGEN_PUNTA_BROCA) * 100) / 100;

type MaterialNuevo = { codigoMTOP: string; descripcion: string; unidad: string; precio: number };
type Def = { codigo: string; materialesNuevos: MaterialNuevo[] };

const DEFS: Def[] = [
  {
    codigo: "8.1.1",
    materialesNuevos: [
      { codigoMTOP: "MAT-PERFIL-STEEL-FRAMING", descripcion: "Perfil galvanizado steel framing", unidad: "ml", precio: PERFIL_STEEL_ML },
      { codigoMTOP: "MAT-PLACA-OSB-STEEL", descripcion: "Placa OSB para steel framing", unidad: "m2", precio: PLACA_OSB_M2 },
      { codigoMTOP: "MAT-TORNILLOS-STEEL-FRAMING", descripcion: "Tornillos autoperforantes steel framing", unidad: "u", precio: TORNILLOS_STEEL_U },
    ],
  },
  {
    codigo: "8.1.2",
    materialesNuevos: [
      { codigoMTOP: "MAT-PERFIL-STEEL-FRAMING", descripcion: "Perfil galvanizado steel framing", unidad: "ml", precio: PERFIL_STEEL_ML },
      { codigoMTOP: "MAT-PLACA-OSB-STEEL", descripcion: "Placa OSB para steel framing", unidad: "m2", precio: PLACA_OSB_M2 },
      { codigoMTOP: "MAT-TORNILLOS-STEEL-FRAMING", descripcion: "Tornillos autoperforantes steel framing", unidad: "u", precio: TORNILLOS_STEEL_U },
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
  const todosEquipos = await db.precioEquipo.findMany();
  const resolverCostoEquipo = (desc: string) =>
    todosEquipos.find((e) => e.descripcion.toLowerCase().includes(desc.toLowerCase()))?.precioHora ?? 0;

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

    const sumEq = s.apuEstandar.equipos.reduce((acc, eq) => {
      const costo = resolverCostoEquipo(eq.descripcion);
      console.log(`  Equipo: ${eq.descripcion} — $${costo}/${eq.unidad} (ya real, sin cambios) × rend ${eq.rendimiento}`);
      return acc + eq.rendimiento * costo;
    }, 0);
    if (s.apuEstandar.equipos.length === 0) {
      console.log(`  (sin equipos)`);
    }

    const costoDirecto = sumMat + sumMO + sumEq;
    const precioUY = Math.round(costoDirecto * (1 + GG_PCT / 100) * (1 + UTIL_PCT / 100) * 100) / 100;

    console.log(`  sumMat=$${sumMat.toFixed(2)} sumMO=$${sumMO.toFixed(2)} sumEq=$${sumEq.toFixed(2)} costoDirecto=$${costoDirecto.toFixed(2)}`);
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
