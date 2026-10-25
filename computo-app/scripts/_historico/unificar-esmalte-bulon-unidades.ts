// Limpieza de datos del catálogo y la Biblioteca (oct-2026):
//   1. Unidades: 16.3.3 "Sellador silicona" kg → u (cartucho, como las otras 20
//      líneas y el catálogo); 26.11 "Comunicador GSM/IP…" gl → u (fracción de un
//      equipo: 1/12 por mes de servicio). Sin tocar cantidades: el costo no cambia.
//   2. Esmalte sintético: queda la fila 90 (Lista MTOP, verificada), con la
//      descripción con tilde "Esmalte sintético"; se elimina MAT-ESMALTE-SINTETICO
//      (Sodimac, $740, nunca verificado). La línea 14.3.2 "Esmalte sintetico"
//      pasa a "Esmalte sintético" para seguir encontrando la 90 (el matching por
//      texto distingue tildes). MAT-PINTURA-ESMALTE-SINTETICO ($874,36 = el precio
//      MTOP anterior) se corrige al vigente de la 90.
//   3. Bulón con arandela de goma: se elimina MAT-PEND-BULON-ARANDELA-GOMA ($0) y
//      queda MAT-BULON-ARANDELA-GOMA ($28). Las líneas "Bulon…" (sin tilde) que
//      usaban la fila borrada pasan a "Bulón…" para encontrar la que queda.
//
// El dry-run imprime respaldos de lo que se borra o cambia y simula, con el mismo
// orden que resolverPrecioMaterial, qué material elige cada línea afectada antes
// y después. Con --apply, si hay algún problema, no se escribe nada.
//
// Uso (dry-run por defecto, --apply para escribir):
//   npx tsx --env-file=.env.local scripts/unificar-esmalte-bulon-unidades.ts
//   npx tsx --env-file=.env.local scripts/unificar-esmalte-bulon-unidades.ts --apply
// Idempotente: lo ya aplicado se informa con "=" y no se repite.
import { db } from "@/lib/db";
import { datosCorreccionPrecio } from "@/lib/resolverPrecioMTOP";

const aplicar = process.argv.includes("--apply");
let problemas = 0;
const pasos: (() => Promise<void>)[] = [];

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

async function unidadLinea(rubro: string, descripcion: string, de: string, a: string) {
  const l = await db.materialAPUEstandar.findFirst({
    where: { descripcion, apu: { subrubro: { codigo: rubro } } },
    select: { id: true, unidad: true, rendimiento: true },
  });
  if (!l) {
    console.log(`  ✗ ${rubro} "${descripcion}": no existe la línea`);
    problemas++;
  } else if (l.unidad === a) {
    console.log(`  = ${rubro} "${descripcion}": ya está en ${a}`);
  } else if (l.unidad !== de) {
    console.log(`  ✗ ${rubro} "${descripcion}": se esperaba "${de}" y está en "${l.unidad}"`);
    problemas++;
  } else {
    console.log(`  ${rubro} "${descripcion}": unidad "${de}" → "${a}" (cantidad ${l.rendimiento}, sin cambios)`);
    pasos.push(async () => {
      await db.materialAPUEstandar.update({ where: { id: l.id }, data: { unidad: a } });
    });
  }
}

async function main() {
  console.log(aplicar ? "APLICANDO\n" : "DRY-RUN (no escribe nada)\n");
  const catalogo: Fila[] = await db.precioMTOP.findMany({
    where: { empresaId: null },
    select: { id: true, codigo: true, descripcion: true, unidad: true, precioUnitario: true },
  });
  const porCodigo = (c: string) => catalogo.find((f) => f.codigo === c) ?? null;
  const lineas = await db.materialAPUEstandar.findMany({
    select: { id: true, descripcion: true, unidad: true, apu: { select: { subrubro: { select: { codigo: true } } } } },
  });

  // ── 1. Unidades ──
  console.log("1. Unidades de la Biblioteca:");
  await unidadLinea("16.3.3", "Sellador silicona", "kg", "u");
  await unidadLinea("26.11", "Comunicador GSM/IP para central de alarma", "gl", "u");

  // ── 2 y 3. Catálogo después de los cambios, para simular la elección de cada línea ──
  const ESMALTE_QUEDA = "90";
  const ESMALTE_BORRA = "MAT-ESMALTE-SINTETICO";
  const ESMALTE_NOMBRE = "Esmalte sintético";
  const PINTURA_ESMALTE = "MAT-PINTURA-ESMALTE-SINTETICO";
  const BULON_QUEDA = "MAT-BULON-ARANDELA-GOMA";
  const BULON_BORRA = "MAT-PEND-BULON-ARANDELA-GOMA";

  const queda90 = porCodigo(ESMALTE_QUEDA);
  const borraEsm = porCodigo(ESMALTE_BORRA);
  const pintura = porCodigo(PINTURA_ESMALTE);
  const quedaBul = porCodigo(BULON_QUEDA);
  const borraBul = porCodigo(BULON_BORRA);

  const borrados = new Set([borraEsm?.id, borraBul?.id].filter(Boolean) as string[]);
  const despues: Fila[] = catalogo
    .filter((c) => !borrados.has(c.id))
    .map((c) => (c.id === queda90?.id ? { ...c, descripcion: ESMALTE_NOMBRE } : c))
    .map((c) => (c.id === pintura?.id && queda90 ? { ...c, precioUnitario: queda90.precioUnitario } : c));

  // Líneas de la Biblioteca que se renombran (texto sin tilde → con tilde) para no perder su material.
  const renombresLinea: Record<string, string> = {
    "Esmalte sintetico": ESMALTE_NOMBRE,
    "Bulon con arandela de goma": "Bulón con arandela de goma",
  };

  console.log("\n2. Esmalte sintético:");
  if (!queda90) {
    console.log(`  ✗ No existe la fila ${ESMALTE_QUEDA}`);
    problemas++;
  } else {
    if (queda90.descripcion !== ESMALTE_NOMBRE) {
      console.log(`  Fila ${ESMALTE_QUEDA}: descripción "${queda90.descripcion}" → "${ESMALTE_NOMBRE}" ($${queda90.precioUnitario}/${queda90.unidad})`);
      pasos.push(async () => {
        await db.precioMTOP.update({ where: { id: queda90.id }, data: { descripcion: ESMALTE_NOMBRE } });
      });
    } else console.log(`  = Fila ${ESMALTE_QUEDA}: ya se llama "${ESMALTE_NOMBRE}"`);
  }
  if (borraEsm) {
    const fila = await db.precioMTOP.findUnique({ where: { id: borraEsm.id } });
    console.log(`  Se elimina ${ESMALTE_BORRA} ($${borraEsm.precioUnitario}/${borraEsm.unidad}) — respaldo: ${JSON.stringify(fila)}`);
    pasos.push(async () => {
      await db.precioMTOP.delete({ where: { id: borraEsm.id } });
    });
  } else console.log(`  = ${ESMALTE_BORRA} ya no existe`);
  if (pintura && queda90) {
    if (pintura.unidad !== queda90.unidad) {
      console.log(`  ✗ ${PINTURA_ESMALTE} está en "${pintura.unidad}" y la 90 en "${queda90.unidad}": no se corrige el precio`);
      problemas++;
    } else if (pintura.precioUnitario === queda90.precioUnitario) {
      console.log(`  = ${PINTURA_ESMALTE} ya está a $${queda90.precioUnitario}`);
    } else {
      console.log(`  ${PINTURA_ESMALTE}: $${pintura.precioUnitario} → $${queda90.precioUnitario}/${pintura.unidad} (precio MTOP vigente)`);
      pasos.push(async () => {
        await db.precioMTOP.update({ where: { id: pintura.id }, data: datosCorreccionPrecio(queda90.precioUnitario, pintura.precioUnitario) });
      });
    }
  }

  console.log("\n3. Bulón con arandela de goma:");
  if (!quedaBul) {
    console.log(`  ✗ No existe ${BULON_QUEDA}`);
    problemas++;
  } else if (borraBul) {
    const fila = await db.precioMTOP.findUnique({ where: { id: borraBul.id } });
    console.log(`  Se elimina ${BULON_BORRA} ($${borraBul.precioUnitario}) — queda ${BULON_QUEDA} ($${quedaBul.precioUnitario}) — respaldo: ${JSON.stringify(fila)}`);
    pasos.push(async () => {
      await db.precioMTOP.delete({ where: { id: borraBul.id } });
    });
  } else console.log(`  = ${BULON_BORRA} ya no existe`);

  // Referencias por id a lo que se borra.
  for (const f of [borraEsm, borraBul]) {
    if (!f) continue;
    const proy = await db.materialAPU.count({ where: { precioMTOPId: f.id } });
    const mis = await db.materialAPUEmpresa.count({ where: { precioMTOPId: f.id } });
    if (proy + mis > 0) {
      console.log(`  ✗ ${f.codigo}: ${proy} material(es) de proyectos y ${mis} de Mis rubros vinculados por id`);
      problemas++;
    }
  }

  // ── Simulación: líneas de la Biblioteca que hoy usan algo de lo que se toca ──
  console.log("\nLíneas de la Biblioteca afectadas (material antes → después):");
  const tocados = new Set([queda90?.id, borraEsm?.id, quedaBul?.id, borraBul?.id].filter(Boolean) as string[]);
  const renombrar: { id: string; a: string }[] = [];
  let afectadas = 0;
  for (const l of lineas) {
    if (!l.descripcion.trim()) continue;
    const antes = elegida(l.descripcion, catalogo);
    if (!antes || !tocados.has(antes.id)) continue;
    afectadas++;
    const textoFinal = renombresLinea[l.descripcion] ?? l.descripcion;
    const desp = elegida(textoFinal, despues);
    const esperado = antes.id === borraEsm?.id || antes.id === queda90?.id ? queda90?.id : quedaBul?.id;
    const ok = desp?.id === esperado && norm(desp!.unidad) === norm(l.unidad);
    if (!ok) problemas++;
    console.log(
      `  ${l.apu.subrubro.codigo} "${l.descripcion}"${textoFinal !== l.descripcion ? ` → "${textoFinal}"` : ""} (${l.unidad}): ` +
        `${antes.codigo} $${antes.precioUnitario} → ${desp ? `${desp.codigo} $${desp.precioUnitario} (${desp.unidad})` : "NINGUNO"} ${ok ? "✓" : "✗"}`
    );
    if (textoFinal !== l.descripcion) renombrar.push({ id: l.id, a: textoFinal });
  }
  if (afectadas === 0) console.log("  (ninguna)");
  for (const r of renombrar) {
    pasos.push(async () => {
      await db.materialAPUEstandar.update({ where: { id: r.id }, data: { descripcion: r.a } });
    });
  }

  console.log(`\nProblemas detectados: ${problemas}`);
  if (!aplicar) {
    console.log("DRY-RUN — correr con --apply para escribir.");
    return;
  }
  if (problemas > 0) throw new Error("Hay problemas: no se aplica nada.");
  for (const p of pasos) await p();
  console.log(`Listo — ${pasos.length} cambio(s) aplicados.`);
}

main()
  .catch((e) => {
    console.error("ERROR:", e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
