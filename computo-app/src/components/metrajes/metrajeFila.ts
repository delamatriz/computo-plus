// Tipos y helpers de la Planilla de cómputo — separados de page.tsx
// (dueño del estado `filas`, ver /proyectos/[id]/visor) y
// PlanillaComputo.tsx (UI) para que ambos los importen sin depender uno
// del otro. Refleja 1:1 el modelo persistido FilaMetraje
// (prisma/schema.prisma) — toda fila nueva se crea vía POST antes de
// entrar al estado local, así que siempre tiene id real de la base.

export interface MetrajeFila {
  id: string;
  descripcion: string;
  largo: number | null;
  ancho: number | null;
  alto: number | null;
  cantidad: number | null;
  unidad: string | null;
  rubroId: string | null;
  // Puente con la medición que generó esta fila (Etapa 3, trazo sobre un
  // plano) — null en filas manuales o generadas por IA.
  medicionId: string | null;
  // Puente con la medición del ANCHO, si se midió directo en el plano
  // hacia esta fila en vez de escribirlo a mano (ver ícono de regla en
  // PlanillaComputo.tsx) — null si ancho está vacío, es manual, o la
  // fila no tiene medicionId (no se ofrece esta opción para filas
  // manuales/IA).
  medicionAnchoId: string | null;
}

export interface RubroOption {
  id: string;
  nombre: string;
  capituloNombre: string;
  // Nombre del título del capítulo (ver model Titulo en schema.prisma) —
  // null si el capítulo está suelto. Existe para desambiguar en el
  // agrupador de PlanillaComputo.tsx dos capítulos con el mismo nombre en
  // títulos distintos (ej. "Albañilería" en Título 1 y en Título 2).
  tituloNombre: string | null;
  unidad: string;
}

// "Aplicar al presupuesto" (POST /api/proyectos/[id]/aplicar-computo) —
// suma FilaMetraje por rubroId a nivel de PROYECTO (cruza documentos, ver
// diseño confirmado). Tipos compartidos entre esa ruta y el modal de
// PlanillaComputo.tsx para que el preview y el resultado aplicado usen
// exactamente la misma forma.
export interface DesgloseDocumento {
  documentoNombre: string;
  paginaPDF: number | null;
  cantidad: number;
}

export interface ActualizacionComputo {
  rubroId: string;
  nombre: string;
  capituloNombre: string;
  unidad: string;
  cantidadActual: number;
  cantidadNueva: number;
  // true si Rubro.cantidadOrigen === "MANUAL" y cantidadActual !== 0 — hay
  // un valor cargado a mano que "Aplicar" pisaría, hace falta avisar.
  requiereConfirmacion: boolean;
  desglosePorDocumento: DesgloseDocumento[];
}

export function fmtNum(v: number, decimales = 2): string {
  return v.toLocaleString("es-UY", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

// Etiqueta compacta para mostrar junto al Subtotal en la Planilla — mismo
// carácter unicode m²/m³ que ya usa el resto de la app (Área total, medir
// Área en el Visor), no <sup>. "jornada" se abrevia a "jorn." para que no
// desborde la columna angosta del Subtotal; el resto de los códigos ya son
// cortos de por sí. Códigos no reconocidos caen a minúsculas tal cual.
const UNIDADES_DISPLAY: Record<string, string> = {
  M2: "m²",
  M3: "m³",
  ML: "ml",
  GL: "gl",
  U: "u",
  KG: "kg",
  TN: "tn",
  HR: "hr",
  JORNADA: "jorn.",
};

export function fmtUnidad(unidad: string | null | undefined): string {
  if (!unidad) return "";
  const codigo = unidad.trim().toUpperCase();
  return UNIDADES_DISPLAY[codigo] ?? unidad.trim().toLowerCase();
}

// Compara unidades tolerando mayúsculas/espacios — la unidad de una fila
// puede venir de la IA ("m2", "M2" según el endpoint) mientras que
// Rubro.unidad hoy en la base son códigos en mayúscula ("M2", "ML",
// "M3", "GL"...). Compartida entre las rutas API de filas-metraje y el
// <select> de PlanillaComputo.tsx para que validen exactamente lo mismo.
export function unidadesCoinciden(a: string, b: string): boolean {
  return a.trim().toUpperCase() === b.trim().toUpperCase();
}

// Un rubro con unidad "GL" (ítem Global) no depende de ninguna unidad de
// medición — por definición no tiene sentido bloquearlo por "unidad
// distinta" aunque la fila traiga M3/M2/ML calculado de una medición.
// Único caso especial; todo lo demás sigue exigiendo coincidencia exacta
// (unidadesCoinciden). Misma función usada por el <select> de
// PlanillaComputo.tsx y por los guards server-side de filas-metraje, para
// que ningún lado quede más permisivo que el otro.
export function rubroCompatibleConFila(unidadFila: string, unidadRubro: string): boolean {
  return unidadRubro.trim().toUpperCase() === "GL" || unidadesCoinciden(unidadFila, unidadRubro);
}

export function subtotalFila(f: Pick<MetrajeFila, "largo" | "ancho" | "alto" | "cantidad">): number {
  const valores = [f.largo, f.ancho, f.alto, f.cantidad];
  if (valores.every((v) => v == null)) return 0;
  return valores.reduce((acc: number, v) => acc * (v ?? 1), 1);
}
