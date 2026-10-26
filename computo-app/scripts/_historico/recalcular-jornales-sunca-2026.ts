// Recalcula el precioUnit de los rubros existentes afectados por la
// actualización de jornales SUNCA 2026-2027 (ver seed-jornales-sunca-2026.ts).
//
// ManoObraAPU guarda jornalRef como un valor copiado en el momento en que
// se cargó la mano de obra al rubro — no es una referencia viva a
// CategoriaLaboral, así que actualizar esa tabla no alcanza acá.
//
// A diferencia de recalcular-jornales-sunca.ts (2025), el matching por
// nombre es más completo — se relevó primero (con una ruta API de solo
// lectura, ya borrada) TODOS los textos de categoria realmente usados en
// las 93 líneas de mano de obra de los 45 rubros existentes, en vez de
// asumir el mismo set de 7 buckets del año pasado. Se detectaron 3 grupos
// que el script viejo no tocaba (quedaban con jornal congelado del laudo
// anterior o de otro origen, sin actualizar):
//   - "Ayudante" (Categoría III, existía pero no estaba en el matching)
//   - "Oficial maquinista" (estaba en la lista EXCLUIR del año pasado)
//   - "Plomero oficial" / "Pintor oficial" — el año pasado excluidos a
//     propósito; decisión confirmada este año: nivelarlos a Categoría VIII,
//     mismo criterio que el resto de los oficios "oficial". Sus jornalRef
//     actuales ($1230 / $1180) ni siquiera coinciden con ningún valor de
//     CategoriaLaboral — son valores sueltos/manuales, no del laudo viejo.
//
// Modo dry-run (default): solo muestra qué cambiaría, no escribe nada.
// Modo aplicar: agregar --apply para escribir jornalRef y precioUnit en DB.
//
// Ejecutar:
//   npx tsx scripts/recalcular-jornales-sunca-2026.ts              (dry-run)
//   npx tsx scripts/recalcular-jornales-sunca-2026.ts --apply       (escribe en DB)

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

const modoAplicar = process.argv.includes("--apply");

// Jornales nuevos por bucket — mismos valores que
// seed-jornales-sunca-2026.ts (Categorías I/III/V/VII/VIII/IX/X + altura).
const NUEVO_JORNAL = {
  peon: 1634.65,               // Cat. I
  ayudante: 1845.49,           // Cat. III — nuevo bucket este año
  medio_oficial: 2176.19,      // Cat. V
  oficial: 2537.38,            // Cat. VII
  oficial_especializado: 2910.91, // Cat. VIII
  capataz: 3101.94,            // Cat. IX
  oficial_maquinista: 3290.14, // Cat. X — nuevo bucket este año
  oficial_altura: 2791.12,     // Oficial (Cat. VII) + 10%
  medio_oficial_altura: 2393.81, // Medio oficial (Cat. V) + 10%
  // Nivelados a Categoría VIII este año (antes excluidos) — decisión
  // confirmada: mismo criterio que el resto de los oficios "oficial".
  plomero_oficial: 2910.91,
  pintor_oficial: 2910.91,
} as const;

type Bucket = keyof typeof NUEVO_JORNAL;

// Matching por texto EXACTO primero (evita falsos positivos entre
// "Oficial especializado (herrería/metálica)" y "Oficial especializado
// básico" si algún día existieran variantes con matices distintos),
// con fallback a substring para las variantes sueltas ya detectadas en
// la base real ("Peón ayudante", "Peón (ayudante preparación y
// limpieza)") — mismo criterio que el año pasado para esos casos.
function categoriaBucket(nombreMO: string): Bucket | null {
  const n = nombreMO.trim().toLowerCase();

  if (n.includes("altura")) {
    if (n.includes("medio oficial")) return "medio_oficial_altura";
    if (n.includes("oficial")) return "oficial_altura";
    return null; // no existe variante de altura para Peón/Ayudante
  }
  if (n.includes("plomero")) return "plomero_oficial";
  if (n.includes("pintor")) return "pintor_oficial";
  if (n.includes("maquinista")) return "oficial_maquinista";
  if (n.includes("escalerista") || n.includes("electricista") || n.includes("gasista")) return null; // sin cambio este año, no forman parte del ajuste pedido
  if (n.includes("capataz")) {
    if (n.includes("general")) return null; // Cat. X/XI — no forman parte de este ajuste
    return "capataz";
  }
  if (n.includes("especializado")) return "oficial_especializado";
  if (n.includes("peón") || n.includes("peon")) return "peon"; // cubre "Peón ayudante" y "Peón (ayudante...)"
  if (n.includes("ayudante")) return "ayudante";
  if (n.includes("medio oficial")) return "medio_oficial";
  if (n.includes("oficial")) return "oficial";
  return null;
}

async function main() {
  console.log(modoAplicar ? "=== MODO APLICAR — se va a escribir en la base ===" : "=== MODO DRY-RUN — no se escribe nada ===");

  const rubros = await p.rubro.findMany({
    include: {
      apu: { include: { materiales: true, manoObra: true, equipos: true } },
      capitulo: { include: { proyecto: { select: { nombre: true } } } },
    },
  });

  let lineasAjustadas = 0;
  let lineasSinMatch = 0;
  const sinMatchTextos = new Set<string>();
  const afectados: { rubro: string; proyecto: string; precioViejo: number; precioNuevo: number; diffPct: number }[] = [];

  for (const rubro of rubros) {
    if (!rubro.apu || rubro.apu.manoObra.length === 0) continue;

    const ajustesDeEstaVez: { mo: (typeof rubro.apu.manoObra)[number]; jornalNuevo: number }[] = [];

    for (const mo of rubro.apu.manoObra) {
      const bucket = categoriaBucket(mo.categoria);
      if (!bucket) continue;
      const jornalNuevo = NUEVO_JORNAL[bucket];
      if (mo.jornalRef !== jornalNuevo) {
        ajustesDeEstaVez.push({ mo, jornalNuevo });
      }
    }

    if (ajustesDeEstaVez.length === 0) continue;

    const jornalRefEfectivo = new Map(ajustesDeEstaVez.map((a) => [a.mo.id, a.jornalNuevo]));
    const sumMat = rubro.apu.materiales.reduce((s, m) => s + m.rendimiento * m.precioUnit, 0);
    const sumMO = rubro.apu.manoObra.reduce((s, mo) => {
      if (mo.rendimiento <= 0) return s;
      const jornalRef = jornalRefEfectivo.get(mo.id) ?? mo.jornalRef;
      const costo = jornalRef / mo.rendimiento;
      return s + (Number.isFinite(costo) ? costo : 0);
    }, 0);
    const sumEq = rubro.apu.equipos.reduce((s, e) => s + e.rendimiento * e.costoUnit, 0);
    const costoDirectoNuevo = sumMat + sumMO + sumEq;
    const precioNuevo = Math.round(
      costoDirectoNuevo * (1 + rubro.apu.gastosGeneralesPct / 100) * (1 + rubro.apu.utilidadPct / 100) * 100
    ) / 100;

    const precioViejo = rubro.precioUnit;
    const diffPct = precioViejo !== 0 ? ((precioNuevo - precioViejo) / precioViejo) * 100 : 0;

    afectados.push({ rubro: rubro.descripcion || rubro.codigo, proyecto: rubro.capitulo.proyecto.nombre, precioViejo, precioNuevo, diffPct });

    console.log(
      `${modoAplicar ? "✓" : "→"} [${rubro.capitulo.proyecto.nombre}] "${rubro.descripcion || rubro.codigo}" — ` +
      `$${precioViejo.toFixed(2)} → $${precioNuevo.toFixed(2)} (${diffPct >= 0 ? "+" : ""}${diffPct.toFixed(1)}%)`
    );
    for (const { mo, jornalNuevo } of ajustesDeEstaVez) {
      console.log(`    · MO "${mo.categoria}": jornalRef $${mo.jornalRef.toFixed(2)} → $${jornalNuevo.toFixed(2)}`);
    }

    if (modoAplicar) {
      for (const { mo, jornalNuevo } of ajustesDeEstaVez) {
        await p.manoObraAPU.update({ where: { id: mo.id }, data: { jornalRef: jornalNuevo } });
      }
      await p.rubro.update({ where: { id: rubro.id }, data: { precioUnit: precioNuevo } });
    }
    lineasAjustadas += ajustesDeEstaVez.length;
  }

  // Reporte aparte de líneas de MO que no matchearon NINGÚN bucket — para
  // confirmar que no se está dejando pasar nada por alto (además de las
  // ya conocidas electricista/gasista/escalerista/capataz general, que
  // quedan afuera a propósito).
  const todasLasLineasMO = rubros.flatMap((r) => r.apu?.manoObra ?? []);
  for (const mo of todasLasLineasMO) {
    if (!categoriaBucket(mo.categoria)) {
      lineasSinMatch++;
      sinMatchTextos.add(mo.categoria);
    }
  }

  console.log("\n── Resumen ──");
  console.log(`Rubros con mano de obra revisados: ${rubros.filter((r) => r.apu && r.apu.manoObra.length > 0).length}`);
  console.log(`Rubros ${modoAplicar ? "actualizados" : "que cambiarían"}: ${afectados.length}`);
  console.log(`Líneas de mano de obra ${modoAplicar ? "ajustadas" : "que se ajustarían"}: ${lineasAjustadas}`);
  console.log(`Líneas de mano de obra sin match (excluidas a propósito o desconocidas): ${lineasSinMatch}`);
  if (sinMatchTextos.size > 0) {
    console.log(`  Textos de categoría sin match: ${[...sinMatchTextos].join(", ")}`);
  }

  if (afectados.length > 0) {
    const promedioPct = afectados.reduce((s, a) => s + a.diffPct, 0) / afectados.length;
    const maximaPct = afectados.reduce((max, a) => (Math.abs(a.diffPct) > Math.abs(max) ? a.diffPct : max), 0);
    console.log(`Variación promedio: ${promedioPct >= 0 ? "+" : ""}${promedioPct.toFixed(1)}%`);
    console.log(`Variación máxima:   ${maximaPct >= 0 ? "+" : ""}${maximaPct.toFixed(1)}%`);
  }

  if (!modoAplicar && afectados.length > 0) {
    console.log("\nPara aplicar de verdad: npx tsx scripts/recalcular-jornales-sunca-2026.ts --apply");
  }

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
