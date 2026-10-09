// Biblioteca — materiales de APU estándar con descripción ambigua frente a
// PrecioMTOP (coinciden con varias filas a precios distintos). Con la
// resolución nueva (src/lib/resolverPrecioInsumo.ts: descripción exacta
// primero) cambiaban de fila; Luis decidió a cuál apunta cada uno y acá se
// renombra el material para que coincida EXACTO con esa fila:
//
//   5.1.2, 5.2.1, 5.2.2 (hormigón ciclópeo): "Piedra bruta" →
//       "Piedra bruta (en obra)" (Lista MTOP, código 177) — la que ya usaban.
//   7.12.13 zócalo de madera, 7.12.19 nariz de madera: "Tornillos y herrajes"
//       → "Tornillos y herrajes mueble" (MAT-TORN-MUEBLE, $380).
//   15.5.1, 15.5.2 puertas: "Tornillos y herrajes" →
//       "Tornillos y herrajes metálicos" (MAT-TORN-MET, $450) — la que ya usaban.
//
// Solo renombra: SubrubroEstandar.precioUY no se toca (en estos subrubros ya
// estaba desfasado por otras causas — jornales actualizados, hormigonera —;
// recalcularlo es una decisión aparte). Ningún proyecto se toca: sus
// materiales copiados quedan vinculados por id (MaterialAPU.precioMTOPId).
//
// Idempotente: si el material ya tiene el nombre nuevo, no hace nada. Aborta
// sin escribir si un subrubro no tiene el material esperado o si el nombre
// nuevo no coincide exacto con la fila esperada.
//
// Ejecutar (dry-run): npx tsx scripts/renombrar-materiales-ambiguos-2026-10.ts
// Ejecutar (real):     npx tsx scripts/renombrar-materiales-ambiguos-2026-10.ts --apply

import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

const CAMBIOS: { subrubros: string[]; desde: string; hasta: string; codigoPrecio: string }[] = [
  { subrubros: ["5.1.2", "5.2.1", "5.2.2"], desde: "Piedra bruta", hasta: "Piedra bruta (en obra)", codigoPrecio: "177" },
  { subrubros: ["7.12.13", "7.12.19"], desde: "Tornillos y herrajes", hasta: "Tornillos y herrajes mueble", codigoPrecio: "MAT-TORN-MUEBLE" },
  { subrubros: ["15.5.1", "15.5.2"], desde: "Tornillos y herrajes", hasta: "Tornillos y herrajes metálicos", codigoPrecio: "MAT-TORN-MET" },
];

const money = (n: number) => n.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const normalizar = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);

  const renombres: { materialId: string; hasta: string }[] = [];

  for (const c of CAMBIOS) {
    // El nombre nuevo tiene que coincidir EXACTO con una sola fila: la esperada.
    const exactas = await db.precioMTOP.findMany({
      where: { descripcion: { equals: c.hasta, mode: "insensitive" } },
      select: { codigo: true, precioUnitario: true, descripcion: true },
    });
    if (exactas.length !== 1 || exactas[0].codigo !== c.codigoPrecio) {
      throw new Error(`«${c.hasta}» coincide exacto con ${exactas.map((e) => e.codigo).join(", ") || "nada"} (se esperaba solo ${c.codigoPrecio}) — no se escribe nada`);
    }
    console.log(`«${c.desde}» → «${c.hasta}» (${exactas[0].codigo} · $${money(exactas[0].precioUnitario)})`);

    for (const cod of c.subrubros) {
      const s = await db.subrubroEstandar.findUnique({
        where: { codigo: cod },
        include: { apuEstandar: { include: { materiales: true } } },
      });
      if (!s?.apuEstandar) throw new Error(`No existe ${cod} con APU — no se escribe nada`);
      const aRenombrar = s.apuEstandar.materiales.filter((m) => normalizar(m.descripcion) === normalizar(c.desde));
      const yaRenombrado = s.apuEstandar.materiales.some((m) => normalizar(m.descripcion) === normalizar(c.hasta));
      if (aRenombrar.length === 0 && !yaRenombrado) {
        throw new Error(`${cod} no tiene «${c.desde}» ni «${c.hasta}» — no se escribe nada`);
      }
      for (const m of aRenombrar) renombres.push({ materialId: m.id, hasta: c.hasta });
      console.log(`  ${cod.padEnd(8)} ${s.descripcion} — ${aRenombrar.length ? `se renombra (${aRenombrar.length})` : "= ya renombrado"}`);
    }
  }

  if (renombres.length === 0) {
    console.log("\n= Ya está todo aplicado. Sin cambios.");
    await db.$disconnect();
    return;
  }
  console.log(`\nCambios: ${renombres.length} material(es) renombrado(s).`);

  if (aplicar) {
    await db.$transaction(async (tx) => {
      for (const r of renombres) await tx.materialAPUEstandar.update({ where: { id: r.materialId }, data: { descripcion: r.hasta } });
    }, { timeout: 60000 });
  }
  console.log(aplicar ? "APLICADO." : "DRY RUN: no se escribió nada. Para aplicar: --apply (con el OK de Luis).");
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
