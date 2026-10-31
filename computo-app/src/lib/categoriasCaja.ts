// Categorías de movimientos de Flujo de Caja (MovimientoCaja.categoria),
// según el tipo. Fuente única para la API (validación) y la pantalla.
export const CATEGORIAS_EGRESO = ["Subcontratos", "Órdenes de compra", "Jornales", "Gastos generales", "Otros"] as const;
export const CATEGORIAS_INGRESO = ["Cobro de certificación", "Anticipo del comitente", "Otros"] as const;

export const SIN_CATEGORIA = "Sin categoría";

export function categoriasDe(tipo: string): readonly string[] {
  return tipo === "Ingreso" ? CATEGORIAS_INGRESO : CATEGORIAS_EGRESO;
}

// null si no vino o vino vacía; undefined si no es válida para el tipo.
export function validarCategoria(tipo: string, categoria: unknown): string | null | undefined {
  if (categoria == null || categoria === "") return null;
  if (typeof categoria !== "string") return undefined;
  return categoriasDe(tipo).includes(categoria) ? categoria : undefined;
}
