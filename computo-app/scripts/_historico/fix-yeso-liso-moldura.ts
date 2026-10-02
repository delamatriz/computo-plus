// Fase 2 del bug "clona a $0" — Construcción en seco, sub-tanda 7c:
// Yeso liso y moldura (2 códigos: yeso-001, yeso-005, 1 material
// compartido).
//
// Confirmado ANTES de investigar (per pedido explícito, evitando el
// error de 7a): "Yeso blanco" tenía 0 filas PrecioMTOP preexistentes
// — genuinamente parte del bug, sin colisión. "Arena fina (en obra)"
// (yeso-001) ya resuelve real ($1.167,37/m³, del import original de
// la Lista MTOP), se reutiliza sin tocar.
//
// Sin material mal asignado, sin equipos en ningún APU. Ninguno usado
// en Rubro real de HOGAR/Matisse Monet.
//
// "Yeso blanco" es yeso en polvo para moldear/enlucir (NO la placa
// Durlock ni la masilla para juntas, ya resueltas en 7a — son
// productos distintos, sin riesgo de colisión de texto).
//
// Fuente de precio (USD convertido a $40,85/USD, BROU venta) — gama
// media/estándar:
//  - Yeso blanco: Barraca Paraná, Yeso en polvo Corral, bolsa 40kg,
//    USD 16,86 → $17,22/kg real. Cruzado con Sodimac Uruguay (mismo
//    producto, misma marca Corral, bolsa 40kg, $479 → $11,97/kg) —
//    Sodimac figuraba "producto no disponible momentáneamente"; ambas
//    fuentes confirman el mismo orden de magnitud ($12-17/kg), se
//    prefirió Barraca Paraná por no tener el caveat de stock.
//
// Autocuestionamiento: en ambos códigos el costo está dominado por la
// mano de obra, no por el material (yeso-001: $540,26 MO vs $29,33
// material; yeso-005: $138,39 MO vs $5,17 material). Es coherente —
// son tareas de terminación/detalle (enlucido a mano, moldura
// artesanal) con rendimientos de material bajos (1,5kg/m² y 0,3kg/ml)
// pero mano de obra especializada intensiva, no un error de cálculo.
//
// Sin cambios de mano de obra ni de rendimientos. GG 15% / Utilidad
// 10%, sin leyes sociales.
//
// Ejecutar (dry-run): npx tsx scripts/fix-yeso-liso-moldura.ts
// Ejecutar (real):     npx tsx scripts/fix-yeso-liso-moldura.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;
const USD_UYU = 40.85;

const YESO_BLANCO_KG = (16.86 / 40) * USD_UYU;

type MaterialNuevo = { codigoMTOP: string; descripcion: string; unidad: string; precio: number };
type Def = { codigo: string; materialesNuevos: MaterialNuevo[] };

const DEFS: Def[] = [
  { codigo: "yeso-001", materialesNuevos: [{ codigoMTOP: "MAT-YESO-BLANCO", descripcion: "Yeso blanco", unidad: "kg", precio: YESO_BLANCO_KG }] },
  { codigo: "yeso-005", materialesNuevos: [{ codigoMTOP: "MAT-YESO-BLANCO", descripcion: "Yeso blanco", unidad: "kg", precio: YESO_BLANCO_KG }] },
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
