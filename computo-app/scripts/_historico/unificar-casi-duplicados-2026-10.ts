// Unifica 4 pares de materiales casi duplicados del catálogo global (oct-2026):
// misma unidad y mismo precio, y el nombre de uno contiene al otro. En cada par
// queda el más completo (proveedor real antes que estimación de IA; si no, el
// que tiene más datos) y se elimina el otro:
//   1. queda IMPL-010 "Accesorios termofusión (codos, tees, uniones)"
//      se va MAT-SANITARIA-ACCESORIOS-TERMOFUSION (sin ningún dato)
//   2. queda MAT-FIJADOR-MUROS (Sodimac, "Inca Fijador/Sellador al agua, 1L")
//      se va PIN-003 (estimado por IA)
//   3. queda EQUIP-001 "Accesorios de colocación mueble (tornillería, tacos, soportes)"
//      se va MAT-ACCESORIOS-COLOC-MUEBLE (sin ningún dato)
//   4. queda 90 "Esmalte sintético" (Lista MTOP)
//      se va MAT-PINTURA-ESMALTE-SINTETICO (copia de la 90)
//
// Para cada par:
//   - Las líneas de la Biblioteca que usaban la fila que se va tienen que pasar
//     a la que queda. Si su texto ya la encuentra (está contenido en su
//     descripción), no se tocan; si no, se renombran a la descripción de la que
//     queda (el matching es por texto, ver resolverPrecioMaterial).
//   - Los materiales de proyectos y de Mis rubros vinculados por id a la fila
//     que se va se pasan a la que queda (mismo precio): borrarla los dejaría sin
//     vínculo (onDelete: SetNull).
// El dry-run imprime respaldos y simula qué material elige cada línea afectada.
// Con --apply, si hay algún problema, no se escribe nada.
//
// Uso (dry-run por defecto, --apply para escribir):
//   npx tsx --env-file=.env.local scripts/unificar-casi-duplicados-2026-10.ts
//   npx tsx --env-file=.env.local scripts/unificar-casi-duplicados-2026-10.ts --apply
// Idempotente: un par ya unificado se informa con "=" y no se repite.
import { db } from "@/lib/db";

const aplicar = process.argv.includes("--apply");
const PARES = [
  { queda: "IMPL-010", borra: "MAT-SANITARIA-ACCESORIOS-TERMOFUSION" },
  { queda: "MAT-FIJADOR-MUROS", borra: "PIN-003" },
  { queda: "EQUIP-001", borra: "MAT-ACCESORIOS-COLOC-MUEBLE" },
  { queda: "90", borra: "MAT-PINTURA-ESMALTE-SINTETICO" },
];

// Mismo criterio que la búsqueda en Postgres (ILIKE): sin distinguir mayúsculas, SÍ tildes.
const norm = (s: string) => s.trim().toLowerCase();
type Fila = { id: string; codigo: string; descripcion: string; unidad: string; precioUnitario: number };
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
  let problemas = 0;
  const pasos: (() => Promise<void>)[] = [];

  const catalogo: Fila[] = await db.precioMTOP.findMany({
    where: { empresaId: null },
    select: { id: true, codigo: true, descripcion: true, unidad: true, precioUnitario: true },
  });
  const lineas = await db.materialAPUEstandar.findMany({
    select: { id: true, descripcion: true, unidad: true, apu: { select: { subrubro: { select: { codigo: true } } } } },
  });

  // Catálogo después de todos los borrados, para simular la elección de cada línea.
  const idsBorrar = new Set(
    PARES.map((p) => catalogo.find((c) => c.codigo === p.borra)?.id).filter(Boolean) as string[]
  );
  const despues = catalogo.filter((c) => !idsBorrar.has(c.id));

  for (const [i, par] of PARES.entries()) {
    const queda = catalogo.find((c) => c.codigo === par.queda);
    const borra = catalogo.find((c) => c.codigo === par.borra);
    console.log(`${i + 1}. Queda ${par.queda}${queda ? ` "${queda.descripcion}" ($${queda.precioUnitario}/${queda.unidad})` : ""}`);
    if (!queda) {
      console.log(`   ✗ No existe ${par.queda}`);
      problemas++;
      continue;
    }
    if (!borra) {
      console.log(`   = ${par.borra} ya no existe`);
      continue;
    }
    console.log(`   Se va ${par.borra} "${borra.descripcion}" ($${borra.precioUnitario}/${borra.unidad})`);
    if (norm(borra.unidad) !== norm(queda.unidad) || borra.precioUnitario !== queda.precioUnitario) {
      console.log("   ✗ Distinta unidad o precio: no son intercambiables");
      problemas++;
    }
    const respaldo = await db.precioMTOP.findUnique({ where: { id: borra.id } });
    console.log(`   Respaldo: ${JSON.stringify(respaldo)}`);

    // Vínculos por id → a la fila que queda.
    const proy = await db.materialAPU.findMany({
      where: { precioMTOPId: borra.id },
      select: { id: true, descripcion: true, apu: { select: { rubro: { select: { descripcion: true, capitulo: { select: { proyecto: { select: { nombre: true } } } } } } } } },
    });
    const mis = await db.materialAPUEmpresa.findMany({ where: { precioMTOPId: borra.id }, select: { id: true, descripcion: true } });
    for (const m of proy) {
      console.log(`   Vínculo de proyecto → ${par.queda}: ${m.apu.rubro.capitulo.proyecto.nombre} / ${m.apu.rubro.descripcion} / "${m.descripcion}"`);
    }
    for (const m of mis) console.log(`   Vínculo de Mis rubros → ${par.queda}: "${m.descripcion}"`);
    if (proy.length + mis.length === 0) console.log("   Vínculos por id: ninguno");
    pasos.push(async () => {
      if (proy.length) await db.materialAPU.updateMany({ where: { id: { in: proy.map((m) => m.id) } }, data: { precioMTOPId: queda.id } });
      if (mis.length) await db.materialAPUEmpresa.updateMany({ where: { id: { in: mis.map((m) => m.id) } }, data: { precioMTOPId: queda.id } });
    });

    // Líneas de la Biblioteca que hoy usan cualquiera de las dos.
    for (const l of lineas) {
      if (!l.descripcion.trim()) continue;
      const antes = elegida(l.descripcion, catalogo);
      if (antes?.id !== borra.id && antes?.id !== queda.id) continue;
      let texto = l.descripcion;
      let desp = elegida(texto, despues);
      if (desp?.id !== queda.id) {
        texto = queda.descripcion;
        desp = elegida(texto, despues);
      }
      const ok = desp?.id === queda.id && norm(desp!.unidad) === norm(l.unidad);
      if (!ok) problemas++;
      const renombra = texto !== l.descripcion;
      console.log(
        `   ${ok ? "✓" : "✗"} ${l.apu.subrubro.codigo} "${l.descripcion}"${renombra ? ` → "${texto}"` : ""}: ${antes?.codigo} → ${desp?.codigo ?? "NINGUNO"}`
      );
      if (renombra) {
        pasos.push(async () => {
          await db.materialAPUEstandar.update({ where: { id: l.id }, data: { descripcion: texto } });
        });
      }
    }
    pasos.push(async () => {
      await db.precioMTOP.delete({ where: { id: borra.id } });
    });
    console.log("");
  }

  console.log(`Problemas detectados: ${problemas}`);
  if (!aplicar) {
    console.log("DRY-RUN — correr con --apply para escribir.");
    return;
  }
  if (problemas > 0) throw new Error("Hay problemas: no se aplica nada.");
  for (const p of pasos) await p();
  console.log(`Listo — ${pasos.length} paso(s) aplicados.`);
}

main()
  .catch((e) => {
    console.error("ERROR:", e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
