// Fase 2 del bug "clona a $0" — Paneles Térmicos, sub-tanda 15a (ÚNICA
// del subcapítulo, 2 códigos: 8.2.1, 8.2.2). Cierra Sistemas No
// Tradicionales completo (Steel Framing 2/2 ya cerrado + Paneles
// Térmicos 3/3, sumando 8.2.3 ya resuelto de yapa en Impermeabiliza-
// ciones 8b) — y con esto queda auditado TODO capítulo de la Fase 2.
//
// Confirmado ANTES de investigar (chequeo de duplicados): "Panel
// isopanel para cubierta" y "Panel isodeck" tenían 0 filas PrecioMTOP
// preexistentes, sin colisión. 8.2.3 (Montaje de paneles de
// poliuretano expandido) confirmado sano, $683,59, sin re-investigar.
// El único código que compartía "Panel isopanel para cubierta"
// (cubierta-008, Cubiertas) está INACTIVO — reemplazado por
// isopanel-001/002/003 en un commit no relacionado a este bug, sin
// necesidad de acción.
//
// Insumos y fuentes:
//  - Panel isopanel para cubierta (8.2.1): el código no especifica
//    espesor. Se asumió **50mm** como estándar/genérico — criterio:
//    (a) el usuario pidió explícitamente NO asumir el extremo de
//    250mm (uso industrial/cámara frigorífica); (b) confirmado con
//    búsqueda de mercado que 50mm es la opción de entrada/más básica
//    y frecuente en Uruguay (BMC Uruguay ofrece la línea desde 50mm,
//    Construex publicita "Isopanel desde U$S 38,90/m²" como precio de
//    entrada, coherente con la gama baja). DERIVADO (no investigado
//    de cero): se reutilizó el componente de MATERIAL ya resuelto de
//    isopanel-001 ("Cubierta de Isopanel 50mm", sub-tanda de Cubiertas
//    ya cerrada) — su material "Panel autoestructural prefabricado,
//    Tipo multicapa espesor 50mm" resuelve a $1.978,53/m² (código
//    real CUB001). Es el MISMO producto físico (Isopanel), solo con
//    nombre de línea de material distinto en nuestro código genérico.
//  - Panel isodeck (8.2.2): REAL, Barraca Carmela (carmela.com.uy),
//    "Panel Techo Aislante Engrafado Poliuretano Isodec PIR 80mm" =
//    USD 79,50/ml (precio por metro de chapa, ancho útil 1,13m) →
//    USD 70,35/m² → a $40,85/USD = $2.873,96/m² (valor exacto sin
//    redondeos intermedios). Isodec es un panel PIR (poliisocianurato),
//    aislante superior por mm al EPS/PU estándar del Isopanel —
//    coherente que a 80mm cueste más que el Isopanel de 50mm y se
//    ubique entre el de 150mm y 250mm.
//
// Verificación de coherencia (pedida por el usuario, comparando con
// los rangos ya conocidos de cubiertas livianas: isopanel
// $2.987-4.376, chapa ondulada $2.930-4.884, policarbonato $1.460):
//  - 8.2.1 nuevo ($2.969,70) queda prácticamente igual a isopanel-001
//    ($2.987,16, mismo espesor 50mm) — la pequeña diferencia se
//    explica porque 8.2.1 no tiene línea de "Tornillos
//    autoperforantes" en su APU (isopanel-001 sí, +$36 de material),
//    lo que compensa que 8.2.1 usa mano de obra "Oficial
//    especializado" (más cara) en vez de "Oficial albañil". Ambos
//    efectos se cancelan casi exacto — coherente, sin anomalía.
//  - 8.2.2 nuevo ($4.207,87) cae en el rango superior de cubiertas
//    livianas, coherente con ser un panel PIR premium más grueso
//    (80mm) que el Isopanel base.
//  - Ambos códigos AUMENTAN vs. 2022 (+18,6% y +86,7%) — patrón normal
//    de la Fase 2, a diferencia de Cortinas de Enrollar.
//
// Sin cambios de mano de obra ni de rendimientos. GG 15% / Utilidad
// 10%, sin leyes sociales.
//
// Ejecutar (dry-run): npx tsx scripts/fix-paneles-termicos.ts
// Ejecutar (real):     npx tsx scripts/fix-paneles-termicos.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;
const USD_UYU = 40.85;

const PANEL_ISOPANEL_50MM_M2 = 1978.53;
const ISODEC_PIR_80MM_ML_USD = 79.5;
const ISODEC_ANCHO_UTIL_M = 1.13;
const PANEL_ISODECK_M2 = Math.round(((ISODEC_PIR_80MM_ML_USD / ISODEC_ANCHO_UTIL_M) * USD_UYU) * 100) / 100;

type MaterialNuevo = { codigoMTOP: string; descripcion: string; unidad: string; precio: number };
type Def = { codigo: string; materialesNuevos: MaterialNuevo[] };

const DEFS: Def[] = [
  { codigo: "8.2.1", materialesNuevos: [{ codigoMTOP: "MAT-PANEL-ISOPANEL-CUBIERTA", descripcion: "Panel isopanel para cubierta", unidad: "m2", precio: PANEL_ISOPANEL_50MM_M2 }] },
  { codigo: "8.2.2", materialesNuevos: [{ codigoMTOP: "MAT-PANEL-ISODECK", descripcion: "Panel isodeck", unidad: "m2", precio: PANEL_ISODECK_M2 }] },
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
