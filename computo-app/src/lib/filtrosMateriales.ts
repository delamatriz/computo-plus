// Filtros de /materiales que se prenden desde la campanita (oct-2026).
//   #a-revisar → "Pendiente de verificar"      #sin-precio → "Sin precio"
// Llegando desde otra pantalla, el filtro sale del ancla de la URL al montar
// la página. Estando YA en /materiales la navegación es interna: la URL
// cambia pero el navegador no dispara hashchange, así que la campanita lo
// avisa con este evento.

export type AnclaFiltroMateriales = "a-revisar" | "sin-precio";

export const EVENTO_FILTRO_MATERIALES = "cp:filtro-materiales";

export function avisarFiltroMateriales(ancla: AnclaFiltroMateriales): void {
  window.dispatchEvent(new CustomEvent<AnclaFiltroMateriales>(EVENTO_FILTRO_MATERIALES, { detail: ancla }));
}

/**
 * "#a-revisar" / "a-revisar" → el filtro; cualquier otra cosa → null (sin filtro).
 * Si la URL trae anclas apiladas ("#a-revisar#sin-precio" — pasa al navegar de
 * un ítem de la campanita a otro estando ya en /materiales), vale la última:
 * es la que el usuario eligió al final.
 */
export function anclaDeFiltro(hash: string): AnclaFiltroMateriales | null {
  const ancla = hash.split("#").filter(Boolean).pop() ?? "";
  return ancla === "a-revisar" || ancla === "sin-precio" ? ancla : null;
}
