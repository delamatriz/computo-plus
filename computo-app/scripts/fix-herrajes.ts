// Fase 2 del bug "clona a $0" — subcapítulo Herrajes (Subcontratos -
// Carpinterías): 7.3.6/7.3.7/7.3.8. Confirmado que en los 3 el material
// del APU SÍ corresponde a lo que el código dice ser (sin caso de
// material mal asignado como en Hierro). Ninguno usado en Rubro real
// de HOGAR/Matisse Monet.
//
// Precios de referencia:
//  - Pomo con llavín: Kroser Uruguay (marca Hermex, sistema llavín/botón
//    ciego) — rango real observado $727-1.284. Se usó $950/u (mid-range).
//  - Cerradura tipo star con manija: confirmado que STAR es la marca
//    líder del mercado uruguayo (desde 1941, 750+ puntos de venta,
//    vendida en Sodimac), pero no se encontró precio específico
//    publicado. ⚠️ ESTIMACIÓN GRUESA, $4.000/u — ajustado a pedido del
//    usuario (una cerradura de embutir completa con manija de esta
//    marca ronda más alto en plaza, rango de referencia $3.800-4.200).
//  - Bisagra: sin cotización uruguaya específica encontrada (resultados
//    mayormente de Argentina/Costa Rica). ⚠️ ESTIMACIÓN GRUESA, $180/u.
//
// Sin cambios de MO (rendimientos originales del import SAU, no había
// razón para ajustarlos — material y descripción ya coincidían).
//
// GG=15%/Util=10%, sin leyes sociales.
//
// Ejecutar (dry-run): npx tsx scripts/fix-herrajes.ts
// Ejecutar (real):     npx tsx scripts/fix-herrajes.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;

const PRECIOS_NUEVOS = [
  { codigo: "MAT-POMO-LLAVIN", descripcion: "Pomo con llavín", unidad: "u", precioUnitario: 950 },
  { codigo: "MAT-CERRADURA-STAR-MANIJA", descripcion: "Cerradura tipo star con manija", unidad: "u", precioUnitario: 4000 },
  { codigo: "MAT-BISAGRA", descripcion: "Bisagra", unidad: "u", precioUnitario: 180 },
] as const;

const CODIGOS = ["7.3.6", "7.3.7", "7.3.8"];

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);

  console.log("── PrecioMTOP nuevos ──");
  for (const p of PRECIOS_NUEVOS) {
    const existente = await db.precioMTOP.findUnique({ where: { codigo: p.codigo } });
    console.log(`  ${existente ? "= ya existe" : "+ nuevo"} — ${p.codigo} — ${p.descripcion} ($${p.precioUnitario}/${p.unidad})`);
    if (aplicar) {
      await db.precioMTOP.upsert({
        where: { codigo: p.codigo },
        create: {
          codigo: p.codigo,
          descripcion: p.descripcion,
          cantidadUnidad: `1 ${p.unidad}`,
          unidad: p.unidad,
          cantidad: 1,
          precioConIva: p.precioUnitario,
          precioUnitario: p.precioUnitario,
          numeroLista: 0,
          fechaLista: FECHA,
        },
        update: { precioUnitario: p.precioUnitario, precioConIva: p.precioUnitario },
      });
    }
  }

  const precioPorDescripcion = new Map<string, number>(PRECIOS_NUEVOS.map((p) => [p.descripcion, p.precioUnitario]));
  const categoriasLaborales = await db.categoriaLaboral.findMany();
  const jornalPorNombre = (nombre: string) =>
    categoriasLaborales.find((c) => c.nombre.trim().toLowerCase() === nombre.trim().toLowerCase())?.jornal ?? 0;

  console.log("\n── Recalculo de 7.3.6 / 7.3.7 / 7.3.8 ──");
  for (const codigo of CODIGOS) {
    const s = await db.subrubroEstandar.findUnique({
      where: { codigo },
      include: { apuEstandar: { include: { materiales: true, manoObra: true } } },
    });
    if (!s || !s.apuEstandar) {
      console.log(`  ⚠ ${codigo} no encontrado`);
      continue;
    }
    let sumMat = 0;
    console.log(`\n  ${codigo} — ${s.descripcion}`);
    for (const m of s.apuEstandar.materiales) {
      const precio = precioPorDescripcion.get(m.descripcion) ?? 0;
      sumMat += m.rendimiento * precio;
      console.log(`    material: ${m.descripcion} — rendimiento ${m.rendimiento} ${m.unidad} — $${precio}/${m.unidad}`);
    }
    let sumMO = 0;
    for (const mo of s.apuEstandar.manoObra) {
      const jornal = jornalPorNombre(mo.categoria);
      sumMO += jornal / mo.rendimiento;
      console.log(`    MO: ${mo.categoria} — rendimiento ${mo.rendimiento} U/jornada — jornal $${jornal} (sin cambios)`);
    }
    const costoDirecto = sumMat + sumMO;
    const precioUY = Math.round(costoDirecto * (1 + GG_PCT / 100) * (1 + UTIL_PCT / 100) * 100) / 100;
    console.log(`    sumMat=$${sumMat.toFixed(2)} sumMO=$${sumMO.toFixed(2)} costoDirecto=$${costoDirecto.toFixed(2)}`);
    console.log(`    precioUY actual: $${s.precioUY} → NUEVO: $${precioUY}`);

    if (aplicar) {
      await db.subrubroEstandar.update({ where: { codigo }, data: { precioUY, fechaBase: FECHA } });
    }
  }

  console.log("\n── Resumen ──");
  console.log(`Modo: ${aplicar ? "APLICADO A PRODUCCIÓN" : "DRY RUN (nada escrito)"}`);

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
