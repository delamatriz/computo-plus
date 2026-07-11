// Corrige la proporción cal:arena del APU de biblioteca estándar 6.2.5
// (REVOQUE FINO MURO INTERIOR), que tenía cal (4 kg/m2) superando a la
// arena (0,006 m3/m2) — una proporción que no corresponde a ningún tipo
// de mortero de la Memoria Constructiva General MTOP 2006 (Sección 9.4).
//
// Corrección: Tipo E (1 cemento pórtland : 5 Mortero A, donde Mortero A =
// 1 cal : 3 arena gruesa) — el mismo tipo que ya matchea con el revoque
// grueso interior (6.2.4) — manteniendo el cemento actual (3 kg/m2) como
// ancla del cálculo.
//
//   Cal hidratada:  4     kg → 1,24   kg
//   Arena fina:     0,006 m3 → 0,00743 m3
//
// No toca cemento, mano de obra, ni ningún otro código (6.2.4 y demás
// quedan sin cambios).
//
// Idempotente: si los valores ya están en el objetivo, no vuelve a
// escribir nada.
//
// Ejecutar: npx tsx scripts/fix-cal-arena-revoque-fino-interior-6.2.5.ts

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

const OBJETIVO: Record<string, number> = {
  "cal hidratada": 1.24,
  "arena fina": 0.00743,
};

async function main() {
  const sub = await p.subrubroEstandar.findUnique({
    where: { codigo: "6.2.5" },
    include: { apuEstandar: { include: { materiales: true } } },
  });

  if (!sub?.apuEstandar) {
    console.error("✗ No se encontró APUEstandar para el código 6.2.5");
    process.exit(1);
  }

  let cambiados = 0;
  let yaOk = 0;

  for (const [clave, valorObjetivo] of Object.entries(OBJETIVO)) {
    const material = sub.apuEstandar.materiales.find((m) =>
      m.descripcion.toLowerCase().includes(clave)
    );
    if (!material) {
      console.warn(`✗ 6.2.5 — no se encontró material que contenga "${clave}"`);
      continue;
    }
    if (Math.abs(material.rendimiento - valorObjetivo) < 1e-9) {
      console.log(`= 6.2.5 — "${material.descripcion}" ya está en ${valorObjetivo} ${material.unidad}`);
      yaOk++;
      continue;
    }
    console.log(`↻ 6.2.5 — "${material.descripcion}": ${material.rendimiento} → ${valorObjetivo} ${material.unidad}`);
    await p.materialAPUEstandar.update({
      where: { id: material.id },
      data: { rendimiento: valorObjetivo },
    });
    cambiados++;
  }

  console.log(`\nCambiados: ${cambiados} — Ya correctos: ${yaOk}`);
  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
