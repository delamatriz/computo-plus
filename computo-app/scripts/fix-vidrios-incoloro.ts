// Fase 2 del bug "clona a $0" — Vidrios, sub-tanda 9a: Vidrio simple/
// incoloro (3 códigos: 7.4.1, 7.4.2, 7.4.3, sin apalancamiento de
// material propio entre sí — solo comparten "Sellador silicona", ya
// resuelto).
//
// Confirmado ANTES de investigar (chequeo de duplicados): los 3
// insumos ("Vidrio incoloro 4mm", "Vidrio incoloro 5mm", "Vidrio
// esmerilado incoloro 4mm") tenían 0 filas PrecioMTOP preexistentes —
// genuinamente parte del bug, sin colisión de texto (a diferencia de
// lo que se temía con marcas Probba/Gala — esas marcas resultaron ser
// SISTEMAS DE ABERTURAS DE ALUMINIO, no vidrio, así que no aplican acá
// como fuente ni generan riesgo de colisión). Sin equipos en ningún
// APU. "Sellador silicona" ($320/u) ya resuelto de sub-tandas previas,
// reutilizado sin tocar.
//
// HALLAZGO CLAVE — Lista Oficial MTOP (N°599, fechaLista 2025-11, la
// misma fuente que CLAUDE.md señala como autoridad de precios de
// Uruguay) YA tiene filas de "Vidrio cortado, espesor: X mm
// (nacional)" — el mismo producto que nuestro "Vidrio incoloro Xmm"
// (vidrio cortado a medida sin tratamiento adicional = vidrio
// incoloro liso). Texto distinto ("cortado" vs "incoloro"), por lo
// que NO colisiona con nuestras descripciones vía `contains` — pero
// es la fuente MÁS autorizada y reciente disponible, mejor que
// research retail genérico. Se usa como fuente primaria:
//  - 4mm nacional (código MTOP 169): $4.312,59/m²
//  - 6mm nacional (código MTOP 171): $6.603,52/m² — usado solo para
//    interpolar el 5mm (ver abajo, no hay fila propia de 5mm)
//
// Fuentes de precio:
//  - Vidrio incoloro 4mm: Lista MTOP N°599 (nov-2025), "Vidrio
//    cortado, espesor 4mm (nacional)" = $4.312,59/m² real.
//  - Vidrio incoloro 5mm: SIN fila propia en la Lista MTOP (solo hay
//    2.3, 3, 4 y 6mm). Interpolación lineal entre 4mm ($4.312,59) y
//    6mm nacional ($6.603,52): $4.312,59 + ($6.603,52-$4.312,59) ×
//    (5-4)/(6-4) = $5.458,06/m². Lógica explícita: escalado lineal
//    por espesor entre los dos puntos reales más cercanos de la misma
//    fuente y el mismo origen (nacional), mismo criterio usado en
//    Steel Framing/Yeso para escalados por espesor.
//  - Vidrio esmerilado incoloro 4mm: ⚠️ ESTIMACIÓN GRUESA — la Lista
//    MTOP no tiene una fila de vidrio con tratamiento esmerilado
//    (arenado/grabado ácido). No se encontró un precio retail Uruguay
//    2026 verificable por fetch directo para este tratamiento
//    específico. Se aplicó un premium estimado de 15% sobre el precio
//    base del incoloro 4mm ($4.312,59 × 1,15 = $4.959,48/m²),
//    intermedio entre dos referencias débiles: (a) el rubro SAU
//    2022 (precio total instalado, no material puro) mostraba solo
//    ~6,4% de diferencia entre esmerilado 4mm ($2.430) e incoloro 4mm
//    ($2.284,20); (b) fuentes generales de la industria del vidrio
//    (no específicas de Uruguay) sitúan el premium del esmerilado
//    entre 20-40% sobre el vidrio liso equivalente, por el proceso de
//    tratamiento superficial. 15% es un punto medio razonado, NO un
//    número confirmado — a cuestionar/ajustar por el usuario.
//
// ANOMALÍA A REVISAR — NO SE RESUELVE ACÁ: el material ya resuelto de
// vidrio-007 (Vidrio templado 10mm, sub-tanda previa, verificado en
// vivo) tiene precioUnit=$4.550/m². La Lista MTOP nov-2025 muestra
// "Vidrio cortado 6mm (nacional)" — vidrio SIN templar, MÁS FINO
// (6mm vs 10mm) — a $6.603,52/m², un 45% MÁS CARO que nuestro vidrio
// templado de 10mm ya resuelto. Esto es contraintuitivo: un vidrio
// templado más grueso debería costar más que un vidrio simple más
// fino, no menos. No se investiga ni se corrige en esta sub-tanda
// (vidrio-007 es de un capítulo/sub-tanda ya cerrado) — se deja
// anotado para que el usuario decida si amerita revisión en la
// sub-tanda 9b (Vidrio templado) o aparte.
//
// Sin cambios de mano de obra ni de rendimientos. GG 15% / Utilidad
// 10%, sin leyes sociales.
//
// Ejecutar (dry-run): npx tsx scripts/fix-vidrios-incoloro.ts
// Ejecutar (real):     npx tsx scripts/fix-vidrios-incoloro.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;

const VIDRIO_4MM_M2 = 4312.59;
const VIDRIO_6MM_NACIONAL_M2 = 6603.52;
const VIDRIO_5MM_M2 = Math.round((VIDRIO_4MM_M2 + (VIDRIO_6MM_NACIONAL_M2 - VIDRIO_4MM_M2) * (5 - 4) / (6 - 4)) * 100) / 100;
// ⚠️ ESTIMACIÓN GRUESA — premium de 15% sobre incoloro 4mm, sin fuente
// retail Uruguay verificable para el tratamiento esmerilado (ver
// header).
const PREMIUM_ESMERILADO = 0.15;
const VIDRIO_ESMERILADO_4MM_M2 = Math.round(VIDRIO_4MM_M2 * (1 + PREMIUM_ESMERILADO) * 100) / 100;

type MaterialNuevo = { codigoMTOP: string; descripcion: string; unidad: string; precio: number };
type Def = { codigo: string; materialesNuevos: MaterialNuevo[] };

const DEFS: Def[] = [
  { codigo: "7.4.1", materialesNuevos: [{ codigoMTOP: "MAT-VIDRIO-INCOLORO-4MM", descripcion: "Vidrio incoloro 4mm", unidad: "m2", precio: VIDRIO_4MM_M2 }] },
  { codigo: "7.4.2", materialesNuevos: [{ codigoMTOP: "MAT-VIDRIO-INCOLORO-5MM", descripcion: "Vidrio incoloro 5mm", unidad: "m2", precio: VIDRIO_5MM_M2 }] },
  { codigo: "7.4.3", materialesNuevos: [{ codigoMTOP: "MAT-VIDRIO-ESMERILADO-4MM", descripcion: "Vidrio esmerilado incoloro 4mm", unidad: "m2", precio: VIDRIO_ESMERILADO_4MM_M2 }] },
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
