// Fase 2 del bug "clona a $0" — Tanda 3 (Subcontratos -
// Acondicionamientos), sub-tanda 3a: Sanitarios y grifería (4
// códigos). Incluye de paso el fix de jardin-002b (Obra
// Exterior/Jardín) — puro fix de género gramatical, sin investigación.
//
// Confirmado (sin material mal asignado): en los 4 sanitarios el
// material del APU coincide con lo que el código describe (conjuntos
// GL que agrupan varias piezas, igual que el original SAU). Ninguno
// usado en Rubro real de HOGAR/Matisse Monet.
//
// jardin-002b: el material "Chapa de hierro galvanizadA, ondulada,
// Nro. 24..." no matcheaba con la Lista MTOP código 75 "Chapa de
// hierro galvanizadO, ondulada, Nro. 24..." ($463,57/kg, ya real, el
// mismo ancla usada en el fix de Chapa de Carpinterías) por pura
// discordancia de género gramatical. Se renombra, sin PrecioMTOP
// nuevo.
//
// Fuentes de precio (USD convertido a $40,85/USD, BROU venta) — gama
// media/estándar, blanco, sin lujo:
//  - Inodoro con mochila blanco: Sodimac Uruguay, Rozen "Urban" kit
//    completo, USD 129 real (se evitaron Flow USD 309 e Incepa Thema
//    USD 269, gama alta).
//  - Bidet blanco: Sodimac Uruguay, Rozen "Urban", USD 70 real
//    (promedio 69-71 según variante).
//  - Lavatorio blanco: Sodimac Uruguay, Sensi D'Acqua "Florencia"
//    pedestal, USD 39 real (cruzado con Corona Trevi ~USD 36,7).
//  - Grifería monocomando lavatorio: Sodimac Uruguay, Sensi D'Acqua
//    "Parma", USD 18 real (cartucho cerámico, 10 años garantía; se
//    evitó Grohe Curve USD 119, premium).
//  - Grifería monocomando bidet: ⚠️ mismo precio que lavatorio — sin
//    SKU específico "para bidet" encontrado, en la práctica es la
//    misma línea/producto.
//  - Grifería monocomando ducha: Sodimac Uruguay, Sensi D'Acqua
//    "Perugia" sin transferencia, USD 39 real (se evitaron Vittorio/
//    Soul/Wabi/Palito, USD 65-149).
//  - Accesorios de colocación grifería (7.2.4/7.2.6, compartido): ⚠️
//    sin fuente puntual, estimación $400/gl.
//  - Pileta y media acero inoxidable: Castro.com.uy, Tramontina 304
//    mate, USD 111,80 real (con descuento vigente).
//  - Accesorios de colocación pileta: ⚠️ sin fuente puntual,
//    estimación $350/gl.
//  - Mezcladora monocomando cocina: Sodimac Uruguay, Sensi D'Acqua,
//    USD 69 real.
//  - Accesorios de colocación sanitaria (7.2.3): ya real ($650/gl),
//    sin cambios.
//
// Sin cambios de mano de obra. GG 15% / Utilidad 10%, sin leyes
// sociales.
//
// Ejecutar (dry-run): npx tsx scripts/fix-acondicionamientos-sanitarios.ts
// Ejecutar (real):     npx tsx scripts/fix-acondicionamientos-sanitarios.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;
const USD_UYU = 40.85;

const INODORO_U = 129 * USD_UYU;
const BIDET_U = 70 * USD_UYU;
const LAVATORIO_U = 39 * USD_UYU;
const GRIFERIA_LAVATORIO_U = 18 * USD_UYU;
const GRIFERIA_BIDET_U = GRIFERIA_LAVATORIO_U;
const GRIFERIA_DUCHA_U = 39 * USD_UYU;
const ACCESORIOS_GRIFERIA_GL = 400;
const PILETA_Y_MEDIA_U = 111.8 * USD_UYU;
const ACCESORIOS_PILETA_GL = 350;
const MEZCLADORA_COCINA_U = 69 * USD_UYU;

type MaterialNuevo = { codigoMTOP: string; descripcion: string; unidad: string; precio: number };
type RenombreSolo = { origenDescripcion: string; descripcion: string };
type Def = { codigo: string; materialesNuevos: MaterialNuevo[]; renombresSolo?: RenombreSolo[] };

const DEFS: Def[] = [
  {
    codigo: "7.2.3",
    materialesNuevos: [
      { codigoMTOP: "MAT-INODORO-MOCHILA-BLANCO", descripcion: "Inodoro con mochila blanco", unidad: "u", precio: INODORO_U },
      { codigoMTOP: "MAT-BIDET-BLANCO", descripcion: "Bidet blanco", unidad: "u", precio: BIDET_U },
      { codigoMTOP: "MAT-LAVATORIO-BLANCO", descripcion: "Lavatorio blanco", unidad: "u", precio: LAVATORIO_U },
    ],
  },
  {
    codigo: "7.2.4",
    materialesNuevos: [
      { codigoMTOP: "MAT-GRIFERIA-MONO-LAVATORIO", descripcion: "Grifería monocomando lavatorio", unidad: "u", precio: GRIFERIA_LAVATORIO_U },
      { codigoMTOP: "MAT-GRIFERIA-MONO-BIDET", descripcion: "Grifería monocomando bidet", unidad: "u", precio: GRIFERIA_BIDET_U },
      { codigoMTOP: "MAT-GRIFERIA-MONO-DUCHA", descripcion: "Grifería monocomando ducha", unidad: "u", precio: GRIFERIA_DUCHA_U },
      { codigoMTOP: "MAT-ACC-COLOC-GRIFERIA", descripcion: "Accesorios de colocación grifería", unidad: "gl", precio: ACCESORIOS_GRIFERIA_GL },
    ],
  },
  {
    codigo: "7.2.5",
    materialesNuevos: [
      { codigoMTOP: "MAT-PILETA-Y-MEDIA-INOX", descripcion: "Pileta y media acero inoxidable", unidad: "u", precio: PILETA_Y_MEDIA_U },
      { codigoMTOP: "MAT-ACC-COLOC-PILETA", descripcion: "Accesorios de colocación pileta", unidad: "gl", precio: ACCESORIOS_PILETA_GL },
    ],
  },
  {
    codigo: "7.2.6",
    materialesNuevos: [
      { codigoMTOP: "MAT-MEZCLADORA-COCINA", descripcion: "Mezcladora monocomando cocina", unidad: "u", precio: MEZCLADORA_COCINA_U },
      { codigoMTOP: "MAT-ACC-COLOC-GRIFERIA", descripcion: "Accesorios de colocación grifería", unidad: "gl", precio: ACCESORIOS_GRIFERIA_GL },
    ],
  },
  {
    codigo: "jardin-002b",
    materialesNuevos: [],
    renombresSolo: [
      {
        origenDescripcion: "Chapa de hierro galvanizada, ondulada, Nro. 24, medida: 1.8 a 3 m",
        descripcion: "Chapa de hierro galvanizado, ondulada, Nro. 24, medida: 1.8 a 3 m",
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
