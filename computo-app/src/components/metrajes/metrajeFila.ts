// Tipos y helpers de la Planilla de cómputo — separados de
// SeccionMetrajesPresupuesto.tsx (dueño del estado `filas`) y
// PlanillaComputo.tsx (UI, ahora dentro del Visor) para que ambos los
// importen sin depender uno del otro.

export interface MetrajeFila {
  id: string;
  descripcion: string;
  largo: number | null;
  ancho: number | null;
  alto: number | null;
  cantidad: number | null;
  rubroId: string | null;
}

export interface RubroOption {
  id: string;
  nombre: string;
  capituloNombre: string;
}

export function fmtNum(v: number, decimales = 2): string {
  return v.toLocaleString("es-UY", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

export function subtotalFila(f: MetrajeFila): number {
  const valores = [f.largo, f.ancho, f.alto, f.cantidad];
  if (valores.every((v) => v == null)) return 0;
  return valores.reduce((acc: number, v) => acc * (v ?? 1), 1);
}

export function nuevaFila(): MetrajeFila {
  return {
    id: `f${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    descripcion: "",
    largo: null,
    ancho: null,
    alto: null,
    cantidad: null,
    rubroId: null,
  };
}
