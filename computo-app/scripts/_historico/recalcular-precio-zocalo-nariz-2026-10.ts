// Biblioteca — recalcula SubrubroEstandar.precioUY de 7.12.13 (Zócalo de
// madera) y 7.12.19 (Nariz de madera), que quedaron desfasados al pasar su
// material "Tornillos y herrajes" a "Tornillos y herrajes mueble" ($380 en
// vez de $450, decisión de Luis — ver renombrar-materiales-ambiguos-2026-10).
//
// Misma fórmula que la Biblioteca (apu-calc.ts) y misma resolución de
// precios que src/lib/resolverPrecioInsumo.ts (exacta primero). Antes de
// escribir compara con el precio que mostró la app en la ruta descompuesto
// (verificado el 2026-10-09); si no coincide, aborta sin escribir.
//
// Idempotente: si el precio guardado ya es el calculado, no hace nada.
//
// Ejecutar (dry-run): npx tsx scripts/recalcular-precio-zocalo-nariz-2026-10.ts
// Ejecutar (real):     npx tsx scripts/recalcular-precio-zocalo-nariz-2026-10.ts --apply

import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { calcularPrecioUnitario, sumEquipos, sumManoObra } from "../src/lib/apu-calc";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PrismaClient({ adapter });

// Precio que calculó la app (GET /api/subrubros-estandar/[id]/descompuesto).
const ESPERADO: Record<string, number> = { "7.12.13": 673.72, "7.12.19": 2237.62 };

const redondear2 = (n: number) => Math.round(n * 100) / 100;
const money = (n: number) => n.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const normalizar = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

function primera<T extends { descripcion: string; codigo: string }>(buscada: string, filas: T[]): T | undefined {
  const obj = normalizar(buscada);
  return [...filas].sort(
    (a, b) =>
      (normalizar(a.descripcion) === obj ? 0 : 1) - (normalizar(b.descripcion) === obj ? 0 : 1) ||
      a.descripcion.length - b.descripcion.length ||
      a.codigo.localeCompare(b.codigo)
  )[0];
}

async function main() {
  const aplicar = process.argv.includes("--apply");
  console.log(`Modo: ${aplicar ? "APLICAR A PRODUCCIÓN" : "DRY RUN (nada se escribe)"}\n`);

  const categorias = await db.categoriaLaboral.findMany();
  const jornal = (n: string) => categorias.find((c) => c.nombre.trim().toLowerCase() === n.trim().toLowerCase())?.jornal ?? 0;
  const actualizar: { id: string; codigo: string; nuevo: number }[] = [];

  for (const codigo of Object.keys(ESPERADO)) {
    const s = await db.subrubroEstandar.findUnique({
      where: { codigo },
      include: { apuEstandar: { include: { materiales: true, manoObra: true, equipos: true } } },
    });
    if (!s?.apuEstandar) throw new Error(`No existe ${codigo} con APU — no se escribe nada`);
    const apu = s.apuEstandar;

    let sumMat = 0;
    for (const m of apu.materiales) {
      const filas = await db.precioMTOP.findMany({ where: { descripcion: { contains: m.descripcion.trim(), mode: "insensitive" } } });
      sumMat += m.rendimiento * (primera(m.descripcion, filas)?.precioUnitario ?? 0);
    }
    const eqs: { id: string; rendimiento: number; costoUnit: number }[] = [];
    for (const e of apu.equipos) {
      const filas = await db.precioEquipo.findMany({ where: { descripcion: { contains: e.descripcion.trim(), mode: "insensitive" } } });
      eqs.push({ id: e.id, rendimiento: e.rendimiento, costoUnit: primera(e.descripcion, filas)?.precioHora ?? 0 });
    }
    const mos = apu.manoObra.map((m) => ({ rendimiento: m.rendimiento, jornalRef: jornal(m.categoria), equipoRelacionadoId: m.equipoRelacionadoId }));
    const nuevo = redondear2(calcularPrecioUnitario(sumMat + sumManoObra(mos, eqs) + sumEquipos(eqs), apu.utilidadPct));

    if (Math.abs(nuevo - ESPERADO[codigo]) > 0.004) {
      throw new Error(`${codigo}: el cálculo da $${money(nuevo)} y la app mostró $${money(ESPERADO[codigo])} — no se escribe nada`);
    }
    const cambia = Math.abs(s.precioUY - nuevo) > 0.004;
    console.log(`  ${codigo} ${s.descripcion}: guardado $${money(s.precioUY)} → ${cambia ? `$${money(nuevo)}` : "sin cambio"}`);
    if (cambia) actualizar.push({ id: s.id, codigo, nuevo });
  }

  if (actualizar.length === 0) {
    console.log("\n= Ya está todo aplicado. Sin cambios.");
    await db.$disconnect();
    return;
  }
  if (aplicar) {
    await db.$transaction(actualizar.map((a) => db.subrubroEstandar.update({ where: { id: a.id }, data: { precioUY: a.nuevo } })));
  }
  console.log(aplicar ? "\nAPLICADO." : "\nDRY RUN: no se escribió nada. Para aplicar: --apply (con el OK de Luis).");
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
