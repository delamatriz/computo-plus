// Terminología uruguaya en el catálogo y la biblioteca (oct-2026):
//   - LAD-COMUN "Ladrillo común" → "Ladrillo macizo común"
//   - "Madera para estructura de techo (vigas, columnas, correas)" → "…(vigas, pilares, correas)"
//   - Rubro 14.2.3 "Pórtico de hierro completo (columnas + viga…" → "(pilares + viga…"
//   - Rubro 14.2.4 "Columna de tubo estructural…" → "Pilar de tubo estructural…"
//
// Ojo: los precios de la Biblioteca se resuelven por TEXTO (resolverPrecioMaterial:
// la descripción del catálogo tiene que CONTENER la del material del APU
// estándar). Por eso, junto con cada material del catálogo, se renombran las
// líneas de la Biblioteca que lo nombran con el texto viejo completo. El
// dry-run lista cada línea que hoy lo encuentra por texto y qué material del
// catálogo elige antes y después, con el mismo orden que resolverPrecioMaterial
// (coincidencia exacta primero, después la descripción más corta, después el
// código). Es problema solo si la elección cambia o se pierde ("SE ROMPE" /
// "CAMBIA"); con --apply, si hay alguno, no se escribe nada.
//
// Uso (dry-run por defecto, --apply para escribir):
//   npx tsx --env-file=.env.local scripts/renombrar-terminologia-2026-10.ts
//   npx tsx --env-file=.env.local scripts/renombrar-terminologia-2026-10.ts --apply
// Idempotente: si los nombres ya son los nuevos, no hace nada.
import { db } from "@/lib/db";

const aplicar = process.argv.includes("--apply");

const norm = (s: string) => s.trim().toLowerCase();
const contiene = (texto: string, buscado: string) => norm(texto).includes(norm(buscado));

type FilaCat = { id: string; codigo: string; descripcion: string };
// Mismo orden que ordenarCoincidencias (lib/resolverPrecioInsumo.ts).
function elegida(buscada: string, catalogo: FilaCat[]): FilaCat | null {
  const objetivo = norm(buscada);
  const filas = catalogo.filter((c) => contiene(c.descripcion, buscada));
  filas.sort((a, b) => {
    const exA = norm(a.descripcion) === objetivo ? 0 : 1;
    const exB = norm(b.descripcion) === objetivo ? 0 : 1;
    return exA - exB || a.descripcion.length - b.descripcion.length || a.codigo.localeCompare(b.codigo);
  });
  return filas[0] ?? null;
}

let problemas = 0;

async function renombrarMaterial(
  filtro: { codigo?: string; descripcion?: string },
  nuevo: string,
  // Líneas de la Biblioteca con este texto exacto pasan a llamarse `a`.
  lineaBiblioteca: { de: string; a: string }
) {
  const fila = await db.precioMTOP.findFirst({
    where: { ...filtro, empresaId: null, proveedor: null },
    select: { id: true, codigo: true, descripcion: true },
  });
  if (!fila) {
    // Ya renombrado en una corrida anterior: buscarlo por el nombre nuevo.
    const yaNuevo = await db.precioMTOP.findFirst({ where: { descripcion: nuevo, empresaId: null }, select: { codigo: true } });
    console.log(yaNuevo ? `  = ${yaNuevo.codigo}: ya se llama "${nuevo}"` : `  ✗ No se encontró el material ${JSON.stringify(filtro)}`);
  } else if (fila.descripcion === nuevo) {
    console.log(`  = ${fila.codigo}: ya se llama "${nuevo}"`);
  } else {
    console.log(`  ${fila.codigo}: "${fila.descripcion}" → "${nuevo}"`);
  }
  const nombreActual = fila?.descripcion ?? nuevo;

  // Catálogo global antes y después del renombre, para simular qué fila elige cada línea.
  const catalogoAntes: FilaCat[] = await db.precioMTOP.findMany({
    where: { empresaId: null },
    select: { id: true, codigo: true, descripcion: true },
  });
  const catalogoDespues = catalogoAntes.map((c) => (c.id === fila?.id ? { ...c, descripcion: nuevo } : c));

  const estandar = await db.materialAPUEstandar.findMany({
    select: { id: true, descripcion: true, apu: { select: { subrubro: { select: { codigo: true } } } } },
  });
  const porTexto = estandar.filter((m) => m.descripcion.trim() && (contiene(nombreActual, m.descripcion) || norm(m.descripcion) === norm(lineaBiblioteca.a)));
  const aRenombrar: string[] = [];
  for (const m of porTexto) {
    const renombra = norm(m.descripcion) === norm(lineaBiblioteca.de);
    const textoFinal = renombra ? lineaBiblioteca.a : m.descripcion;
    const antes = elegida(m.descripcion, catalogoAntes);
    const despues = elegida(textoFinal, catalogoDespues);
    const estado = !despues
      ? "SE ROMPE"
      : despues.id !== antes?.id
      ? `CAMBIA (${antes?.codigo ?? "ninguno"} → ${despues.codigo})`
      : `sigue eligiendo ${despues.codigo}`;
    if (!despues || despues.id !== antes?.id) problemas++;
    console.log(
      `      Biblioteca ${m.apu.subrubro.codigo} "${m.descripcion}"${renombra ? ` → "${textoFinal}"` : ""}: ${estado}`
    );
    if (renombra) aRenombrar.push(m.id);
  }
  if (porTexto.length === 0) console.log("      Biblioteca: ninguna línea lo encuentra por texto");

  if (fila) {
    const vinculados = await db.materialAPU.count({ where: { precioMTOPId: fila.id } });
    const mismoTextoSinVinculo = await db.materialAPU.count({
      where: { precioMTOPId: null, descripcion: { equals: fila.descripcion, mode: "insensitive" } },
    });
    console.log(`      Proyectos: ${vinculados} vinculado(s) por id (no cambian), ${mismoTextoSinVinculo} sin vínculo con el mismo texto`);
  }

  return async () => {
    if (fila && fila.descripcion !== nuevo) await db.precioMTOP.update({ where: { id: fila.id }, data: { descripcion: nuevo } });
    if (aRenombrar.length > 0) {
      await db.materialAPUEstandar.updateMany({ where: { id: { in: aRenombrar } }, data: { descripcion: lineaBiblioteca.a } });
    }
    return aRenombrar.length;
  };
}

async function renombrarRubro(codigo: string, transformar: (d: string) => string) {
  const sub = await db.subrubroEstandar.findUnique({ where: { codigo }, select: { id: true, descripcion: true } });
  if (!sub) {
    console.log(`  ✗ No existe el rubro ${codigo}`);
    return async () => 0;
  }
  const nuevo = transformar(sub.descripcion);
  if (nuevo === sub.descripcion) {
    console.log(`  = ${codigo}: sin cambios ("${sub.descripcion}")`);
    return async () => 0;
  }
  console.log(`  ${codigo}: "${sub.descripcion}"\n      → "${nuevo}"`);
  // Rubros de proyectos con el texto viejo: son datos de cada obra, no se tocan.
  const enProyectos = await db.rubro.count({ where: { descripcion: { equals: sub.descripcion, mode: "insensitive" } } });
  console.log(`      Rubros de proyectos con el texto viejo (no se tocan): ${enProyectos}`);
  return async () => {
    await db.subrubroEstandar.update({ where: { id: sub.id }, data: { descripcion: nuevo } });
    return 1;
  };
}

async function main() {
  console.log(aplicar ? "APLICANDO\n" : "DRY-RUN (no escribe nada)\n");
  console.log("Materiales del catálogo (y sus líneas de la Biblioteca):");
  const pasos = [
    await renombrarMaterial({ codigo: "LAD-COMUN", descripcion: "Ladrillo común" }, "Ladrillo macizo común", {
      de: "Ladrillo común",
      a: "Ladrillo macizo común",
    }),
    await renombrarMaterial(
      { descripcion: "Madera para estructura de techo (vigas, columnas, correas)" },
      "Madera para estructura de techo (vigas, pilares, correas)",
      { de: "Madera para estructura de techo (vigas, columnas, correas)", a: "Madera para estructura de techo (vigas, pilares, correas)" }
    ),
  ];
  console.log("\nRubros de la Biblioteca:");
  pasos.push(await renombrarRubro("14.2.3", (d) => d.replace("(columnas + viga", "(pilares + viga")));
  pasos.push(await renombrarRubro("14.2.4", (d) => d.replace(/^Columna de tubo estructural/, "Pilar de tubo estructural")));

  console.log(`\nProblemas detectados: ${problemas}`);
  if (!aplicar) {
    console.log("DRY-RUN — correr con --apply para escribir.");
    return;
  }
  if (problemas > 0) throw new Error("Hay líneas que se rompen o quedan ambiguas: no se aplica nada.");
  for (const paso of pasos) await paso();
  console.log("Listo — aplicado.");
}

main()
  .catch((e) => {
    console.error("ERROR:", e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
