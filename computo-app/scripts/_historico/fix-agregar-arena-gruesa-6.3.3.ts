// Agrega Arena gruesa al APU de biblioteca estándar 6.3.3 (CONTRAPISO
// SOBRE LOSA DE BAÑO e=20cm), que tenía cemento (24kg) y balasto (0,20 m3)
// pero sin el acompañante de arena gruesa que sí lleva su código hermano
// 6.3.1 (CONTRAPISO SOBRE TIERRA DE BALASTO 10cm: arena 0,03 m3 + balasto
// 0,12 m3 — proporción 1 arena : 4 balasto).
//
// Cemento y espesor son intencionales (verificado: 24kg/0,20m = 120 kg
// cemento/m3, misma tasa que 6.3.2) — no se tocan.
//
// Arena gruesa = 0,05 m3, aplicando la misma proporción 1:4 de 6.3.1 al
// balasto actual de 6.3.3 (0,20 m3 balasto ÷ 4 = 0,05 m3 arena).
//
// No toca cemento (24kg), balasto (0,20 m3), descripción/espesor, mano de
// obra, ni ningún otro código (6.3.1, 6.3.2, etc.).
//
// Idempotente: si la arena gruesa ya está en 0,05 m3, no vuelve a escribir.
//
// Ejecutar: npx tsx scripts/fix-agregar-arena-gruesa-6.3.3.ts

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

const DESCRIPCION_ARENA = "Arena gruesa (en obra)";
const RENDIMIENTO_OBJETIVO = 0.05;

async function main() {
  const sub = await p.subrubroEstandar.findUnique({
    where: { codigo: "6.3.3" },
    include: { apuEstandar: { include: { materiales: true } } },
  });

  if (!sub?.apuEstandar) {
    console.error("✗ No se encontró APUEstandar para el código 6.3.3");
    process.exit(1);
  }

  const arenaExistente = sub.apuEstandar.materiales.find(
    (m) => m.descripcion === DESCRIPCION_ARENA
  );

  if (arenaExistente) {
    if (Math.abs(arenaExistente.rendimiento - RENDIMIENTO_OBJETIVO) < 1e-9) {
      console.log(`= 6.3.3 — "${DESCRIPCION_ARENA}" ya está en ${RENDIMIENTO_OBJETIVO} m3`);
      await p.$disconnect();
      return;
    }
    console.log(`↻ 6.3.3 — "${DESCRIPCION_ARENA}": ${arenaExistente.rendimiento} → ${RENDIMIENTO_OBJETIVO} m3`);
    await p.materialAPUEstandar.update({
      where: { id: arenaExistente.id },
      data: { rendimiento: RENDIMIENTO_OBJETIVO },
    });
  } else {
    console.log(`+ 6.3.3 — agregando "${DESCRIPCION_ARENA}" = ${RENDIMIENTO_OBJETIVO} m3`);
    await p.materialAPUEstandar.create({
      data: {
        apuId: sub.apuEstandar.id,
        descripcion: DESCRIPCION_ARENA,
        unidad: "m3",
        rendimiento: RENDIMIENTO_OBJETIVO,
      },
    });
  }

  console.log("✓ Listo");
  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
