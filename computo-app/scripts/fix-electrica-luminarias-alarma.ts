// Fase 2 del bug "clona a $0" — Instalación Eléctrica, sub-tanda 6c:
// Luminarias + Alarma (3 códigos, sin apalancamiento entre sí).
//
// Confirmado (sin material mal asignado) en los 3. Sin equipos en
// ningún APU. Ninguno usado en Rubro real de HOGAR/Matisse Monet.
//
// Fuentes de precio (USD convertido a $40,85/USD, BROU venta) — gama
// media/estándar:
//  - Luminaria embutida LED: Fivisa, Philips Lighting PH9724X,
//    downlight LED redondo 22W 2000lm 4000k ø295mm, USD 6,22 →
//    $254,09/u real. Se evitó el panel LED IP65 35W (USD 193, gama muy
//    superior, uso comercial/exterior) y el spot genérico de USD 1,79
//    (demasiado básico/sin marca para "gama estándar").
//  - Luminaria colgante: Sodimac Uruguay, Casa Bonita, lámpara de
//    techo colgante blanca 1 luz E27, $934 real. Se evitó el
//    portalámpara desnudo ($229, muy básico) y las líneas premium
//    (Ziv Lighting, Dense, Faroluz $1.500-3.200).
//  - Central de alarma: Security Store Uruguay (especializada en
//    seguridad electrónica, no Fivisa/Sodimac como pidió el usuario),
//    Paradox SP4000, panel hasta 32 zonas cableadas/inalámbricas, USD
//    52,50 → $2.144,63/u real — modelo de entrada de una marca
//    reconocida en el rubro (Paradox), gama estándar residencial.
//  - Sensores de movimiento: SVIDEO Uruguay (especializada en
//    seguridad electrónica), sensor volumétrico PIR wireless FSK433
//    (MC-565RF), USD 31,00 → $1.266,35/u real.
//  - Cable para alarma: ⚠️ ESTIMACIÓN GRUESA — no se encontró un
//    precio publicado confiable en el mercado uruguayo (Security
//    Store lista varios cables de alarma de 5/6/7 hilos pero bloquea
//    el acceso directo a la ficha de precio; ningún otro proveedor
//    uruguayo mostró precio claro). Estimado en $18/ml, por debajo del
//    cable eléctrico de potencia 2.5mm ($26,07/ml, real, Fivisa) — un
//    cable de señal/baja tensión de 4 hilos usa conductores mucho más
//    finos (típico 22-24 AWG) que un conductor de potencia de 2,5mm²,
//    así que un precio menor es coherente con el criterio de obra.
//
// Autocuestionamiento pedido por el usuario: el material de
// electrica-007 (alarma) está dominado por los 4 sensores ($5.065,40,
// 64% del material) más que por la central ($2.144,63, 27%) — es
// razonable, un sistema perimetral típico usa varios sensores para
// cubrir el perímetro con una sola central.
//
// Sin cambios de mano de obra ni de rendimientos. GG 15% / Utilidad
// 10%, sin leyes sociales.
//
// Ejecutar (dry-run): npx tsx scripts/fix-electrica-luminarias-alarma.ts
// Ejecutar (real):     npx tsx scripts/fix-electrica-luminarias-alarma.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;
const USD_UYU = 40.85;

const LUMINARIA_EMBUTIDA_LED_U = 6.22 * USD_UYU;
const LUMINARIA_COLGANTE_U = 934;
const CENTRAL_ALARMA_U = 52.5 * USD_UYU;
const SENSOR_MOVIMIENTO_U = 31.0 * USD_UYU;
// ⚠️ ESTIMACIÓN GRUESA — sin fuente de mercado uruguayo verificada
// (ver header). Revisar si en el futuro aparece un precio publicado
// confiable de un proveedor de seguridad electrónica.
const CABLE_ALARMA_ML = 18;

type MaterialNuevo = { codigoMTOP: string; descripcion: string; unidad: string; precio: number };
type Def = { codigo: string; materialesNuevos: MaterialNuevo[] };

const DEFS: Def[] = [
  { codigo: "electrica-005", materialesNuevos: [{ codigoMTOP: "MAT-LUMINARIA-EMBUTIDA-LED", descripcion: "Luminaria embutida LED", unidad: "u", precio: LUMINARIA_EMBUTIDA_LED_U }] },
  { codigo: "electrica-006", materialesNuevos: [{ codigoMTOP: "MAT-LUMINARIA-COLGANTE", descripcion: "Luminaria colgante", unidad: "u", precio: LUMINARIA_COLGANTE_U }] },
  {
    codigo: "electrica-007",
    materialesNuevos: [
      { codigoMTOP: "MAT-CENTRAL-ALARMA", descripcion: "Central de alarma", unidad: "u", precio: CENTRAL_ALARMA_U },
      { codigoMTOP: "MAT-SENSOR-MOVIMIENTO", descripcion: "Sensores de movimiento", unidad: "u", precio: SENSOR_MOVIMIENTO_U },
      { codigoMTOP: "MAT-CABLE-ALARMA", descripcion: "Cable para alarma", unidad: "ml", precio: CABLE_ALARMA_ML },
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
