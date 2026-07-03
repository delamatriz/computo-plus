import { db } from "@/lib/db";

// Porcentaje típico de mano de obra sobre el costo directo en obra uruguaya,
// usado como fallback cuando un rubro no tiene su APU desglosado en mano de obra.
const MO_PORCENTAJE_FALLBACK = 0.38;

export interface ResultadoMOTotal {
  total: number;
  metodo: "apu" | "estimado";
}

/**
 * Suma el costo de mano de obra de todos los rubros de un proyecto.
 * Camino principal: ManoObraAPU → APU → Rubro → Capítulo → Proyecto.
 * Fallback: si un rubro no tiene APU con mano de obra desglosada, estima la MO
 * como un porcentaje fijo de precioUnit × cantidad. El método informado refleja
 * si se usó el fallback en al menos un rubro, para que el frontend pueda avisar.
 * Es el monto imponible base para Leyes Sociales / BPS.
 */
export async function calcularMOTotal(proyectoId: string): Promise<ResultadoMOTotal> {
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
  let metodo: "apu" | "estimado" = "apu";

  for (const cap of capitulos) {
    for (const rubro of cap.rubros) {
      const cantidadEfectiva = (rubro.cantidad == null || rubro.cantidad === 0) ? 1 : rubro.cantidad;

      if (rubro.apu?.manoObra && rubro.apu.manoObra.length > 0) {
        for (const mo of rubro.apu.manoObra) {
          // jornalRef ya es el costo de la jornada completa — jornadaHs no participa.
          const costoPorUnidad = mo.jornalRef / mo.rendimiento;
          total += costoPorUnidad * cantidadEfectiva;
        }
      } else if (rubro.precioUnit > 0) {
        total += rubro.precioUnit * cantidadEfectiva * MO_PORCENTAJE_FALLBACK;
        metodo = "estimado";
      }
    }
  }

  return { total, metodo };
}
