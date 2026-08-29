// Lógica pura del modo Detallado de Gastos Generales — compartida entre
// SeccionGastosGeneralesUtilidades.tsx (cliente) y pdf/route.ts (servidor).
// Sin esto, el monto de Gastos Generales en modo Detallado se calculaba
// distinto en cada lugar (bug real: el PDF lo ignoraba por completo, ver
// pdf/route.ts).

export interface ItemGastoGeneral {
  id: string;
  descripcion: string;
  monto: number;
}

export interface CategoriaGastoGeneral {
  id: string;
  nombre: string;
  items: ItemGastoGeneral[];
}

export type ModoGastosGenerales = "PORCENTAJE" | "DETALLADO";

// 5 categorías fijas del modo Detallado — id estable (clave de matching
// contra el JSON guardado), nombre fijo no editable por el usuario.
export const CATEGORIAS_GASTOS_GENERALES_FIJAS: { id: string; nombre: string }[] = [
  { id: "personal_tecnico", nombre: "Personal Técnico y Administrativo en Obra" },
  { id: "equipamiento", nombre: "Equipamiento y Alquileres" },
  { id: "consumos_servicios", nombre: "Consumos y Servicios de Obra" },
  { id: "seguridad_higiene", nombre: "Seguridad, Higiene y Salud Ocupacional" },
  { id: "logistica_transporte", nombre: "Logística y Transporte" },
];

// Siempre devuelve exactamente las 5 categorías fijas, en el mismo orden,
// completando desde lo guardado por id — así el JSON persistido puede venir
// vacío, incompleto o con orden distinto sin romper el render.
export function normalizarCategoriasGastosGenerales(raw: unknown): CategoriaGastoGeneral[] {
  const existentes = Array.isArray(raw) ? (raw as Partial<CategoriaGastoGeneral>[]) : [];
  return CATEGORIAS_GASTOS_GENERALES_FIJAS.map((fija) => {
    const encontrada = existentes.find((c) => c?.id === fija.id);
    return {
      id: fija.id,
      nombre: fija.nombre,
      items: Array.isArray(encontrada?.items) ? (encontrada!.items as ItemGastoGeneral[]) : [],
    };
  });
}

export function sumarGastosGeneralesDetallado(raw: unknown): number {
  return normalizarCategoriasGastosGenerales(raw).reduce(
    (s, cat) => s + cat.items.reduce((si, it) => si + (it.monto || 0), 0),
    0
  );
}
