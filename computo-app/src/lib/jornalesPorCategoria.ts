// Jornales por categoría de mano de obra — suma, para cada línea de
// ManoObraAPU de cada rubro, (1 / rendimiento) × cantidad del rubro, y
// agrupa por el nombre de categoría tal cual está guardado en la línea
// ("Peón", "Oficial albañil", …). Mismo patrón que calcularDiasObra
// (diasObra.ts): función pura sobre capitulos+apuData ya en memoria en
// proyectos/[id]/page.tsx, sin consulta nueva. A diferencia de Días de
// Obra acá se SUMA (no se toma el máximo por rubro). Igual que ahí, entran
// todas las líneas, incluidas las de armado de equipos alquilados: son
// jornales reales en obra, aunque no sumen al Costo Directo.

export interface RubroParaJornales {
  id: string;
  cantidad: number | null;
}

export interface CapituloParaJornales {
  rubros: RubroParaJornales[];
}

export interface ApuParaJornales {
  manoObra: { categoria: string; rendimiento: number }[];
}

export interface JornalesCategoria {
  categoria: string;
  jornales: number;
}

/** Ordenado de mayor a menor; solo categorías con más de 0 jornales. */
export function calcularJornalesPorCategoria(
  capitulos: CapituloParaJornales[],
  apuData: Record<string, ApuParaJornales>
): JornalesCategoria[] {
  const porCategoria = new Map<string, number>();

  for (const cap of capitulos) {
    for (const rubro of cap.rubros) {
      const apu = apuData[rubro.id];
      if (!apu || rubro.cantidad == null) continue;
      for (const mo of apu.manoObra) {
        if (!(mo.rendimiento > 0)) continue;
        const jornales = (1 / mo.rendimiento) * rubro.cantidad;
        if (!Number.isFinite(jornales)) continue;
        const categoria = mo.categoria.trim() || "Sin categoría";
        porCategoria.set(categoria, (porCategoria.get(categoria) ?? 0) + jornales);
      }
    }
  }

  return Array.from(porCategoria, ([categoria, jornales]) => ({ categoria, jornales }))
    .filter((c) => c.jornales > 0)
    .sort((a, b) => b.jornales - a.jornales);
}
