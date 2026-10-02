// Recalcula el precioUnit de los rubros existentes afectados por la
// actualización de jornales SUNCA 2025 (ver seed-jornales-sunca-2025.ts).
//
// ManoObraAPU guarda jornalRef como un valor copiado en el momento en que
// se cargó la mano de obra al rubro — no es una referencia viva a
// CategoriaLaboral. Por eso actualizar la tabla de categorías no alcanza:
// hay que encontrar, dentro de cada rubro, las líneas de MO cuya categoría
// es Peón / Medio oficial / Oficial / Oficial especializado / Capataz /
// Oficial trabajo en altura / Medio oficial trabajo en altura (por nombre,
// excluyendo variantes como "Capataz general") y actualizar su jornalRef
// al valor correcto, y con eso recalcular el precioUnit del rubro con la
// fórmula de Costo Directo ya corregida.
//
// Modo dry-run (default): solo muestra qué cambiaría, no escribe nada.
// Modo aplicar: agregar --apply para escribir jornalRef y precioUnit en DB.
//
// Ejecutar:
//   npx tsx scripts/recalcular-jornales-sunca.ts              (dry-run)
//   npx tsx scripts/recalcular-jornales-sunca.ts --apply       (escribe en DB)

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

const modoAplicar = process.argv.includes("--apply");

// Nuevos jornales SUNCA 2025 — 3 categorías del flujo simplificado, las
// 2 categorías extendidas que tenían el mismo tipo de corrimiento, y las
// 2 categorías de compensación por trabajo en altura (10%).
const NUEVO_JORNAL: Record<
  "peon" | "medio_oficial" | "oficial" | "oficial_especializado" | "capataz" | "oficial_altura" | "medio_oficial_altura",
  number
> = {
  peon: 1554.29,
  medio_oficial: 2069.21,
  oficial: 2412.65,
  oficial_especializado: 2767.81, // Cat. VIII — antes tenía el de Cat. IX (Capataz, 2949.45)
  capataz: 2949.45,               // Cat. IX — antes tenía el de Cat. XII (Maestro mayor de obra, 3310.21)
  oficial_altura: 2653.92,        // Oficial (Cat. VII) + 10%
  medio_oficial_altura: 2276.13,  // Medio oficial (Cat. V) + 10%
};

// Nombres de categoría que NO deben tratarse como ninguna de las de arriba,
// aunque contengan esas palabras como substring (oficios nivelados a un
// grado fijo a propósito, y "capataz general"/"general superior" son Cat.
// X/XI, no Cat. IX).
const EXCLUIR = ["maquinista", "escalerista", "electricista", "plomero", "pintor"];

function categoriaSimplificada(nombreMO: string): keyof typeof NUEVO_JORNAL | null {
  const n = nombreMO.trim().toLowerCase();
  if (n.includes("altura")) {
    if (n.includes("medio oficial")) return "medio_oficial_altura";
    if (n.includes("oficial")) return "oficial_altura";
    return null; // no existe variante de altura para Peón
  }
  if (EXCLUIR.some((x) => n.includes(x))) return null;
  if (n.includes("capataz")) {
    if (n.includes("general")) return null; // Cat. X/XI — no forman parte de este ajuste
    return "capataz";
  }
  if (n.includes("peón") || n.includes("peon")) return "peon";
  if (n.includes("medio oficial")) return "medio_oficial";
  if (n.includes("especializado")) return "oficial_especializado";
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
  const afectados: { rubro: string; proyecto: string; precioViejo: number; precioNuevo: number; diffPct: number }[] = [];

  for (const rubro of rubros) {
    if (!rubro.apu || rubro.apu.manoObra.length === 0) continue;

    const ajustesDeEstaVez: { mo: (typeof rubro.apu.manoObra)[number]; jornalNuevo: number }[] = [];

    for (const mo of rubro.apu.manoObra) {
      const tipo = categoriaSimplificada(mo.categoria);
      if (!tipo) continue;
      const jornalNuevo = NUEVO_JORNAL[tipo];
      if (mo.jornalRef !== jornalNuevo) {
        ajustesDeEstaVez.push({ mo, jornalNuevo });
      }
    }

    if (ajustesDeEstaVez.length === 0) continue; // nada que cambiar en este rubro

    // Recalcular costoDirecto usando el jornalRef nuevo para las líneas
    // ajustadas y el existente para el resto (equipos y materiales sin cambios).
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

  console.log("\n── Resumen ──");
  console.log(`Rubros con mano de obra revisados: ${rubros.filter((r) => r.apu && r.apu.manoObra.length > 0).length}`);
  console.log(`Rubros ${modoAplicar ? "actualizados" : "que cambiarían"}: ${afectados.length}`);
  console.log(`Líneas de mano de obra ${modoAplicar ? "ajustadas" : "que se ajustarían"}: ${lineasAjustadas}`);

  if (afectados.length > 0) {
    const promedioPct = afectados.reduce((s, a) => s + a.diffPct, 0) / afectados.length;
    const maximaPct = afectados.reduce((max, a) => (Math.abs(a.diffPct) > Math.abs(max) ? a.diffPct : max), 0);
    console.log(`Variación promedio: ${promedioPct >= 0 ? "+" : ""}${promedioPct.toFixed(1)}%`);
    console.log(`Variación máxima:   ${maximaPct >= 0 ? "+" : ""}${maximaPct.toFixed(1)}%`);
  }

  if (!modoAplicar && afectados.length > 0) {
    console.log("\nEsto fue un dry-run — no se escribió nada en la base.");
    console.log("Revisá los resultados y volvé a correr con --apply para aplicar los cambios.");
  }

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
