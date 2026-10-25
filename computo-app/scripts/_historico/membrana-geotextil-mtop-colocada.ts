// Fila 270 de la Lista MTOP (oct-2026): "Membrana asfaltica con geotextil" →
// "Membrana asfáltica con geotextil (colocada)". Su precio ($1.727,11/m²) es de
// membrana colocada, como las vecinas de la misma lista (214 y 215, que lo
// dicen); sin aclararlo se confundía con MAT-MEMBRANA-GEOTEXTIL (Sodimac, solo
// material, $535,90/m2), que es la que usan los APU de la Biblioteca (suman la
// mano de obra aparte). Solo cambia la descripción, no el precio ni otro campo.
//
// El matching de la Biblioteca es por texto: el dry-run simula, con el mismo
// orden que resolverPrecioMaterial, qué material elige CADA línea antes y
// después. Con --apply, si alguna cambia de material, no se escribe nada. El
// importador de la lista MTOP no pisa descripciones, así que se mantiene.
//
// Uso (dry-run por defecto, --apply para escribir):
//   npx tsx --env-file=.env.local scripts/membrana-geotextil-mtop-colocada.ts
//   npx tsx --env-file=.env.local scripts/membrana-geotextil-mtop-colocada.ts --apply
// Idempotente: si ya tiene la descripción nueva, no hace nada.
import { db } from "@/lib/db";

const aplicar = process.argv.includes("--apply");
const CODIGO = "270";
const NUEVA = "Membrana asfáltica con geotextil (colocada)";

// Mismo criterio que la búsqueda en Postgres (ILIKE): sin distinguir mayúsculas, SÍ tildes.
const norm = (s: string) => s.trim().toLowerCase();
type Fila = { id: string; codigo: string; descripcion: string };
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
  const fila = await db.precioMTOP.findFirst({
    where: { codigo: CODIGO, empresaId: null },
    select: { id: true, codigo: true, descripcion: true, unidad: true, precioUnitario: true, numeroLista: true },
  });
  if (!fila) throw new Error(`No existe la fila ${CODIGO}`);
  if (fila.descripcion === NUEVA) {
    console.log(`= Fila ${CODIGO}: ya se llama "${NUEVA}"`);
    return;
  }
  console.log(`Fila ${CODIGO} (Lista ${fila.numeroLista}, $${fila.precioUnitario}/${fila.unidad}, sin cambios):`);
  console.log(`  "${fila.descripcion}" → "${NUEVA}"\n`);

  const antes: Fila[] = await db.precioMTOP.findMany({ where: { empresaId: null }, select: { id: true, codigo: true, descripcion: true } });
  const despues = antes.map((c) => (c.id === fila.id ? { ...c, descripcion: NUEVA } : c));
  const lineas = await db.materialAPUEstandar.findMany({
    select: { descripcion: true, apu: { select: { subrubro: { select: { codigo: true } } } } },
  });

  let problemas = 0;
  let revisadas = 0;
  const tocan: string[] = [];
  for (const l of lineas) {
    if (!l.descripcion.trim()) continue;
    revisadas++;
    const a = elegida(l.descripcion, antes);
    const d = elegida(l.descripcion, despues);
    if (a?.id !== d?.id) {
      problemas++;
      console.log(`  ✗ ${l.apu.subrubro.codigo} "${l.descripcion}": ${a?.codigo ?? "ninguno"} → ${d?.codigo ?? "ninguno"}`);
    } else if (a && (a.id === fila.id || norm(NUEVA).includes(norm(l.descripcion)))) {
      tocan.push(`${l.apu.subrubro.codigo} "${l.descripcion}" → sigue en ${a.codigo}`);
    }
  }
  console.log(`Líneas de la Biblioteca revisadas: ${revisadas}`);
  console.log("Líneas cuyo texto también encuentra la fila 270 (siguen con su material):");
  if (tocan.length === 0) console.log("  (ninguna)");
  for (const t of tocan) console.log(`  ✓ ${t}`);

  const vinculados = await db.materialAPU.count({ where: { precioMTOPId: fila.id } });
  console.log(`\nMateriales de proyectos vinculados por id (no cambian): ${vinculados}`);
  console.log(`Problemas detectados: ${problemas}`);

  if (!aplicar) {
    console.log("DRY-RUN — correr con --apply para escribir.");
    return;
  }
  if (problemas > 0) throw new Error("Alguna línea cambiaría de material: no se aplica nada.");
  await db.precioMTOP.update({ where: { id: fila.id }, data: { descripcion: NUEVA } });
  console.log("Listo — aplicado.");
}

main()
  .catch((e) => {
    console.error("ERROR:", e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
