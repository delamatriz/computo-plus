import { db } from "@/lib/db";

/**
 * Suma el costo de mano de obra de todos los rubros de un proyecto,
 * a partir de los APU cargados (ManoObraAPU → APU → Rubro → Capítulo → Proyecto).
 * Es el monto imponible base para Leyes Sociales / BPS.
 */
export async function calcularMOTotal(proyectoId: string): Promise<number> {
  const capitulos = await db.capitulo.findMany({
    where: { proyectoId },
    include: {
      rubros: {
        include: {
          apu: { include: { manoObra: true } },
        },
      },
    },
  });

  let total = 0;
  for (const cap of capitulos) {
    for (const rubro of cap.rubros) {
      if (!rubro.apu || rubro.cantidad == null) continue;
      for (const mo of rubro.apu.manoObra) {
        const costoPorUnidad = (mo.jornadaHs / mo.rendimiento) * mo.jornalRef;
        total += costoPorUnidad * rubro.cantidad;
      }
    }
  }

  return total;
}
