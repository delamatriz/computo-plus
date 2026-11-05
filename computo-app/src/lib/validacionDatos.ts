// Validación de tipos y rangos de lo que llega en un PATCH/PUT (auditoría de
// seguridad nov-2026, hallazgo #6): antes estos campos se guardaban tal cual
// vinieran, y un pedido armado a mano podía dejar totales sin sentido
// (porcentajes negativos, montos de texto) o romper pantallas (un estado o
// una moneda que la app no conoce). Solo afectaba a los datos de la propia
// empresa, pero un valor corrupto mueve todo el presupuesto.
//
// Uso: const error = validarCampos(body, { campo: regla, ... });
//      if (error) return NextResponse.json({ error }, { status: 400 });
// Solo se validan los campos que vienen (undefined = no se toca).

/** Devuelve un mensaje si el valor no sirve, o null si está bien. */
export type Regla = (valor: unknown) => string | null;

export function validarCampos(body: unknown, reglas: Record<string, Regla>): string | null {
  if (!body || typeof body !== "object") return "Cuerpo del pedido inválido";
  const datos = body as Record<string, unknown>;
  for (const [campo, regla] of Object.entries(reglas)) {
    if (datos[campo] === undefined) continue;
    const error = regla(datos[campo]);
    if (error) return `${campo}: ${error}`;
  }
  return null;
}

export const enumeracion =
  (valores: readonly string[], { nulo = false } = {}): Regla =>
  (v) => {
    if (v === null && nulo) return null;
    return typeof v === "string" && valores.includes(v) ? null : `tiene que ser uno de: ${valores.join(", ")}`;
  };

export const numero =
  ({ min = -Infinity, max = Infinity, entero = false, nulo = false }: { min?: number; max?: number; entero?: boolean; nulo?: boolean } = {}): Regla =>
  (v) => {
    if (v === null && nulo) return null;
    if (typeof v !== "number" || !Number.isFinite(v)) return "tiene que ser un número";
    if (entero && !Number.isInteger(v)) return "tiene que ser un número entero";
    if (v < min || v > max) return `tiene que estar entre ${min} y ${max}`;
    return null;
  };

export const texto =
  ({ max = 2000, nulo = true, vacio = true }: { max?: number; nulo?: boolean; vacio?: boolean } = {}): Regla =>
  (v) => {
    if (v === null && nulo) return null;
    if (typeof v !== "string") return "tiene que ser un texto";
    if (!vacio && !v.trim()) return "no puede estar vacío";
    if (v.length > max) return `no puede superar los ${max} caracteres`;
    return null;
  };

export const booleano: Regla = (v) => (typeof v === "boolean" ? null : "tiene que ser verdadero o falso");

/** Fecha como texto (AAAA-MM-DD o ISO) o null. */
export const fecha: Regla = (v) => {
  if (v === null || v === "") return null;
  return typeof v === "string" && !Number.isNaN(new Date(v).getTime()) ? null : "tiene que ser una fecha válida";
};

/** Ítem de gastos generales: { id, descripcion, monto ≥ 0, exentoIVA? }. */
function errorItemGasto(it: unknown): string | null {
  if (!it || typeof it !== "object") return "ítem inválido";
  const i = it as Record<string, unknown>;
  if (typeof i.id !== "string" || i.id.length > 100) return "ítem con id inválido";
  if (typeof i.descripcion !== "string" || i.descripcion.length > 500) return "ítem con descripción inválida";
  if (typeof i.monto !== "number" || !Number.isFinite(i.monto) || i.monto < 0) return "ítem con monto inválido (número ≥ 0)";
  if (i.exentoIVA !== undefined && typeof i.exentoIVA !== "boolean") return "ítem con exentoIVA inválido";
  return null;
}

const MAX_ITEMS = 500;

/** Lista de ítems de gastos generales (modo porcentaje) o null. */
export const itemsGastosGenerales: Regla = (v) => {
  if (v === null) return null;
  if (!Array.isArray(v) || v.length > MAX_ITEMS) return "tiene que ser una lista de ítems";
  for (const it of v) {
    const e = errorItemGasto(it);
    if (e) return e;
  }
  return null;
};

/** Categorías de gastos generales (modo detallado): [{ id, nombre, items }] o null. */
export const categoriasGastosGenerales: Regla = (v) => {
  if (v === null) return null;
  if (!Array.isArray(v) || v.length > 100) return "tiene que ser una lista de categorías";
  for (const c of v) {
    if (!c || typeof c !== "object") return "categoría inválida";
    const cat = c as Record<string, unknown>;
    if (typeof cat.id !== "string" || typeof cat.nombre !== "string" || cat.nombre.length > 300) return "categoría inválida";
    const e = itemsGastosGenerales(cat.items ?? []);
    if (e) return e;
  }
  return null;
};
