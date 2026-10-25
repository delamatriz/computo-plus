// Unidad de MAT-JARDIN-MADERA-ESTRUCTURA-TECHO (oct-2026): estaba en "m2", pero
// el precio ($22.500) y las cantidades de las líneas que lo usan (0,04 por m2 de
// techo en los rubros 8.1 y 24.2.4) están pensados en m3 — mismo precio que
// EXT-020, que ya es por m3. Solo se cambian las etiquetas de unidad, en las dos
// puntas a la vez: el costo del APU (0,04 × $22.500 = $900/m2) queda igual.
// No toca precios ni cantidades.
//
// Uso (dry-run por defecto, --apply para escribir):
//   npx tsx --env-file=.env.local scripts/unidad-madera-estructura-techo-m3.ts
//   npx tsx --env-file=.env.local scripts/unidad-madera-estructura-techo-m3.ts --apply
// Idempotente: si ya está en m3, no hace nada.
import { db } from "@/lib/db";

const aplicar = process.argv.includes("--apply");
const CODIGO = "MAT-JARDIN-MADERA-ESTRUCTURA-TECHO";
const LINEA = "Madera para estructura de techo";
const RUBROS = ["8.1", "24.2.4"];

async function main() {
  console.log(aplicar ? "APLICANDO\n" : "DRY-RUN (no escribe nada)\n");
  let problemas = 0;

  const mat = await db.precioMTOP.findFirst({
    where: { codigo: CODIGO, empresaId: null },
    select: { id: true, descripcion: true, unidad: true, cantidadUnidad: true, precioUnitario: true },
  });
  if (!mat) {
    console.log(`✗ No existe ${CODIGO}`);
    problemas++;
  } else if (mat.unidad === "m3") {
    console.log(`= ${CODIGO}: ya está en m3`);
  } else {
    console.log(`1. ${CODIGO} "${mat.descripcion}": unidad "${mat.unidad}" → "m3", cantidadUnidad "${mat.cantidadUnidad}" → "1 m3" (precio $${mat.precioUnitario}, sin cambios)`);
    if (mat.unidad !== "m2") {
      console.log(`   ✗ Se esperaba "m2" y está en "${mat.unidad}" — no se toca`);
      problemas++;
    }
  }

  const lineas = await db.materialAPUEstandar.findMany({
    where: { descripcion: LINEA, apu: { subrubro: { codigo: { in: RUBROS } } } },
    select: { id: true, unidad: true, rendimiento: true, apu: { select: { subrubro: { select: { codigo: true } } } } },
  });
  const porRubro = new Map(lineas.map((l) => [l.apu.subrubro.codigo, l]));
  for (const [i, codigo] of RUBROS.entries()) {
    const l = porRubro.get(codigo);
    if (!l) {
      console.log(`${i + 2}. ✗ Biblioteca ${codigo}: no se encontró la línea "${LINEA}"`);
      problemas++;
    } else if (l.unidad === "m3") {
      console.log(`${i + 2}. = Biblioteca ${codigo}: ya está en m3`);
    } else {
      console.log(`${i + 2}. Biblioteca ${codigo} "${LINEA}": unidad "${l.unidad}" → "m3" (cantidad ${l.rendimiento}, sin cambios)`);
      if (l.unidad !== "m2") {
        console.log(`   ✗ Se esperaba "m2" y está en "${l.unidad}" — no se toca`);
        problemas++;
      }
    }
  }
  if (lineas.length !== RUBROS.length) {
    console.log(`✗ Se esperaban ${RUBROS.length} líneas y se encontraron ${lineas.length}`);
    problemas++;
  }

  // Materiales de proyectos con ese texto o vinculados: no se tocan, solo se informan.
  const enProyectos = await db.materialAPU.count({
    where: { OR: [{ precioMTOPId: mat?.id ?? "-" }, { descripcion: { equals: LINEA, mode: "insensitive" } }] },
  });
  console.log(`\nMateriales de proyectos con este material (no se tocan): ${enProyectos}`);
  console.log(`Problemas detectados: ${problemas}`);

  if (!aplicar) {
    console.log("DRY-RUN — correr con --apply para escribir.");
    return;
  }
  if (problemas > 0) throw new Error("Hay problemas: no se aplica nada.");
  if (mat && mat.unidad !== "m3") {
    await db.precioMTOP.update({ where: { id: mat.id }, data: { unidad: "m3", cantidadUnidad: "1 m3" } });
  }
  const ids = lineas.filter((l) => l.unidad !== "m3").map((l) => l.id);
  if (ids.length > 0) await db.materialAPUEstandar.updateMany({ where: { id: { in: ids } }, data: { unidad: "m3" } });
  console.log("Listo — aplicado.");
}

main()
  .catch((e) => {
    console.error("ERROR:", e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
