// Fase 2 del bug "clona a $0" — Tanda 2 (Albañilería), sub-tanda 1: los
// 4 materiales de mayor apalancamiento (11 de los 25 códigos afectados).
//
// Decisiones ya tomadas con el usuario:
//  - 6.5.4 (CERÁMICA 45x45cm SOBRE RÚSTICO) NO recibe material nuevo:
//    reusa "Baldosa cerámica esmaltada ~45-50cm" (mismo precio que
//    6.4.7/6.4.22) — el precio por m² de cerámica esmaltada estándar
//    no varía significativamente entre 45x45 y 50x50. Se renombra el
//    material del APU para no prometer una medida exacta incumplida.
//  - 6.5.1 (PULIDO) y 6.5.3 (CON TEXTURA/DISEÑO) SÍ reciben material
//    propio, investigado por separado del mate liso (6.4.6/6.4.24).
//
// Hallazgo de la investigación (contradice la expectativa inicial de
// "sobreprecio real" en pulido/textura): datos reales de Acher
// Cerámicas (Uruguay) muestran que el pulido (USD 39,20/m², "Bianco
// Master Pulido") sale prácticamente IGUAL al mate/liso (USD 39,43/m²,
// promedio de 9 productos), y la línea con textura (USD 33,75/m²,
// promedio línea Travertino) sale más BARATA en esta muestra. Se
// reporta así, sin forzar una diferencia artificial que la plaza no
// sostiene hoy.
//
// Fuentes de precio (USD convertido a $40,85/USD, BROU venta):
//  - Porcelanato 60x60 mate/liso: Acher Cerámicas, promedio de 9
//    productos mate ($30,42-$46,49/m²) = USD 39,43/m² → $1.610,72/m².
//  - Porcelanato 60x60 pulido: Acher Cerámicas, "Bianco Master
//    Pulido" USD 39,20/m² → $1.601,32/m².
//  - Porcelanato 60x60 con textura/diseño: Acher Cerámicas, promedio
//    línea Travertino texturada USD 31,01-36,48/m² = USD 33,75/m² →
//    $1.378,69/m².
//  - Baldosa cerámica esmaltada ~45-50cm: Acher Cerámicas, promedio
//    10 productos 45x45cm con descuento vigente ($15,50-$26,64/m²) =
//    USD 20,65/m² → $843,55/m².
//  - Baldosa monolítica 40x40cm: ⚠️ extrapolación lineal — MercadoLibre
//    Uruguay real para mosaico granítico 20x20cm ($1.641/m²) y 30x30cm
//    ($1.702/m²), tendencia +$61 cada 10cm de formato → 40x40cm =
//    $1.763/m².
//  - Madera dura e=2" (perfil 30cm ancho × 2" espesor, medida
//    confirmada en el Rubrado SAU original): La Casa del Carpintero
//    (Uruguay), alfajía lapacho boliviano 2"x1" cepillado $462/ml
//    (real) → escalado por sección transversal (factor 11,811x,
//    mismo costo por m³ implícito) → $5.456,69/ml.
//
// Bug adicional encontrado (no estaba en la lista de 25, se corrige de
// paso): el material de 6.4.8 "Cemento Portland" (genérico) resolvía
// por `contains` a "Cemento Portland BLANCO" ($54,44/kg) en vez del
// cemento gris estándar de mampostería (~$25,70/kg) — mismo patrón de
// colisión por texto ambiguo visto en Carpinterías. Se renombra a
// "Cemento Portland gris (Montevideo, en bolsa, en obra)" (idéntico al
// texto que ya usa correctamente 6.4.23) para que matchee el gris real
// ya existente en la Lista MTOP — no necesita PrecioMTOP nuevo.
//
// Sin cambios de mano de obra en ninguno. GG 15% / Utilidad 10%, sin
// leyes sociales.
//
// Ejecutar (dry-run): npx tsx scripts/fix-albanileria-subtanda1.ts
// Ejecutar (real):     npx tsx scripts/fix-albanileria-subtanda1.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;
const USD_UYU = 40.85;

const PORC_MATE_M2 = 39.43 * USD_UYU;
const PORC_PULIDO_M2 = 39.2 * USD_UYU;
const PORC_TEXTURA_M2 = 33.75 * USD_UYU;
const BALDOSA_CERAMICA_M2 = 20.65 * USD_UYU;
const BALDOSA_MONOLITICA_M2 = 1763;
const SECCION_ALFAJIA = 0.0508 * 0.0254; // 2"x1"
const SECCION_MADERA_DURA = 0.3 * 0.0508; // 30cm x 2", medida SAU
const MADERA_DURA_E2_ML = (462 / SECCION_ALFAJIA) * SECCION_MADERA_DURA;

// origenDescripcion = texto EXACTO que hoy tiene el MaterialAPUEstandar en la base (para matchear
// y, si difiere de descripcion, renombrarlo). descripcion = texto final deseado.
type MaterialNuevo = { codigoMTOP: string; origenDescripcion: string; descripcion: string; unidad: string; precio: number };
type RenombreSolo = { origenDescripcion: string; descripcion: string }; // material que NO recibe precio nuevo, solo se renombra (cemento)
type Def = { codigo: string; materialesNuevos: MaterialNuevo[]; renombresSolo?: RenombreSolo[] };

const DEFS: Def[] = [
  { codigo: "6.4.6", materialesNuevos: [{ codigoMTOP: "MAT-PORCELANATO-6060-MATE", origenDescripcion: "Porcelanato 60x60cm", descripcion: "Porcelanato 60x60cm", unidad: "m2", precio: PORC_MATE_M2 }] },
  { codigo: "6.4.24", materialesNuevos: [{ codigoMTOP: "MAT-PORCELANATO-6060-MATE", origenDescripcion: "Porcelanato 60x60cm", descripcion: "Porcelanato 60x60cm", unidad: "m2", precio: PORC_MATE_M2 }] },
  {
    codigo: "6.5.1",
    materialesNuevos: [{ codigoMTOP: "MAT-PORCELANATO-6060-PULIDO", origenDescripcion: "Porcelanato 60x60cm", descripcion: "Porcelanato 60x60cm pulido", unidad: "m2", precio: PORC_PULIDO_M2 }],
  },
  {
    codigo: "6.5.3",
    materialesNuevos: [{ codigoMTOP: "MAT-PORCELANATO-6060-TEXTURA", origenDescripcion: "Porcelanato 60x60cm", descripcion: "Porcelanato 60x60cm con textura/diseño", unidad: "m2", precio: PORC_TEXTURA_M2 }],
  },
  { codigo: "6.4.7", materialesNuevos: [{ codigoMTOP: "MAT-BALDOSA-CERAMICA-4550", origenDescripcion: "Baldosa cerámica 50x50cm", descripcion: "Baldosa cerámica esmaltada ~45-50cm", unidad: "m2", precio: BALDOSA_CERAMICA_M2 }] },
  { codigo: "6.4.22", materialesNuevos: [{ codigoMTOP: "MAT-BALDOSA-CERAMICA-4550", origenDescripcion: "Baldosa cerámica 50x50cm", descripcion: "Baldosa cerámica esmaltada ~45-50cm", unidad: "m2", precio: BALDOSA_CERAMICA_M2 }] },
  { codigo: "6.5.4", materialesNuevos: [{ codigoMTOP: "MAT-BALDOSA-CERAMICA-4550", origenDescripcion: "Baldosa cerámica 50x50cm", descripcion: "Baldosa cerámica esmaltada ~45-50cm", unidad: "m2", precio: BALDOSA_CERAMICA_M2 }] },
  { codigo: "6.4.16", materialesNuevos: [{ codigoMTOP: "MAT-MADERA-DURA-E2-30CM", origenDescripcion: "Madera dura e=2 pulgadas", descripcion: "Madera dura e=2 pulgadas (30cm ancho)", unidad: "ml", precio: MADERA_DURA_E2_ML }] },
  { codigo: "6.4.19", materialesNuevos: [{ codigoMTOP: "MAT-MADERA-DURA-E2-30CM", origenDescripcion: "Madera dura e=2 pulgadas", descripcion: "Madera dura e=2 pulgadas (30cm ancho)", unidad: "ml", precio: MADERA_DURA_E2_ML }] },
  {
    codigo: "6.4.8",
    materialesNuevos: [{ codigoMTOP: "MAT-BALDOSA-MONOLITICA-4040", origenDescripcion: "Baldosa monolítica 40x40cm", descripcion: "Baldosa monolítica 40x40cm", unidad: "m2", precio: BALDOSA_MONOLITICA_M2 }],
    renombresSolo: [{ origenDescripcion: "Cemento Portland", descripcion: "Cemento Portland gris (Montevideo, en bolsa, en obra)" }],
  },
  { codigo: "6.4.23", materialesNuevos: [{ codigoMTOP: "MAT-BALDOSA-MONOLITICA-4040", origenDescripcion: "Baldosa monolítica 40x40cm", descripcion: "Baldosa monolítica 40x40cm", unidad: "m2", precio: BALDOSA_MONOLITICA_M2 }] },
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
      // Matchea por origenDescripcion (texto que hoy tiene el material en la base) O por el
      // nombre final (por si el script ya corrió antes y el material quedó renombrado).
      const nuevo = def.materialesNuevos.find(
        (n) => m.descripcion.toLowerCase() === n.origenDescripcion.toLowerCase() || m.descripcion.toLowerCase() === n.descripcion.toLowerCase()
      );
      const renombreSolo = def.renombresSolo?.find(
        (r) => m.descripcion.toLowerCase() === r.origenDescripcion.toLowerCase() || m.descripcion.toLowerCase() === r.descripcion.toLowerCase()
      );

      if (nuevo) {
        const precio = Math.round(nuevo.precio * 100) / 100;
        const nota = nuevo.origenDescripcion !== nuevo.descripcion ? ` (renombrado desde "${nuevo.origenDescripcion}")` : "";
        console.log(`  material: ${nuevo.descripcion}${nota} — $${precio}/${nuevo.unidad} (${nuevo.codigoMTOP}) × rend ${m.rendimiento}`);
        sumMat += m.rendimiento * precio;
      } else if (renombreSolo) {
        const precio = resolverPrecioExistente(renombreSolo.descripcion);
        console.log(`  material: ${renombreSolo.descripcion} — $${precio}/${m.unidad} (renombrado desde "${renombreSolo.origenDescripcion}" — ya NO matchea el blanco) × rend ${m.rendimiento}`);
        sumMat += m.rendimiento * precio;
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

    for (const nuevo of def.materialesNuevos) {
      if (nuevo.origenDescripcion === nuevo.descripcion) continue;
      const material = s.apuEstandar.materiales.find((m) => m.descripcion === nuevo.origenDescripcion);
      if (material) {
        await db.materialAPUEstandar.update({ where: { id: material.id }, data: { descripcion: nuevo.descripcion } });
      }
    }
    for (const r of def.renombresSolo ?? []) {
      const material = s.apuEstandar.materiales.find((m) => m.descripcion === r.origenDescripcion);
      if (material) {
        await db.materialAPUEstandar.update({ where: { id: material.id }, data: { descripcion: r.descripcion } });
      }
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
