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
}

export interface RubroOption {
  id: string;
  nombre: string;
  capituloNombre: string;
  unidad: string;
}

export function fmtNum(v: number, decimales = 2): string {
  return v.toLocaleString("es-UY", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

// Compara unidades tolerando mayúsculas/espacios — la unidad de una fila
// puede venir de la IA ("m2", "M2" según el endpoint) mientras que
// Rubro.unidad hoy en la base son códigos en mayúscula ("M2", "ML",
// "M3", "GL"...). Compartida entre las rutas API de filas-metraje y el
// <select> de PlanillaComputo.tsx para que validen exactamente lo mismo.
export function unidadesCoinciden(a: string, b: string): boolean {
  return a.trim().toUpperCase() === b.trim().toUpperCase();
}

export function subtotalFila(f: MetrajeFila): number {
  const valores = [f.largo, f.ancho, f.alto, f.cantidad];
  if (valores.every((v) => v == null)) return 0;
  return valores.reduce((acc: number, v) => acc * (v ?? 1), 1);
}
