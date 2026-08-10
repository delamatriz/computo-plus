import { ExternalLink } from "lucide-react";

// Tarjeta de link externo — mismo formato usado antes en /referencias
// (título, descripción, abre en pestaña nueva), reusado ahora en varias
// páginas (Materiales/Mano de Obra/Leyes Sociales/Biblioteca) tras el
// reparto de los 9 links que vivían todos juntos en /referencias.
export interface ReferenciaLink {
  titulo: string;
  descripcion: string;
  url: string;
}

export function ListaReferencias({ items }: { items: ReferenciaLink[] }) {
  return (
    <div className="space-y-3">
      {items.map((ref) => (
        <a
          key={ref.url}
          href={ref.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-4 bg-white rounded-xl border border-slate-200 p-5 hover:border-slate-300 transition-colors"
        >
          <div>
            <h2 className="text-sm font-semibold text-[#1E293B]">{ref.titulo}</h2>
            <p className="text-sm text-slate-500 mt-0.5">{ref.descripcion}</p>
          </div>
          <ExternalLink className="w-4 h-4 text-slate-400 flex-shrink-0" />
        </a>
      ))}
    </div>
  );
}
