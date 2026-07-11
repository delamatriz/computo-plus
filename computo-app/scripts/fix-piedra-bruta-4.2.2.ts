// Corrige un dato inconsistente en el APUEstandar del código 4.2.2 (DADO DE
// HORMIGÓN CICLÓPEO): la Piedra bruta estaba en 0.25 m3, pero el cemento
// (200 kg), la arena gruesa (0.50 m3) y el balasto (0.80 m3) del mismo APU
// son idénticos a los de 4.1.1 y 4.1.2, que sí están en 0.30 m3 de piedra.
// Esos tres valores solo son consistentes si los tres códigos partieron de
// la misma base 30% de piedra — este script alinea el 4.2.2 antes de
// aplicar la feature de % Piedra editable (ver CLAUDE.md / conversación).
//
// Ejecutar: npx tsx scripts/fix-piedra-bruta-4.2.2.ts

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

async function main() {
  const sub = await p.subrubroEstandar.findUnique({
    where: { codigo: "4.2.2" },
    include: { apuEstandar: { include: { materiales: true } } },
  });

  if (!sub?.apuEstandar) {
    console.error("✗ No se encontró APUEstandar para el código 4.2.2");
    process.exit(1);
  }

  const piedra = sub.apuEstandar.materiales.find((m) =>
    /piedra bruta/i.test(m.descripcion)
  );

  if (!piedra) {
    console.error("✗ No se encontró material 'Piedra bruta' en el APU de 4.2.2");
    process.exit(1);
  }

  if (piedra.rendimiento === 0.3) {
    console.log("✓ Piedra bruta de 4.2.2 ya está en 0.30 — nada que hacer");
    await p.$disconnect();
    return;
  }

  console.log(`Piedra bruta 4.2.2: ${piedra.rendimiento} → 0.30`);
  await p.materialAPUEstandar.update({
    where: { id: piedra.id },
    data: { rendimiento: 0.3 },
  });
  console.log("✓ Corregido");

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
