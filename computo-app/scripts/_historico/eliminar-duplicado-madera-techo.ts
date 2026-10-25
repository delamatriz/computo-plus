// Elimina MAT-JARDIN-MADERA-ESTRUCTURA-TECHO (oct-2026): es la misma madera que
// EXT-020 ("Madera para estructura de techo (vigas, pilares, correas)"), mismo
// precio y, desde unidad-madera-estructura-techo-m3.ts, misma unidad (m3). Las
// líneas de la Biblioteca "Madera para estructura de techo" (8.1, 24.2.4) lo
// elegían por ser coincidencia exacta; sin él, el matching por texto
// (resolverPrecioMaterial: la descripción del catálogo CONTIENE la de la línea)
// pasa a elegir EXT-020.
//
// El dry-run imprime un respaldo de la fila, cuenta lo que la referencia y
// simula qué material elige después cada línea de la Biblioteca que hoy la
// usa, con el mismo orden que la app. Con --apply, si alguna línea no pasa a
// EXT-020 con la misma unidad y el mismo precio, no borra nada.
//
// Uso (dry-run por defecto, --apply para escribir):
//   npx tsx --env-file=.env.local scripts/eliminar-duplicado-madera-techo.ts
//   npx tsx --env-file=.env.local scripts/eliminar-duplicado-madera-techo.ts --apply
// Idempotente: si ya no existe, no hace nada.
import { db } from "@/lib/db";

const aplicar = process.argv.includes("--apply");
const BORRAR = "MAT-JARDIN-MADERA-ESTRUCTURA-TECHO";
const QUEDA = "EXT-020";

const norm = (s: string) => s.trim().toLowerCase();
type Fila = { id: string; codigo: string; descripcion: string; unidad: string; precioUnitario: number };

// Mismo orden que ordenarCoincidencias (lib/resolverPrecioInsumo.ts).
function elegida(buscada: string, catalogo: Fila[]): Fila | null {
  const objetivo = norm(buscada);
  const filas = catalogo.filter((c) => norm(c.descripcion).includes(objetivo));
  filas.sort((a, b) => {
    const exA = norm(a.descripcion) === objetivo ? 0 : 1;
    const exB = norm(b.descripcion) === objetivo ? 0 : 1;
    return exA - exB || a.descripcion.length - b.descripcion.length || a.codigo.localeCompare(b.codigo);
  });
  return filas[0] ?? null;
}

async function main() {
  console.log(aplicar ? "APLICANDO\n" : "DRY-RUN (no escribe nada)\n");
  const borrar = await db.precioMTOP.findFirst({ where: { codigo: BORRAR, empresaId: null } });
  if (!borrar) {
    console.log(`= ${BORRAR} ya no existe — nada que hacer.`);
    return;
  }
  const queda = await db.precioMTOP.findFirst({ where: { codigo: QUEDA, empresaId: null } });
  if (!queda) throw new Error(`No existe ${QUEDA}: no se borra nada.`);

  console.log(`Se elimina ${BORRAR}: "${borrar.descripcion}" — ${borrar.unidad}, $${borrar.precioUnitario}`);
  console.log(`Queda      ${QUEDA}: "${queda.descripcion}" — ${queda.unidad}, $${queda.precioUnitario}`);
  console.log(`Respaldo JSON de la fila: ${JSON.stringify(borrar)}\n`);

  let problemas = 0;
  if (borrar.unidad !== queda.unidad || borrar.precioUnitario !== queda.precioUnitario) {
    console.log("✗ Distinta unidad o precio entre los dos: no son intercambiables.");
    problemas++;
  }

  // Referencias a la fila que se borra.
  const vinculadosProyectos = await db.materialAPU.count({ where: { precioMTOPId: borrar.id } });
  const vinculadosMisRubros = await db.materialAPUEmpresa.count({ where: { precioMTOPId: borrar.id } });
  console.log(`Materiales de proyectos vinculados: ${vinculadosProyectos} (quedarían sin vínculo, precio intacto)`);
  console.log(`Materiales de Mis rubros vinculados: ${vinculadosMisRubros}`);
  if (vinculadosProyectos + vinculadosMisRubros > 0) {
    console.log("✗ Hay materiales vinculados por id: revisar antes de borrar.");
    problemas++;
  }

  // Líneas de la Biblioteca que hoy eligen la fila que se borra, y qué eligen después.
  const catalogo: Fila[] = await db.precioMTOP.findMany({
    where: { empresaId: null },
    select: { id: true, codigo: true, descripcion: true, unidad: true, precioUnitario: true },
  });
  const sin = catalogo.filter((c) => c.id !== borrar.id);
  const lineas = await db.materialAPUEstandar.findMany({
    select: { descripcion: true, unidad: true, apu: { select: { subrubro: { select: { codigo: true } } } } },
  });
  let afectadas = 0;
  console.log("\nLíneas de la Biblioteca que hoy usan la fila que se borra:");
  for (const l of lineas) {
    if (!l.descripcion.trim()) continue;
    const antes = elegida(l.descripcion, catalogo);
    if (antes?.id !== borrar.id) continue;
    afectadas++;
    const despues = elegida(l.descripcion, sin);
    const ok = despues?.codigo === QUEDA && despues.unidad === borrar.unidad && despues.precioUnitario === borrar.precioUnitario;
    if (!ok) problemas++;
    console.log(
      `  ${l.apu.subrubro.codigo} "${l.descripcion}" (${l.unidad}): ${BORRAR} → ${despues ? `${despues.codigo} (${despues.unidad}, $${despues.precioUnitario})` : "NINGUNO"} ${ok ? "✓" : "✗"}`
    );
  }
  if (afectadas === 0) console.log("  (ninguna)");

  console.log(`\nProblemas detectados: ${problemas}`);
  if (!aplicar) {
    console.log("DRY-RUN — correr con --apply para borrar.");
    return;
  }
  if (problemas > 0) throw new Error("Hay problemas: no se borra nada.");
  await db.precioMTOP.delete({ where: { id: borrar.id } });
  console.log(`Listo — ${BORRAR} eliminado.`);
}

main()
  .catch((e) => {
    console.error("ERROR:", e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
