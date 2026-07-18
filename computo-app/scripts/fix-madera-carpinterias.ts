// Fase 2 del bug "clona a $0" — subcapítulo Madera (Subcontratos -
// Carpinterías): 7.3.1/7.3.2/7.3.3/7.3.4. Confirmado que en los 4 el
// material del APU coincide con lo que el código describe (sin caso de
// material mal asignado). Ninguno usado en Rubro real de HOGAR/Matisse
// Monet.
//
// Hallazgo: "Tornillos y herrajes" (7.3.1/7.3.2) y "Tornillos y
// herrajes mueble" (7.3.3/7.3.4) YA tienen PrecioMTOP real (MAT-TORN-MET
// $450/gl, MAT-TORN-MUEBLE $380/gl) — matchean por contains, no hacía
// falta investigar esos. Solo la puerta/ventana en sí necesitaba precio.
//
// Fuentes de precio — Generador de Precios de la Construcción Uruguay
// (CYPE Ingenieros), el mismo tipo de fuente ya usado para el estudio de
// suelos en la Fase 1:
//  - 7.3.1 (Puerta exterior 0.90x2.10m): AJUSTADO tras revisión — la
//    referencia CYPE inicial daba una caída de -72% vs. el histórico,
//    señal de que era de gama más económica de lo esperado para una
//    puerta de entrada estándar. Se reemplazó por un precio de venta
//    REAL (no estimador): Tienda Waluminio, puerta de cedro macizo (no
//    enchapado) 85x205cm, $11.295,50 — confirmado "maciza", no la gama
//    básica. Escalado por área a 1,89m² (0.90x2.10m) → $12.251,44.
//    (Se descartó como ancla la puerta "acorazada normalizada" de CYPE,
//    $30.284,68 — es categoría de seguridad/blindada, no una puerta de
//    entrada estándar).
//  - 7.3.2 (Puerta interior 0.80x2.05m): CYPE "Puerta interior de
//    abrir, de madera" (203x82,5x3,5cm, tablero hueco alveolar,
//    melamina) — materiales $3.879,33 para 1,675m², prácticamente el
//    mismo tamaño que 0.80x2.05 (1,64m²) → escalado a $3.797,65.
//  - 7.3.3 (Ventana corrediza con celosía 1.20x1.00m): SIN match directo
//    en CYPE para corredizo+celosía. ⚠️ ESTIMACIÓN GRUESA derivada de la
//    tarifa de carpintería exterior de madera de CYPE ($33.929,28/m²
//    solo materiales, ventana abisagrada pino 600x600mm), reducida 15%
//    por ser corredizo (mecanismo más simple que abisagrado/oscilante) y
//    con un 15% adicional por la celosía integrada — $28.839,89/m² neto
//    aprox. tras compensar ambos ajustes, × 1,20m².
//  - 7.3.4 (Puerta ventana corrediza 1.80x2.05m): SIN match directo en
//    CYPE. ⚠️ ESTIMACIÓN GRUESA derivada de la tarifa de puerta exterior
//    CYPE ($5.509,20/m² solo materiales) + 40% por ser un paño corredizo
//    vidriado de mayor tamaño (más vidrio, riel y herrajes de
//    deslizamiento) → $7.712,88/m² × 3,69m².
//
// Sin cambios de MO (rendimientos originales del import SAU, correctos).
//
// GG=15%/Util=10%, sin leyes sociales.
//
// Ejecutar (dry-run): npx tsx scripts/fix-madera-carpinterias.ts
// Ejecutar (real):     npx tsx scripts/fix-madera-carpinterias.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;

// Tarifas CYPE reales, materiales solamente (sin MO/tools de CYPE, que no usamos)
const CYPE_PUERTA_EXTERIOR_M2 = 9227.91 / (0.825 * 2.03); // $5.509,20/m² — se sigue usando para derivar 7.3.4, NO para 7.3.1
const CYPE_PUERTA_INTERIOR_M2 = 3879.33 / (0.825 * 2.03); // $2.312,66/m²
const CYPE_VENTANA_ABISAGRADA_M2 = 12214.54 / (0.6 * 0.6); // $33.929,28/m²

// 7.3.1 — reemplazado tras revisión (ver comentario arriba): precio de
// venta real (Tienda Waluminio), no un estimador genérico.
const WALUMINIO_PUERTA_EXTERIOR_MACIZA_M2 = 11295.5 / (0.85 * 2.05); // $6.482,83/m²

const RATE_VENTANA_CORREDIZA_CELOSIA_M2 = CYPE_VENTANA_ABISAGRADA_M2 * 0.85 * 1.15; // -15% corredizo, +15% celosía
const RATE_PUERTA_VENTANA_CORREDIZA_M2 = CYPE_PUERTA_EXTERIOR_M2 * 1.4; // +40% por paño vidriado corredizo grande

const PRECIOS_NUEVOS = [
  { codigo: "MAT-MADERA-PUERTA-EXT-090210", descripcion: "Puerta exterior de madera 0.90x2.10m", area: 0.9 * 2.1, ratePorM2: WALUMINIO_PUERTA_EXTERIOR_MACIZA_M2 },
  { codigo: "MAT-MADERA-PUERTA-INT-080205", descripcion: "Puerta interior de madera 0.80x2.05m", area: 0.8 * 2.05, ratePorM2: CYPE_PUERTA_INTERIOR_M2 },
  { codigo: "MAT-MADERA-VENTANA-CORR-CELOSIA-120100", descripcion: "Ventana corrediza de madera con celosía 1.20x1.00m", area: 1.2 * 1.0, ratePorM2: RATE_VENTANA_CORREDIZA_CELOSIA_M2 },
  { codigo: "MAT-MADERA-PTAVENT-CORR-180205", descripcion: "Puerta ventana corrediza de madera 1.80x2.05m", area: 1.8 * 2.05, ratePorM2: RATE_PUERTA_VENTANA_CORREDIZA_M2 },
] as const;

const CODIGOS = ["7.3.1", "7.3.2", "7.3.3", "7.3.4"];

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);

  console.log("── PrecioMTOP nuevos ──");
  const preciosPorMaterial = new Map<string, number>();
  for (const p of PRECIOS_NUEVOS) {
    const precioUnitario = Math.round(p.area * p.ratePorM2 * 100) / 100;
    preciosPorMaterial.set(p.descripcion, precioUnitario);
    const existente = await db.precioMTOP.findUnique({ where: { codigo: p.codigo } });
    console.log(`  ${existente ? "= ya existe" : "+ nuevo"} — ${p.codigo} — ${p.descripcion} — área ${p.area.toFixed(2)}m² × $${p.ratePorM2.toFixed(2)}/m² = $${precioUnitario}/u`);
    if (aplicar) {
      await db.precioMTOP.upsert({
        where: { codigo: p.codigo },
        create: {
          codigo: p.codigo,
          descripcion: p.descripcion,
          cantidadUnidad: "1 u",
          unidad: "u",
          cantidad: 1,
          precioConIva: precioUnitario,
          precioUnitario,
          numeroLista: 0,
          fechaLista: FECHA,
        },
        update: { precioUnitario, precioConIva: precioUnitario },
      });
    }
  }

  const categoriasLaborales = await db.categoriaLaboral.findMany();
  const jornalPorNombre = (nombre: string) =>
    categoriasLaborales.find((c) => c.nombre.trim().toLowerCase() === nombre.trim().toLowerCase())?.jornal ?? 0;
  // Tornillos y herrajes / Tornillos y herrajes mueble YA tienen PrecioMTOP real —
  // se resuelven en vivo con el mismo lookup que usa clonar-apu.
  const preciosMTOP = await db.precioMTOP.findMany();
  const resolverPrecioExistente = (descripcion: string) => {
    const desc = descripcion.toLowerCase();
    const match = preciosMTOP.find((p) => p.descripcion.toLowerCase().includes(desc));
    return match?.precioUnitario ?? 0;
  };

  console.log("\n── Recalculo de 7.3.1 / 7.3.2 / 7.3.3 / 7.3.4 ──");
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
      const precio = preciosPorMaterial.get(m.descripcion) ?? resolverPrecioExistente(m.descripcion);
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
