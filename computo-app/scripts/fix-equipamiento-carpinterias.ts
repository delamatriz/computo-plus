// Fase 2 del bug "clona a $0" — subcapítulo Equipamiento (Subcontratos -
// Carpinterías): 7.3.9, 7.3.10, 7.3.11. Confirmado que en los 3 el
// material del APU coincide con lo que el código describe (sin caso de
// material mal asignado). "Tornillos y herrajes mueble" (7.3.10/7.3.11)
// ya tenía PrecioMTOP real (MAT-TORN-MUEBLE, $380/gl) — matchea por
// contains, no hacía falta investigar. Ninguno usado en Rubro real de
// HOGAR/Matisse Monet.
//
// Nota: los 3 precioUY guardados en 2022 ($15.743,70 / $23.390,64 /
// $58.476,60) son EXACTAMENTE los valores "precio directo" del Rubrado
// SAU agosto 2022 (rubros 7.3.9/7.3.10/7.3.11) — no un placeholder.
// Igual que en 7.3.1 (Madera), se optó por NO preservar ese total:
// se investigó precio real de material 2026 de forma independiente y
// se reconstruyó precioUY hacia adelante (material + MO real) × 1.265,
// siguiendo el mismo criterio ya usado en Madera/Herrajes/Aluminio.
//
// Fuentes de precio:
//  - 7.3.9 (Mueble de baño con bacha 0.75x0.50x0.65m): Loysa.uy —
//    "Mueble de baño suspendido con bacha de loza" 60cm USD 270 / 80cm
//    USD 320. Interpolado linealmente a 75cm → USD 307,50 → $12.561,38
//    a $40,85/USD (BROU venta, referencia julio 2026). "Accesorios de
//    colocación mueble" (tarugos, tornillos, sellador de silicona para
//    mueble suspendido) sin fuente puntual — ⚠️ estimación gruesa,
//    mismo orden de magnitud que accesorios menores ya usados en otras
//    tandas (7.2.1 Baño Completo).
//  - 7.3.10 (Mueble cocina modulado, ml — mesada + módulos inferiores,
//    sin electro): combina 2 fuentes reales — (a) Sodimac Uruguay,
//    "Bajo mesada Henn 2 puertas 3 cajones" 120cm ancho real, $6.169 →
//    $5.140,83/ml de módulos inferiores (gama media, sin mesada); (b)
//    Rubrado SAU agosto 2022, "MESADA GRANITO GRIS" $12.417,30/m²
//    (rubro 7.2.10, incluye cortes + borde pulido) × 0,60m de
//    profundidad estándar → $7.450,38/ml de mesada. Total combinado
//    $12.591,21/ml. "Tornillos y herrajes mueble" ya real, sin cambios.
//  - 7.3.11 (Placard de puertas corredizas 1.80x2.30x0.65m): segunda
//    fuente reemplaza a la primera (Divino, sin medidas) — Soy Hogar
//    Muebles (soyhogar.com.uy), "Ropero placard 3 puertas corredizas
//    espejo blanco Residence", medidas CONFIRMADAS 2.18m ancho ×
//    2.10m alto × 0.52m profundidad, $17.900 lista / $16.110 con 10%
//    desc. Escalado por área total de paneles (frente+fondo, 2
//    laterales, tapa+piso, 3 estantes — no solo alto×profundidad como
//    en el primer intento) → factor 1,0066 (prácticamente neutro: el
//    placard objetivo es más angosto pero más alto y profundo, el
//    área total de melamina usada es casi la misma) → $16.216,09.
//    Baja bastante respecto a la primera estimación ($34.396,87) al
//    usar una fuente con medidas reales en vez de un promedio sin
//    medidas escalado a ciegas. "Tornillos y herrajes mueble" ya
//    real, sin cambios.
//
// Sin cambios de mano de obra en los 3. GG 15% / Utilidad 10%, sin
// leyes sociales (no aplica en biblioteca).
//
// Ejecutar (dry-run): npx tsx scripts/fix-equipamiento-carpinterias.ts
// Ejecutar (real):     npx tsx scripts/fix-equipamiento-carpinterias.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;

type Def = {
  codigo: string;
  materialCodigoMTOP: string;
  materialDescripcion: string;
  materialPrecio: number;
  accesorioDescripcion?: string; // ya existente en el APU, con precio ya real (no se toca)
};

const DEFS: Def[] = [
  {
    codigo: "7.3.9",
    materialCodigoMTOP: "MAT-MUEBLE-BANO-BACHA-075",
    materialDescripcion: "Mueble de baño con bacha 0.75x0.50x0.65m",
    materialPrecio: 12561.38,
  },
  {
    codigo: "7.3.10",
    materialCodigoMTOP: "MAT-MUEBLE-COCINA-ML",
    materialDescripcion: "Mueble cocina modulado ml",
    materialPrecio: (6169 / 1.2) + (12417.3 * 0.6),
  },
  {
    codigo: "7.3.11",
    materialCodigoMTOP: "MAT-PLACARD-CORR-180230",
    materialDescripcion: "Placard de puertas corredizas 1.80x2.30x0.65m",
    materialPrecio: (() => {
      const areaPaneles = (ancho: number, alto: number, prof: number, estantes = 3) =>
        2 * (ancho * alto) + 2 * (prof * alto) + 2 * (ancho * prof) + estantes * (ancho * prof);
      const escala = areaPaneles(1.8, 2.3, 0.65) / areaPaneles(2.18, 2.1, 0.52);
      return 16110 * escala; // Soy Hogar Muebles, precio real con desc. ($16.110), medidas confirmadas
    })(),
  },
];

// "Accesorios de colocación mueble" — único caso sin PrecioMTOP existente (7.3.9)
const ACCESORIOS_COLOCACION_PRECIO = 450;

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

    const materialPrecio = Math.round(def.materialPrecio * 100) / 100;

    let sumMat = materialPrecio;
    console.log(`\n${def.codigo} — ${s.descripcion}`);
    console.log(`  material: ${def.materialDescripcion} — $${materialPrecio}/u (${def.materialCodigoMTOP})`);

    for (const m of s.apuEstandar.materiales) {
      if (m.descripcion.toLowerCase() === def.materialDescripcion.toLowerCase()) continue;
      let precio = resolverPrecioExistente(m.descripcion);
      if (precio === 0 && m.descripcion.toLowerCase().includes("accesorios de colocación")) {
        precio = ACCESORIOS_COLOCACION_PRECIO;
        console.log(`  material: ${m.descripcion} — $${precio}/${m.unidad} (⚠️ estimación gruesa, sin fuente puntual)`);
      } else {
        console.log(`  material: ${m.descripcion} — $${precio}/${m.unidad} (ya real, sin cambios)`);
      }
      sumMat += m.rendimiento * precio;
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

    await db.precioMTOP.upsert({
      where: { codigo: def.materialCodigoMTOP },
      create: {
        codigo: def.materialCodigoMTOP,
        descripcion: def.materialDescripcion,
        cantidadUnidad: "1 u",
        unidad: "u",
        cantidad: 1,
        precioConIva: materialPrecio,
        precioUnitario: materialPrecio,
        numeroLista: 0,
        fechaLista: FECHA,
      },
      update: { precioUnitario: materialPrecio, precioConIva: materialPrecio },
    });

    const tieneAccesorios = s.apuEstandar.materiales.some((m) => m.descripcion.toLowerCase().includes("accesorios de colocación"));
    if (tieneAccesorios) {
      await db.precioMTOP.upsert({
        where: { codigo: "MAT-ACCESORIOS-COLOC-MUEBLE" },
        create: {
          codigo: "MAT-ACCESORIOS-COLOC-MUEBLE",
          descripcion: "Accesorios de colocación mueble",
          cantidadUnidad: "1 gl",
          unidad: "gl",
          cantidad: 1,
          precioConIva: ACCESORIOS_COLOCACION_PRECIO,
          precioUnitario: ACCESORIOS_COLOCACION_PRECIO,
          numeroLista: 0,
          fechaLista: FECHA,
        },
        update: { precioUnitario: ACCESORIOS_COLOCACION_PRECIO, precioConIva: ACCESORIOS_COLOCACION_PRECIO },
      });
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
