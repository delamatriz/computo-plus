import { cn } from "@/lib/utils";
import { fmtDecimalUY, fmtRendimiento } from "@/lib/formatoNumeros";

// Encabezados de columna de cada sección de un descompuesto (APU) de solo
// lectura — Catálogo de Rubros (/rubros) y Mi biblioteca. La primera columna
// es flexible (descripción/categoría); el resto lleva el mismo ancho (`ancho`,
// clases de Tailwind) que la columna numérica de las filas de abajo.
export function EncabezadosAPU({
  columnas,
}: {
  columnas: { label: string; ancho?: string; title?: string }[];
}) {
  const [primera, ...resto] = columnas;
  return (
    <div className="flex items-center gap-2 px-2 pb-1 mb-0.5 border-b border-slate-100 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
      <span className="flex-1 min-w-0" title={primera.title}>
        {primera.label}
      </span>
      {resto.map((c) => (
        <span key={c.label} className={cn("flex-shrink-0 text-right", c.ancho)} title={c.title}>
          {c.label}
        </span>
      ))}
    </div>
  );
}

// Rendimiento de mano de obra: unidades del rubro producidas por jornada de
// `jornadaHs` horas (la línea de MO no guarda unidad propia, es la del rubro).
// Ej. "17,5 M2 / jornada de 8 h".
export function textoRendimientoMO(rendimiento: number, unidad: string, jornadaHs: number): string {
  return `${fmtRendimiento(rendimiento)} ${unidad} / jornada de ${fmtDecimalUY(jornadaHs, 1)} h`;
}
