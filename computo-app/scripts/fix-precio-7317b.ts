// Fase 2 del bug "clona a $0" — Sub-tanda 1 de los 13 pendientes en
// Carpinterías: corrige un error real, no una investigación nueva.
//
// 7.3.17b (Puerta ventana corrediza aluminio Serie 25 2.00x2.05m) se
// había dado por resuelto en la sesión de Aluminio (Gala/Probba) con
// el comentario "ya quedó correctamente precificado ($57.279,44) — no
// se toca en esta tanda". Eso era falso: se revisó ahora y su
// `precioUY` seguía en $19.519,67 con `fechaBase: 2022-08` (el valor
// original, jamás actualizado) y su material no tenía ningún
// `PrecioMTOP` que lo matchee — seguía clonando a $0. El cálculo se
// hizo pero nunca se aplicó a producción.
//
// Este script aplica la tarifa Serie 25 real ya confirmada y usada
// como ancla en 7.3.18 ($9.469,70/m², = $12.500 / (1.20×1.10 m²)),
// escalada al área de 7.3.17b (2.00×2.05 = 4,10 m²). Misma silicona
// (MAT-SILICONA-VEN, $280/u, ya con precio real) y misma mano de obra
// existente (Oficial especializado + Peón, rendimiento 0.7 cada uno) —
// sin cambios de MO, solo se corrige el precio del material principal.
//
// GG 15% / Utilidad 10%, sin leyes sociales (no aplica en biblioteca).
//
// Ejecutar (dry-run): npx tsx scripts/fix-precio-7317b.ts
// Ejecutar (real):     npx tsx scripts/fix-precio-7317b.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;

const CODIGO = "7.3.17b";
const ANCHO = 2.0;
const ALTO = 2.05;
const SERIE25_RATE_M2 = 12500 / (1.2 * 1.1); // ancla real, misma que 7.3.18
const MATERIAL_DESCRIPCION = "Puerta ventana corrediza aluminio serie 25 2.00x2.05m";
const CODIGO_MTOP = "MAT-ALUM-73170B";

const SILICONA_VENTANAS = { descripcion: "Silicona para ventanas", precioUnitario: 280 };
const MO = [
  { categoria: "Oficial especializado", rendimiento: 0.7 },
  { categoria: "Peón", rendimiento: 0.7 },
];

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);

  const area = ANCHO * ALTO;
  const precioMaterial = Math.round(area * SERIE25_RATE_M2 * 100) / 100;

  const categoriasLaborales = await db.categoriaLaboral.findMany();
  const jornalPorNombre = (nombre: string) =>
    categoriasLaborales.find((c) => c.nombre.trim().toLowerCase() === nombre.trim().toLowerCase())?.jornal ?? 0;

  const sumMat = precioMaterial + SILICONA_VENTANAS.precioUnitario;
  const sumMO = MO.reduce((s, mo) => s + jornalPorNombre(mo.categoria) / mo.rendimiento, 0);
  const costoDirecto = sumMat + sumMO;
  const precioUY = Math.round(costoDirecto * (1 + GG_PCT / 100) * (1 + UTIL_PCT / 100) * 100) / 100;

  const s = await db.subrubroEstandar.findUnique({ where: { codigo: CODIGO } });

  console.log(`${CODIGO} — ${s?.descripcion}`);
  console.log(`  área: ${ANCHO}×${ALTO} = ${area.toFixed(2)} m² — tarifa Serie 25 $${SERIE25_RATE_M2.toFixed(2)}/m²`);
  console.log(`  material: ${MATERIAL_DESCRIPCION} — $${precioMaterial}/u (${CODIGO_MTOP})`);
  console.log(`  material: ${SILICONA_VENTANAS.descripcion} — $${SILICONA_VENTANAS.precioUnitario}/u (ya real, sin cambios)`);
  MO.forEach((mo) => console.log(`  MO: ${mo.categoria} — rendimiento ${mo.rendimiento} U/jornada (sin cambios)`));
  console.log(`  sumMat=$${sumMat.toFixed(2)} sumMO=$${sumMO.toFixed(2)} costoDirecto=$${costoDirecto.toFixed(2)}`);
  console.log(`  precioUY actual: $${s?.precioUY} (fechaBase ${s?.fechaBase}) → NUEVO: $${precioUY}`);

  if (!aplicar) {
    console.log("\nDry-run — nada se escribió.");
    await db.$disconnect();
    return;
  }

  await db.precioMTOP.upsert({
    where: { codigo: CODIGO_MTOP },
    create: {
      codigo: CODIGO_MTOP,
      descripcion: MATERIAL_DESCRIPCION,
      cantidadUnidad: "1 u",
      unidad: "u",
      cantidad: 1,
      precioConIva: precioMaterial,
      precioUnitario: precioMaterial,
      numeroLista: 0,
      fechaLista: FECHA,
    },
    update: { precioUnitario: precioMaterial, precioConIva: precioMaterial },
  });

  await db.subrubroEstandar.update({ where: { codigo: CODIGO }, data: { precioUY, fechaBase: FECHA } });

  console.log("\nAplicado.");
  await db.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await db.$disconnect();
  process.exit(1);
});
