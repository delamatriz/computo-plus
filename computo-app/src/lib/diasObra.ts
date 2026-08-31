// "Días de Obra" — caso empresa chica (una sola cuadrilla, sin tareas
// en paralelo/superpuestas). El caso "empresa grande" vía Cronograma
// (tareas paralelas) queda para otra sesión, no se implementa acá.
//
// Por cada rubro, el cuello de botella es la categoría de mano de obra
// que más tarda (misma cuadrilla hace todo, así que el rubro dura lo
// que tarda la categoría más lenta) — se toma el MÁXIMO. El total del
// proyecto es la SUMA de esos máximos entre todos los rubros.
//
// Fórmula por línea de mano de obra, ya usada en el DrawerAPU
// (proyectos/[id]/page.tsx, columna "Hs totales"):
//   días = cantidad del rubro / rendimiento
// (rendimiento = unidades de rubro que esa categoría produce por
// jornada — jornadaHs se cancela algebraicamente al pasar de horas
// totales a días, no hace falta acá).
//
// Se incluyen TODAS las líneas de mano de obra, incluidas las de
// armado de equipos alquilados (mo.equipoRelacionadoId) — la cuadrilla
// está físicamente esos días en obra sin importar quién paga esa hora.
// A diferencia del Costo Directo (que sí las excluye, ver
// manoObraIncluida en apu-calc.ts), acá no hay ninguna razón para
// excluirlas — confirmado por Luis.
//
// Rubros sin mano de obra desglosada (precio cargado a mano, o ítems
// administrativos sin desglose) no aportan días — a diferencia del
// costo, no existe una forma razonable de estimar tiempo desde un
// monto, así que no hay fallback "estimado" acá: simplemente no suman.

export interface RubroParaDias {
  id: string;
  cantidad: number | null;
}

export interface CapituloParaDias {
  rubros: RubroParaDias[];
}

export interface ApuParaDias {
  manoObra: { rendimiento: number }[];
}

export interface DiasObraResultado {
  total: number;
  rubrosConDatos: number;
  rubrosSinDatos: number;
}

export function calcularDiasObra(
  capitulos: CapituloParaDias[],
  apuData: Record<string, ApuParaDias>
): DiasObraResultado {
  let total = 0;
  let rubrosConDatos = 0;
  let rubrosSinDatos = 0;

  for (const cap of capitulos) {
    for (const rubro of cap.rubros) {
      const apu = apuData[rubro.id];
      if (!apu || apu.manoObra.length === 0) {
        rubrosSinDatos++;
        continue;
      }
      const cantidad = rubro.cantidad ?? 0;
      let diasRubro = 0;
      for (const mo of apu.manoObra) {
        const dias = mo.rendimiento > 0 ? cantidad / mo.rendimiento : 0;
        if (dias > diasRubro) diasRubro = dias;
      }
      total += diasRubro;
      rubrosConDatos++;
    }
  }

  return { total, rubrosConDatos, rubrosSinDatos };
}
