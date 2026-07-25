// Fase 2 del bug "clona a $0" — Cubiertas, sub-tanda 10b: Cubiertas
// alternativas (2 códigos: cubierta-003, cubierta-007, sin
// apalancamiento entre sí).
//
// Confirmado ANTES de investigar (chequeo de duplicados): "Teja
// francesa", "Plancha policarbonato alveolar" y "Perfil de unión para
// policarbonato" tenían 0 filas PrecioMTOP preexistentes, sin
// colisión. La Lista MTOP N°599 NO tiene fila de teja francesa ni de
// policarbonato — sí tiene "Teja cerámica colonial (en obra)" ($u
// 20.728,94/u), pero es un producto DISTINTO (colonial, no francesa)
// y además ese número parece estar cotizado por MILLAR (1000
// unidades), no por unidad individual — comparado con nuestra propia
// "Teja colonial" ya resuelta a $55/u (376x menos), consistente con
// $20.728,94 ÷ 1000 ≈ $20,73/u. Se deja solo como referencia de
// calibre, no se usa como fuente.
//
// cubierta-003 tiene "Andamio tubular" en su APU, YA RESUELTO — no se
// toca.
//
//  - Teja francesa: CORREGIDO tras segunda búsqueda — el precio
//    inicial de Barraca Luissi ($867/u) quedó descartado por dos
//    señales de alarma (premium de 15,8x sobre Teja colonial, y
//    rendimiento de fábrica 17 u/m² sin coincidir con el 14 u/m² ya
//    cargado en el APU). Segunda fuente REAL: Juan Construye
//    (juanconstruye.com.uy, revendedor uruguayo real), línea "Cerro
//    Negro" (fabricante argentino Cerro Negro, vendido en plaza
//    uruguaya) — variantes a **13,8 u/m²**, coincide casi exacto con
//    el 14 u/m² del APU (la pequeña diferencia es normal entre
//    fabricantes de un mismo formato "grande"). Precios confirmados
//    por fetch directo, en escalera interna coherente por
//    terminación: Natural (sin esmaltar, la más simple) USD 1,63/u
//    (SKU "Cerro Negro Teja Francesa Grande Natural"), Negro mate
//    USD 2,91/u, Negro brillante USD 3,37/u (este último confirmado
//    con fetch directo de la ficha exacta). Se usa la variante
//    Natural, coherente con que cubierta-003 no especifica esmalte:
//    USD 1,63 → a $40,85/USD = $66,59/u.
//    Resultado: $66,59/u es solo 21% más caro que Teja colonial
//    ($55/u) — premium razonable de "francesa vs colonial" (perfil
//    más complejo), no un salto de orden de magnitud. El precioUY
//    final ($2.455,09/m², ver dry-run) queda en línea con el resto de
//    sistemas de cubierta ya resueltos en Fase 2 (colonial $2.333,
//    chapa $2.930-4.884, isopanel $2.987-4.376) — cierra bien.
//  - Plancha policarbonato alveolar: REAL, Aluminios del Uruguay
//    (shop.aluminios.com), "Policarbonato Alveolar 6mm, 5800x2100mm,
//    Clear", USD 158,11 IVA incluido, placa completa = 12,18 m² →
//    USD 12,98/m² → a $40,85/USD = $530,14/m².
//  - Perfil de unión para policarbonato: ⚠️ fuente cruzada de menor
//    confianza — no se encontró proveedor Uruguay con precio
//    accesible por fetch para el Perfil H específico (Aluminios del
//    Uruguay lo tiene en catálogo pero sin precio visible; Mercado
//    Libre Uruguay bloqueó el fetch con 403). Se usó GINISA
//    (Argentina), mismo producto exacto (Perfil Unión H para
//    policarbonato alveolar, barra de 5,80m) = ARS 37.143 → a
//    ARS/USD 1.496,49 (jul-2026) = USD 24,82 → a $40,85/USD =
//    $1.013,87/barra → $174,81/ml. Doble conversión de moneda
//    (ARS→USD→UYU) sobre una fuente extranjera — más débil que el
//    resto, marcado explícitamente.
//
// Sin cambios de mano de obra ni de rendimientos. GG 15% / Utilidad
// 10%, sin leyes sociales.
//
// Ejecutar (dry-run): npx tsx scripts/fix-cubiertas-teja-policarbonato.ts
// Ejecutar (real):     npx tsx scripts/fix-cubiertas-teja-policarbonato.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;
const USD_UYU = 40.85;

const TEJA_FRANCESA_U = Math.round(1.63 * USD_UYU * 100) / 100;
const POLICARBONATO_ALVEOLAR_M2 = Math.round((158.11 / (5.8 * 2.1)) * USD_UYU * 100) / 100;
const ARS_USD = 1496.49;
const PERFIL_UNION_POLICARBONATO_ML = Math.round(((37143 / ARS_USD) * USD_UYU / 5.8) * 100) / 100;

type MaterialNuevo = { codigoMTOP: string; descripcion: string; unidad: string; precio: number };
type Def = { codigo: string; materialesNuevos: MaterialNuevo[] };

const DEFS: Def[] = [
  { codigo: "cubierta-003", materialesNuevos: [{ codigoMTOP: "MAT-TEJA-FRANCESA", descripcion: "Teja francesa", unidad: "u", precio: TEJA_FRANCESA_U }] },
  {
    codigo: "cubierta-007",
    materialesNuevos: [
      { codigoMTOP: "MAT-POLICARBONATO-ALVEOLAR", descripcion: "Plancha policarbonato alveolar", unidad: "m2", precio: POLICARBONATO_ALVEOLAR_M2 },
      { codigoMTOP: "MAT-PERFIL-UNION-POLICARBONATO", descripcion: "Perfil de unión para policarbonato", unidad: "ml", precio: PERFIL_UNION_POLICARBONATO_ML },
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
