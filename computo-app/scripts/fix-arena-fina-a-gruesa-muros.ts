// Corrige el mortero de asentado de los 12 APUs de MURO (asentado de
// ladrillo/ticholo, serie 6.1.x): usaban "Arena fina (en obra)" cuando la
// proporción cemento:arena ya cargada (~1:3 en volumen) corresponde al
// Tipo F del MTOP (Memoria Constructiva General MTOP 2006, sección 9.4.2) —
// 1 cemento pórtland : 3 arena GRUESA. En la práctica de albañilería
// uruguaya el asentado de mampuestos se hace con arena gruesa; la arena
// fina se reserva para revoques y terminaciones (esos APUs — serie 6.2.x
// y otros — NO se tocan).
//
// Cambia solo el insumo (descripcion), no la cantidad (rendimiento) — el
// precio de referencia MTOP se resuelve por descripción al clonar el APU
// (ver clonar-apu route), así que no hay precioUnit que actualizar acá.
//
// Idempotente: si ya está en "Arena gruesa (en obra)" no hace nada.
//
// Ejecutar: npx tsx scripts/fix-arena-fina-a-gruesa-muros.ts

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

const CODIGOS = [
  "6.1.1", "6.1.2", "6.1.3", "6.1.4", "6.1.5", "6.1.6",
  "6.1.7", "6.1.8", "6.1.9", "6.1.10", "6.1.11", "6.1.12",
];

const DE = "Arena fina (en obra)";
const A = "Arena gruesa (en obra)";

async function main() {
  let cambiados = 0;
  let yaOk = 0;
  let sinMaterial = 0;
  let noEncontrados = 0;

  for (const codigo of CODIGOS) {
    const sub = await p.subrubroEstandar.findUnique({
      where: { codigo },
      include: { apuEstandar: { include: { materiales: true } } },
    });

    if (!sub?.apuEstandar) {
      console.warn(`✗ ${codigo} — no se encontró APUEstandar`);
      noEncontrados++;
      continue;
    }

    const material = sub.apuEstandar.materiales.find((m) => m.descripcion === DE);
    const yaCorregido = sub.apuEstandar.materiales.find((m) => m.descripcion === A);

    if (!material) {
      if (yaCorregido) {
        console.log(`= ${codigo} — ${sub.descripcion} — ya está en "${A}" (rendimiento ${yaCorregido.rendimiento})`);
        yaOk++;
      } else {
        console.warn(`✗ ${codigo} — ${sub.descripcion} — no tiene "${DE}" ni "${A}"`);
        sinMaterial++;
      }
      continue;
    }

    console.log(`↻ ${codigo} — ${sub.descripcion} — "${DE}" (${material.rendimiento} ${material.unidad}) → "${A}" (${material.rendimiento} ${material.unidad})`);
    await p.materialAPUEstandar.update({
      where: { id: material.id },
      data: { descripcion: A },
    });
    cambiados++;
  }

  console.log("\n── Resumen ──");
  console.log(`Cambiados:      ${cambiados}`);
  console.log(`Ya corregidos:  ${yaOk}`);
  console.log(`Sin material:   ${sinMaterial}`);
  console.log(`No encontrados: ${noEncontrados}`);
  console.log(`Total definidos: ${CODIGOS.length}`);

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
