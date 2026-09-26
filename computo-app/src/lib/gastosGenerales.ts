// Lógica pura del modo Detallado de Gastos Generales — compartida entre
// SeccionGastosGeneralesUtilidades.tsx (cliente) y pdf/route.ts (servidor).
// Sin esto, el monto de Gastos Generales en modo Detallado se calculaba
// distinto en cada lugar (bug real: el PDF lo ignoraba por completo, ver
// pdf/route.ts).

export interface ItemGastoGeneral {
  id: string;
  descripcion: string;
  monto: number;
  // Tasas estatales fijas por trámite (Timbres CJP, timbres BPS) quedan
  // fuera del alcance del IVA — a diferencia de compras de materiales o
  // servicios de terceros, que sí lo llevan. Default false: la mayoría
  // de los ítems de Gastos Generales (personal, alquileres, consumos)
  // sí son base imponible normal.
  exentoIVA: boolean;
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

// Id estable del ítem "Timbres CJP/CJPPU" sembrado por defecto en
// personal_tecnico (ver más abajo) — permite detectar si ya está
// guardado (para no duplicarlo) sin depender de matchear por texto.
export const ITEM_TIMBRES_CJP_ID = "timbres_cjp";
const CATEGORIA_TIMBRES_CJP = "personal_tecnico";

// Siempre devuelve exactamente las 5 categorías fijas, en el mismo orden,
// completando desde lo guardado por id — así el JSON persistido puede venir
// vacío, incompleto o con orden distinto sin romper el render. Cada ítem
// completa exentoIVA: false si viene de un JSON guardado antes de que
// existiera el campo.
export function normalizarCategoriasGastosGenerales(raw: unknown): CategoriaGastoGeneral[] {
  const existentes = Array.isArray(raw) ? (raw as Partial<CategoriaGastoGeneral>[]) : [];
  return CATEGORIAS_GASTOS_GENERALES_FIJAS.map((fija) => {
    const encontrada = existentes.find((c) => c?.id === fija.id);
    const itemsGuardados = Array.isArray(encontrada?.items)
      ? (encontrada!.items as Partial<ItemGastoGeneral>[]).map((it) => ({
          id: it.id ?? "",
          descripcion: it.descripcion ?? "",
          monto: it.monto ?? 0,
          exentoIVA: it.exentoIVA ?? false,
        }))
      : [];
    // Timbres CJP/CJPPU — tasa estatal fija, mismo criterio de exención
    // que timbres BPS (ver relevamiento). Sembrado siempre en
    // personal_tecnico (categoría semánticamente más cercana: es un
    // costo administrativo fijo, no de equipamiento/logística) si el
    // usuario todavía no lo tiene guardado con este id — mismo patrón
    // que las 5 categorías fijas de arriba, que tampoco se pueden
    // eliminar permanentemente. Monto en 0 hasta que se cargue.
    const items =
      fija.id === CATEGORIA_TIMBRES_CJP && !itemsGuardados.some((it) => it.id === ITEM_TIMBRES_CJP_ID)
        ? [
            { id: ITEM_TIMBRES_CJP_ID, descripcion: "Timbres CJP/CJPPU", monto: 0, exentoIVA: true },
            ...itemsGuardados,
          ]
        : itemsGuardados;
    return { id: fija.id, nombre: fija.nombre, items };
  });
}

export interface SumaGastosGeneralesDetallado {
  /** Suma de TODOS los ítems — sigue siendo lo que se suma a Costo
   *  Total/Precio Final, exentos incluidos (la exención es solo respecto
   *  del IVA, no dejan de ser un costo real del proyecto). */
  total: number;
  /** Subconjunto de `total` que corresponde a ítems con exentoIVA —
   *  se resta de la base imponible antes de aplicar el 22%, en vez de
   *  sacarse del total. */
  exento: number;
}

export interface ItemSugeridoGastoGeneral {
  descripcion: string;
  // Categoría "natural" propuesta — solo sirve para PRIORIZAR el orden
  // de las sugerencias según en qué categoría está parado el usuario al
  // escribir (ver sugerenciasOrdenadas en SeccionGastosGeneralesUtilidades.tsx).
  // Nunca filtra ni bloquea: cualquiera de los 24 puede sugerirse en
  // cualquier categoría si el texto matchea.
  categoriaId: string;
}

// Los 24 ítems que antes vivían en el capítulo "Gastos Administrativos y
// Conexiones" de la Biblioteca de Rubros (Costo Directo) — se eliminó de
// ahí (0 proyectos reales lo usaban, confirmado antes de borrar) y pasan
// a vivir acá como sugerencias de autocompletado al cargar un ítem en
// Gastos Generales Detallado, no como filas sembradas fijas (19+ filas
// vacías en cada proyecto nuevo sería puro ruido visual). "Timbres CJP"
// se excluye a propósito — es el mismo concepto que ya vive sembrado
// como ITEM_TIMBRES_CJP_ID; listarlo acá también lo duplicaría.
export const ITEMS_SUGERIDOS_GASTOS_ADMIN: ItemSugeridoGastoGeneral[] = [
  { descripcion: "Anteproyecto", categoriaId: "personal_tecnico" },
  { descripcion: "Proyecto arquitectónico", categoriaId: "personal_tecnico" },
  { descripcion: "Proyecto ejecutivo", categoriaId: "personal_tecnico" },
  { descripcion: "Dirección de obra", categoriaId: "personal_tecnico" },
  { descripcion: "Supervisión de obra", categoriaId: "personal_tecnico" },
  { descripcion: "Jefe de obra", categoriaId: "personal_tecnico" },
  { descripcion: "Asesoramiento profesional", categoriaId: "personal_tecnico" },
  { descripcion: "Relevamiento de obra", categoriaId: "personal_tecnico" },
  { descripcion: "Metrajes / cómputo métrico", categoriaId: "personal_tecnico" },
  { descripcion: "Presupuesto", categoriaId: "personal_tecnico" },
  { descripcion: "Control / fiscalización de obra", categoriaId: "personal_tecnico" },
  { descripcion: "Estudio y plan de seguridad (técnico prevencionista)", categoriaId: "personal_tecnico" },
  { descripcion: "Permiso de construcción municipal", categoriaId: "personal_tecnico" },
  { descripcion: "Empadronamiento / catastro", categoriaId: "personal_tecnico" },
  { descripcion: "Final de obra / habilitación municipal", categoriaId: "personal_tecnico" },
  { descripcion: "Estudio de suelos", categoriaId: "personal_tecnico" },
  { descripcion: "Estudio de impacto ambiental", categoriaId: "personal_tecnico" },
  { descripcion: "Estudio topográfico", categoriaId: "personal_tecnico" },
  { descripcion: "Seguro de responsabilidad civil de obra", categoriaId: "personal_tecnico" },
  { descripcion: "Conexión OSE — agua potable", categoriaId: "consumos_servicios" },
  { descripcion: "Conexión OSE — saneamiento", categoriaId: "consumos_servicios" },
  { descripcion: "Conexión UTE — energía eléctrica", categoriaId: "consumos_servicios" },
  { descripcion: "Conexión Gas del Estado / ANCAP", categoriaId: "consumos_servicios" },
  { descripcion: "Conexión de telecomunicaciones/fibra", categoriaId: "consumos_servicios" },
];

export function sumarGastosGeneralesDetallado(raw: unknown): SumaGastosGeneralesDetallado {
  return normalizarCategoriasGastosGenerales(raw).reduce(
    (acc, cat) => {
      for (const it of cat.items) {
        const monto = it.monto || 0;
        acc.total += monto;
        if (it.exentoIVA) acc.exento += monto;
      }
      return acc;
    },
    { total: 0, exento: 0 }
  );
}
