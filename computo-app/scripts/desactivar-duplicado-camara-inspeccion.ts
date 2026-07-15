// Desactiva "sanitaria-015" (Cámara de inspección 60x60cm sin sifón) por
// ser duplicado exacto de "7.2.8" (Cámara de inspección con tapa y
// contratapa 60x60cm, mismo producto — import original SAU ago. 2022):
// mismos 4 materiales con los mismos rendimientos, misma mano de obra
// (Oficial albañil y Peón, 0,5 cada uno). La única diferencia era
// cosmética (unidad "GL" vs "U") y que sanitaria-015 nunca tuvo precio
// calculado. 7.2.8 queda como única fuente de verdad activa.
//
// "sanitaria-014" (con sifón desconector) NO se toca — es un producto
// distinto y legítimo (material extra real: sifón desconector; mano de
// obra más lenta, 0,4 en vez de 0,5).
//
// Ninguno de los dos códigos está en uso en Rubros reales de HOGAR ni
// Matisse Monet (verificado antes de tocar).
//
// Se desactiva (activo: false), no se borra — mismo criterio que los
// duplicados anteriores de esta sesión (contrapiso, demolición).
//
// Idempotente vía upsert (chequea el estado actual antes de escribir).
//
// Ejecutar: npx tsx scripts/desactivar-duplicado-camara-inspeccion.ts

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

const CODIGO_DUPLICADO = "sanitaria-015";

async function main() {
  const existente = await p.subrubroEstandar.findUnique({ where: { codigo: CODIGO_DUPLICADO } });
  if (!existente) {
    console.warn(`✗ ${CODIGO_DUPLICADO} no encontrado`);
    await p.$disconnect();
    return;
  }
  if (!existente.activo) {
    console.log(`= ${CODIGO_DUPLICADO} ya estaba desactivado`);
  } else {
    await p.subrubroEstandar.update({
      where: { codigo: CODIGO_DUPLICADO },
      data: { activo: false },
    });
    console.log(`+ ${CODIGO_DUPLICADO} desactivado (duplicado de 7.2.8)`);
  }
  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
