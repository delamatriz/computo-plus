// Fase 2 del bug "clona a $0" — Instalación Eléctrica, sub-tanda 6e
// (última): Porteros eléctricos (2 códigos, Cable para portero
// compartido). Cierra la Tanda 6 (Instalación Eléctrica) por completo.
//
// Confirmado (sin material mal asignado) en los 2. Sin equipos en
// ningún APU. Ninguno usado en Rubro real de HOGAR/Matisse Monet.
//
// Fuentes de precio (USD convertido a $40,85/USD, BROU venta) — gama
// media/estándar, Fivisa (sí tiene línea de porteros junto con
// material eléctrico de obra, como se esperaba):
//  - Portero eléctrico con videocámara: Fivisa, Kit monitor color 7"
//    interior + panel exterior con cámara (P37508), USD 193,69 →
//    $7.912,24/u real — kit completo (monitor + cámara + panel),
//    no componentes sueltos.
//  - Portero eléctrico simple: Fivisa, Kit portero eléctrico TSP 314
//    (P37304), USD 50,24 → $2.052,30/u real — kit completo de audio
//    (citófono interior + panel exterior + fuente), sin video.
//  - Cable para portero: ⚠️ ESTIMACIÓN GRUESA — no se encontró un
//    precio publicado confiable de un cable específico para portero/
//    citófono en el mercado uruguayo (Fivisa no lista el cable
//    telefónico/portero de 4 hilos con precio propio). Estimado en
//    $20/ml, en la misma banda que otros cables de baja tensión ya
//    usados en este capítulo (Cable UTP $21,20/ml real, Cable para
//    alarma $18/ml estimado en la sub-tanda 6c) — un portero necesita
//    algo más de sección que un cable de alarma puro por la corriente
//    de la cerradura eléctrica, de ahí quedar un escalón arriba.
//
// Verificación pedida por el usuario — ¿el diferencial con/sin
// videocámara está justificado?: SÍ. El kit con video cuesta 3,86x
// el simple (USD 193,69 vs USD 50,24) — la diferencia real es que el
// kit con video agrega una pantalla color de 7" y una cámara con
// visión nocturna en el panel exterior (hardware y electrónica de
// video), mientras que el simple es solo audio (citófono + pulsador).
// Un salto de casi 4x es razonable para esa diferencia de
// complejidad, no es un margen arbitrario de marca.
//
// Sin cambios de mano de obra ni de rendimientos. GG 15% / Utilidad
// 10%, sin leyes sociales.
//
// Ejecutar (dry-run): npx tsx scripts/fix-electrica-porteros.ts
// Ejecutar (real):     npx tsx scripts/fix-electrica-porteros.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;
const USD_UYU = 40.85;

const PORTERO_VIDEO_U = 193.69 * USD_UYU;
const PORTERO_SIMPLE_U = 50.24 * USD_UYU;
// ⚠️ ESTIMACIÓN GRUESA — sin fuente de mercado uruguayo verificada
// (ver header). Revisar si en el futuro aparece un precio publicado
// confiable de un proveedor eléctrico/de seguridad.
const CABLE_PORTERO_ML = 20;

type MaterialNuevo = { codigoMTOP: string; descripcion: string; unidad: string; precio: number };
type Def = { codigo: string; materialesNuevos: MaterialNuevo[] };

const DEFS: Def[] = [
  {
    codigo: "electrica-011",
    materialesNuevos: [
      { codigoMTOP: "MAT-PORTERO-CON-VIDEO", descripcion: "Portero eléctrico con videocámara", unidad: "u", precio: PORTERO_VIDEO_U },
      { codigoMTOP: "MAT-CABLE-PORTERO", descripcion: "Cable para portero", unidad: "ml", precio: CABLE_PORTERO_ML },
    ],
  },
  {
    codigo: "electrica-012",
    materialesNuevos: [
      { codigoMTOP: "MAT-PORTERO-SIMPLE", descripcion: "Portero eléctrico simple", unidad: "u", precio: PORTERO_SIMPLE_U },
      { codigoMTOP: "MAT-CABLE-PORTERO", descripcion: "Cable para portero", unidad: "ml", precio: CABLE_PORTERO_ML },
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
