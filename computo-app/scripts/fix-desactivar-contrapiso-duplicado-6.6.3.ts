// Desactiva el subrubro estándar 6.6.3 ("CONTRAPISO SOBRE LOSA DE HORMIGÓN
// e=5cm", mal clasificado bajo "Impermeabilizaciones y Aislaciones"), que
// es un duplicado exacto de 6.3.2 (mismo nombre, unidad, precio, aportes
// sociales e insumos — Arena gruesa 0,025 m3 + Cemento 6 kg por m2), la
// versión correctamente ubicada en el subcapítulo "Contrapisos". Ninguno de
// los dos códigos está en uso en proyectos reales (verificado antes de
// aplicar este cambio).
//
// No elimina el registro (se desactiva con activo: false, para no perder
// historial) y no toca 6.3.2 ni ningún otro código — 6.3.2 queda como la
// única fuente de verdad activa para este ítem.
//
// Idempotente: si ya está en activo:false no vuelve a tocarlo.
//
// Ejecutar: npx tsx scripts/fix-desactivar-contrapiso-duplicado-6.6.3.ts

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

async function main() {
  const sub = await p.subrubroEstandar.findUnique({ where: { codigo: "6.6.3" } });

  if (!sub) {
    console.error("✗ No se encontró SubrubroEstandar con código 6.6.3");
    process.exit(1);
  }

  if (!sub.activo) {
    console.log(`= 6.6.3 — "${sub.descripcion}" — ya está desactivado (activo: false)`);
    await p.$disconnect();
    return;
  }

  console.log(`↻ 6.6.3 — "${sub.descripcion}" (subcapítulo: ${sub.subcapitulo}) — activo: true → false`);
  await p.subrubroEstandar.update({
    where: { codigo: "6.6.3" },
    data: { activo: false },
  });
  console.log("✓ Desactivado");

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
