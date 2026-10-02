// Fase 2 del bug "clona a $0" — Implantación (única tanda, 3 códigos:
// 1.1, 1.3, 1.5). Cierra el capítulo Implantación completo (17/17,
// sumando impl-eq-008 que ya resolvía bien).
//
// ACLARACIÓN IMPORTANTE sobre 1.1 (investigado a fondo antes de
// aplicar, para que quede trazable ante cualquier revisión futura):
// el precioUY guardado antes de este fix era $190.426,83 — 5x más que
// el nuevo ($37.629,25). Se rastreó el origen (commit 3f744c4, 29 jun
// 2026, "completar APUs faltantes de Implantación"): ese commit creó
// el APUEstandar de 1.1 (chapa+tubo+pintura+hormigón) POR PRIMERA VEZ
// — antes de eso, 1.1 no tenía ningún APUEstandar. Ese script solo
// creó materiales/MO, nunca tocó precioUY. Es decir, el $190.426,83
// NUNCA fue calculado a partir de esta especificación — es un número
// huérfano de antes de que este descompuesto existiera. El rubro SAU
// 2022 ORIGINAL para 1.1 era "BASTIDOR DE HIERRO + LONA IMPRESA"
// (cartel de lona, no de chapa) a $46.834,35 — especificación
// completamente distinta a la actual (chapa+tubo, sin lona). El
// $190.426,83 guardado es ≈4,07x ese valor 2022, compatible con la
// hipótesis (no confirmable con certeza total) de que en algún
// momento se aplicó un ajuste/inflación genérico sobre el número
// viejo de "lona impresa" sin saber que el descompuesto ya había sido
// rediseñado. CONCLUSIÓN: la "caída" del 80% no es una caída real de
// precio — es la primera vez que este descompuesto específico se
// precifica con materiales reales, comparado contra un número que
// nunca reflejó esta especificación.
//
// Confirmado ANTES de investigar (chequeo de duplicados): ningún
// insumo afectado tenía fila PrecioMTOP con el texto EXACTO de
// nuestras descripciones (sin colisión), pero varios tienen un
// producto casi idéntico ya real con nombre distinto — ver
// reutilizaciones abajo. Confirmado también que impl-eq-008
// (Hormigonera 250L) NO es un bug real: "Hormigonera" tiene 2
// candidatos reales ($350 y $250), pero la resolución exacta de
// clonar-apu (sin orderBy) siempre devuelve el match exacto correcto
// ($350) — no requiere acción.
//
// Confirmación de convención de precios (importante, verificado
// antes de reutilizar): en PrecioMTOP, `precioUnitario` YA está
// normalizado por unidad individual — se comprobó que
// precioConIva ÷ cantidad = precioUnitario en varias filas con
// cantidadUnidad > 1 (ej. "Esmalte sintetico": precioConIva $3.497,42
// ÷ cantidad 4 = $874,36; "Alambre galvanizado": precioConIva
// $47.684,68 ÷ cantidad 45 = $1.059,66). Por lo tanto NO hace falta
// dividir de nuevo por el tamaño de envase al reutilizar estas filas.
//
// Insumos y fuentes:
//  - Chapa galvanizada para cartel: REAL, Sodimac Uruguay, "Chapa
//    lisa Zincgrip 0,3mm, 1x2m" (Armco), $1.069 el paño de 2m² →
//    $534,50/m².
//  - Pintura esmalte sintético: REUTILIZADO — "Esmalte sintetico"
//    real en Lista MTOP (código 90) = $874,36/l. Mismo producto
//    (esmalte sintético genérico, apto metal/madera), misma unidad
//    (l) que pide el APU — sin conversión.
//  - Hormigón pobre para bases: REAL, Generador de Precios CYPE
//    Uruguay, "Hormigón de limpieza H-13" (baja resistencia, para
//    base de fundaciones — coincide con el uso "para bases"),
//    desglose real: Materiales $7.157,60/m³ (incluye 5% de excedente
//    ya contemplado) — se usa SOLO el componente de materiales, mismo
//    criterio que en 5.3.1/5.3.2 (Estructura), porque nuestro APU no
//    modela equipo de bomba/hormigonera para esta línea.
//    NO se usó la referencia SAU 2022 "HORMIGÓN POBRE 200K"
//    ($4.397,64/m³) porque es un precio TOTAL de rubro viejo (con MO
//    y markup 2022 incluidos), no una fila de material reutilizable.
//  - Tejido galvanizado N°14 H=2.60m: REUTILIZADO con CONVERSIÓN DE
//    UNIDAD EXPLÍCITA — "Tejido de alambre galvanizado, hueco 5x5cm,
//    Nro.14 (2mm)" real en Lista MTOP (código 158) = $686,94/**m²**.
//    Nuestro código lo necesita por **ml** de cerco de 2,60m de
//    altura. Conversión: 1 ml de cerco = 2,60 m² de tejido (1m largo
//    × 2,60m alto) → $686,94/m² × 2,60m = $1.786,04/ml.
//  - Alambre galvanizado N°14: REUTILIZADO — "Alambre galvanizado
//    Nro. 16/14" real en Lista MTOP (código 12) = $1.059,66/kg. Misma
//    unidad (kg) que pide el APU (rend 0,3) — sin conversión.
//  - Tornillos y clavos: ⚠️ ESTIMACIÓN — no se encontró precio
//    específico por kg en Sodimac/Barraca (solo rangos de precio por
//    caja, sin desglose). Estimado en $150/kg, coherente con clavos
//    genéricos ya resueltos en esta base ("Clavos para teja" $150/kg,
//    "Clavos para estructura" $150/kg).
//  - Poste de madera: REUTILIZADO — "Madera. Poste de eucaliptus
//    tratado, diámetro 12cm, largo 2,2m" real en Lista MTOP = $426,77/u.
//    Se eligió eucaliptus (no quebracho, $1.651,72/u) por ser el
//    estándar económico para barreras/cercos de obra PROVISORIOS —
//    quebracho es de mayor calidad/durabilidad, apto para cercos
//    permanentes, no coherente con el uso temporal de una barrera de
//    obra.
//
// Sin cambios de mano de obra ni de rendimientos. GG 15% / Utilidad
// 10%, sin leyes sociales.
//
// Ejecutar (dry-run): npx tsx scripts/fix-implantacion.ts
// Ejecutar (real):     npx tsx scripts/fix-implantacion.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;

const CHAPA_GALV_CARTEL_M2 = 1069 / 2;
const ESMALTE_SINTETICO_L = 874.36;
const HORMIGON_POBRE_BASES_M3 = 7157.60;
const TEJIDO_GALV_N14_M2 = 686.94;
const ALTURA_CERCO_M = 2.6;
const TEJIDO_GALV_N14_ML = Math.round(TEJIDO_GALV_N14_M2 * ALTURA_CERCO_M * 100) / 100;
const ALAMBRE_GALV_N14_KG = 1059.66;
// ⚠️ ESTIMACIÓN — sin precio específico por kg encontrado, coherente
// con clavos genéricos ya resueltos en esta base.
const TORNILLOS_CLAVOS_KG = 150;
// "Poste de madera" NO colisiona por `contains` con "Madera. Poste de
// eucaliptus tratado..." (el orden de palabras difiere — la fila real
// empieza con "Madera." antes de "Poste de eucaliptus", así que no
// contiene el substring exacto "Poste de madera"). Se crea como fila
// propia con el mismo precio real, en vez de dejarlo a
// resolverPrecioExistente (que fallaría igual que en producción).
const POSTE_MADERA_EUCALIPTO_U = 426.77;

type MaterialNuevo = { codigoMTOP: string; descripcion: string; unidad: string; precio: number };
type Def = { codigo: string; materialesNuevos: MaterialNuevo[] };

const DEFS: Def[] = [
  {
    codigo: "1.1",
    materialesNuevos: [
      { codigoMTOP: "MAT-CHAPA-GALV-CARTEL", descripcion: "Chapa galvanizada para cartel", unidad: "m2", precio: CHAPA_GALV_CARTEL_M2 },
      { codigoMTOP: "MAT-HORMIGON-POBRE-BASES", descripcion: "Hormigón pobre para bases", unidad: "m3", precio: HORMIGON_POBRE_BASES_M3 },
      // "Pintura esmalte sintético" tampoco colisiona por `contains` con
      // "Esmalte sintetico" (a la fila real le falta la palabra
      // "Pintura" al inicio) — fila propia con el mismo precio real.
      { codigoMTOP: "MAT-PINTURA-ESMALTE-SINTETICO", descripcion: "Pintura esmalte sintético", unidad: "l", precio: ESMALTE_SINTETICO_L },
    ],
  },
  {
    codigo: "1.3",
    materialesNuevos: [
      { codigoMTOP: "MAT-TEJIDO-GALV-N14", descripcion: "Tejido galvanizado N°14 H=2.60m", unidad: "ml", precio: TEJIDO_GALV_N14_ML },
      { codigoMTOP: "MAT-HORMIGON-POBRE-BASES", descripcion: "Hormigón pobre para bases", unidad: "m3", precio: HORMIGON_POBRE_BASES_M3 },
      // "Alambre galvanizado N°14" tampoco colisiona por `contains` con
      // "Alambre galvanizado Nro. 16/14 para fijación" (formato "N°14"
      // vs "Nro. 16/14" difiere) — fila propia con el mismo precio real.
      { codigoMTOP: "MAT-ALAMBRE-GALV-N14", descripcion: "Alambre galvanizado N°14", unidad: "kg", precio: ALAMBRE_GALV_N14_KG },
    ],
  },
  {
    codigo: "1.5",
    materialesNuevos: [
      { codigoMTOP: "MAT-TORNILLOS-CLAVOS", descripcion: "Tornillos y clavos", unidad: "kg", precio: TORNILLOS_CLAVOS_KG },
      // "Poste de madera" no colisiona por texto con "Madera. Poste de
      // eucaliptus tratado..." (contains no matchea, distinto orden de
      // palabras) — se crea como fila propia reutilizando el mismo
      // precio real, en vez de depender de resolverPrecioExistente.
      { codigoMTOP: "MAT-POSTE-MADERA", descripcion: "Poste de madera", unidad: "u", precio: POSTE_MADERA_EUCALIPTO_U },
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
