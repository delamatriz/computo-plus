import { db } from "@/lib/db";
import { rubroCompatibleConFila } from "@/components/metrajes/metrajeFila";

// Compartido entre el PATCH de filas-metraje (edición inline de
// ancho/alto en la Planilla) y el DELETE de mediciones (borrar o
// reemplazar el trazo de ancho de una fila deja la unidad
// desactualizada si no se recalcula también ahí) — un solo lugar para
// esta regla, no dos copias que puedan divergir.

// Cuántos de {ancho, alto} hacen falta para que una fila derivada de
// una medición (Línea o Área) pase de su unidad "base" a la siguiente.
// Área ya es una superficie de por sí — con 1 o 2 campos cargados igual
// tope en M3, no hay una unidad "m4" en este dominio (cargar ambos a la
// vez en una fila de Área no tiene un sentido físico único; no se
// bloquea el campo, pero el número que da subtotalFila() en ese caso
// puede no representar nada real — queda así a propósito por ahora).
export function unidadPorDimensiones(tipoMedicion: "LINEA" | "AREA", cantidadCargados: number): string {
  if (tipoMedicion === "AREA") return cantidadCargados === 0 ? "M2" : "M3";
  if (cantidadCargados === 0) return "ML";
  if (cantidadCargados === 1) return "M2";
  return "M3";
}

export function contarCargados(a: number | null, b: number | null): number {
  return (a != null ? 1 : 0) + (b != null ? 1 : 0);
}

// Si rubroId sigue apuntando a un Rubro cuya unidad ya no coincide con
// unidadNueva, arma el aviso para el toast — el caller decide si
// aplicar rubroId:null en su propio `data` (esta función no escribe).
// Un rubro "GL" nunca se desvincula por esto — mismo criterio que
// rubroCompatibleConFila en los guards de vinculación.
export async function calcularDesvinculacion(
  rubroId: string,
  unidadNueva: string
): Promise<{ nombre: string; unidadNueva: string } | null> {
  const rubro = await db.rubro.findUnique({ where: { id: rubroId }, select: { descripcion: true, unidad: true } });
  if (rubro && !rubroCompatibleConFila(unidadNueva, rubro.unidad)) {
    return { nombre: rubro.descripcion || "Rubro sin nombre", unidadNueva };
  }
  return null;
}
