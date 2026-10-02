// Migración — completa proveedor/fechaUltimaVerificacion en los
// MaterialAPU reales (XXI/PRADO/POCITOS) que fueron clonados desde la
// biblioteca ANTES de que clonar-apu/route.ts empezara a propagar esos 2
// campos (mismo gap que ya existía para motivoVerificacion hace tiempo,
// ahora extendido a proveedor/fechaUltimaVerificacion).
//
// Mismo mecanismo de matching que ya usa clonar-apu/route.ts: busca en
// PrecioMTOP por descripción (contains, insensitive), tomando el primer
// match por id. Si el match tiene proveedor (universo "mercado libre" de
// FEAT-AI-006), completa proveedor + fechaUltimaVerificacion. Si el match
// es de la Lista MTOP oficial (proveedor null) o no hay match, el
// material queda sin tocar — no hay nada que propagar.
//
// Alcance: solo MaterialAPU con proveedor actualmente NULL (los que ya
// lo tienen — clonados después del fix — se dejan intactos, sin
// sobrescribir nada).
//
// Modo dry-run (default): solo muestra qué cambiaría, no escribe nada.
// Modo aplicar: agregar --apply para escribir en DB.
//
// Ejecutar:
//   npx tsx scripts/completar-proveedor-materiales-existentes.ts              (dry-run)
//   npx tsx scripts/completar-proveedor-materiales-existentes.ts --apply       (escribe en DB)

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

const modoAplicar = process.argv.includes("--apply");

async function main() {
  console.log(modoAplicar ? "=== MODO APLICAR — se va a escribir en la base ===" : "=== MODO DRY-RUN — no se escribe nada ===");
  console.log();

  const materiales = await p.materialAPU.findMany({
    where: { proveedor: null },
    select: {
      id: true,
      descripcion: true,
      apu: { select: { rubro: { select: { descripcion: true, capitulo: { select: { proyecto: { select: { nombre: true } } } } } } } },
    },
    orderBy: { id: "asc" },
  });

  console.log(`MaterialAPU con proveedor NULL (candidatos a revisar): ${materiales.length}`);
  console.log();

  let completados = 0;
  let sinMatch = 0;
  let matchSinProveedor = 0; // matcheó, pero es MTOP oficial — nada que propagar

  const aAplicar: { id: string; proveedor: string; fecha: Date | null }[] = [];

  for (const m of materiales) {
    const proyectoNombre = m.apu?.rubro?.capitulo?.proyecto?.nombre ?? "?";
    const rubroDesc = m.apu?.rubro?.descripcion ?? "?";

    const precioMTOP = await p.precioMTOP.findFirst({
      where: { descripcion: { contains: m.descripcion, mode: "insensitive" } },
      orderBy: { id: "asc" },
    });

    if (!precioMTOP) {
      sinMatch++;
      console.log(`  · [${proyectoNombre}] "${rubroDesc}" > "${m.descripcion}" — sin match en PrecioMTOP, se deja como está`);
      continue;
    }

    if (!precioMTOP.proveedor) {
      matchSinProveedor++;
      console.log(`  · [${proyectoNombre}] "${rubroDesc}" > "${m.descripcion}" — matchea ${precioMTOP.codigo} (Lista MTOP oficial, sin proveedor) — nada que propagar`);
      continue;
    }

    completados++;
    console.log(
      `  ${modoAplicar ? "✓" : "→"} [${proyectoNombre}] "${rubroDesc}" > "${m.descripcion}" — matchea ${precioMTOP.codigo} ` +
      `— proveedor="${precioMTOP.proveedor}" fecha=${precioMTOP.fechaUltimaVerificacion ? precioMTOP.fechaUltimaVerificacion.toISOString().slice(0, 10) : "null (Pendiente de verificar)"}`
    );
    aAplicar.push({ id: m.id, proveedor: precioMTOP.proveedor, fecha: precioMTOP.fechaUltimaVerificacion });
  }

  console.log();
  console.log("── Resumen ──");
  console.log(`Total candidatos: ${materiales.length}`);
  console.log(`Se completarían (matchean un proveedor real de mercado libre): ${completados}`);
  console.log(`Matchean MTOP oficial (sin proveedor, nada que propagar): ${matchSinProveedor}`);
  console.log(`Sin match en PrecioMTOP: ${sinMatch}`);

  if (modoAplicar) {
    for (const a of aAplicar) {
      await p.materialAPU.update({
        where: { id: a.id },
        data: { proveedor: a.proveedor, fechaUltimaVerificacion: a.fecha },
      });
    }
    console.log(`\n✓ ${aAplicar.length} MaterialAPU actualizados.`);
  } else if (completados > 0) {
    console.log("\nPara aplicar de verdad: npx tsx scripts/completar-proveedor-materiales-existentes.ts --apply");
  }

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
