// Mini-tanda de cierre — 8 códigos de Instalación Sanitaria con
// precioUY guardado en $0 pese a que sus materiales YA resuelven
// correctamente hoy (mismo patrón que la mini-tanda de Albañilería y
// carpmet-005 en Carpinterías: nunca se guardó el recálculo, no es el
// bug de material sin precio). Probablemente quedaron en $0 porque
// materiales compartidos (Grifería monocomando ducha, Accesorios de
// colocación sanitaria, Termotanque eléctrico 80L, Caño PVC desagüe
// 110mm) se resolvieron recién como efecto colateral de fixes de
// otras tandas.
//
// Puro recálculo y guardado — sin investigación de mercado, sin
// cambios de material ni de rendimiento. Fórmula de siempre:
// costoDirecto = sumMat + sumMO + sumEq
// precioUY = costoDirecto × (1+15%) × (1+10%)
//
// Ejecutar (dry-run): npx tsx scripts/fix-sanitaria-recalculo-guardado.ts
// Ejecutar (real):     npx tsx scripts/fix-sanitaria-recalculo-guardado.ts --apply

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const FECHA = "2026-07";
const GG_PCT = 15;
const UTIL_PCT = 10;

const CODIGOS = ["sanitaria-002", "sanitaria-003", "sanitaria-006", "sanitaria-007", "sanitaria-008", "sanitaria-011", "sanitaria-012", "sanitaria-020"];

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);

  const todosPrecios = await db.precioMTOP.findMany();
  const resolverPrecio = (desc: string) => todosPrecios.find((p) => p.descripcion.toLowerCase().includes(desc.toLowerCase()))?.precioUnitario ?? 0;

  const categoriasLaborales = await db.categoriaLaboral.findMany();
  const jornalPorNombre = (nombre: string) =>
    categoriasLaborales.find((c) => c.nombre.trim().toLowerCase() === nombre.trim().toLowerCase())?.jornal ?? 0;

  for (const codigo of CODIGOS) {
    const s = await db.subrubroEstandar.findFirst({
      where: { codigo },
      include: { apuEstandar: { include: { materiales: true, manoObra: true, equipos: true } } },
    });
    if (!s || !s.apuEstandar) {
      console.error(`${codigo}: no encontrado o sin APU — abortando.`);
      continue;
    }

    console.log(`\n${codigo} — ${s.descripcion}`);

    let sumMat = 0;
    let algunoSinPrecio = false;
    for (const m of s.apuEstandar.materiales) {
      const precio = resolverPrecio(m.descripcion);
      if (precio === 0) algunoSinPrecio = true;
      sumMat += m.rendimiento * precio;
    }
    let sumMO = 0;
    for (const mo of s.apuEstandar.manoObra) {
      sumMO += jornalPorNombre(mo.categoria) / mo.rendimiento;
    }
    let sumEq = 0; // ninguno de los 8 usa equipos con costo propio

    if (algunoSinPrecio) {
      console.error(`  ⚠️ ${codigo} tiene algún material sin precio — no forma parte de este recálculo puro, se omite.`);
      continue;
    }

    const costoDirecto = sumMat + sumMO + sumEq;
    const precioUY = Math.round(costoDirecto * (1 + GG_PCT / 100) * (1 + UTIL_PCT / 100) * 100) / 100;

    console.log(`  sumMat=$${sumMat.toFixed(2)} sumMO=$${sumMO.toFixed(2)} costoDirecto=$${costoDirecto.toFixed(2)}`);
    console.log(`  precioUY actual: $${s.precioUY} (fechaBase ${s.fechaBase}) → NUEVO: $${precioUY}`);

    if (aplicar) {
      await db.subrubroEstandar.update({ where: { codigo }, data: { precioUY, fechaBase: FECHA } });
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
