import { BookOpen } from "lucide-react";
import { ListaReferencias, type ReferenciaLink } from "@/components/ListaReferencias";

const referencias: ReferenciaLink[] = [
  {
    titulo: "Tercerización — Ley 18.251",
    descripcion: "Responsabilidad solidaria en subcontratación de obras",
    url: "https://www.impo.com.uy/bases/leyes/18251-2008",
  },
  {
    titulo: "Ley 14.411 — Industria de la Construcción",
    descripcion: "Régimen de aportes y leyes sociales de la construcción",
    url: "https://www.impo.com.uy/bases/leyes/14411-1975",
  },
  {
    titulo: "Ley 19.996",
    descripcion: "Modificaciones al régimen de la industria de la construcción",
    url: "https://www.impo.com.uy/bases/leyes/19996-2021",
  },
  {
    titulo: "Artículo 1844 — Responsabilidad por Defectos de Construcción",
    descripcion: "Código Civil uruguayo modificado por Ley 19.726 (2018) — plazos 10, 5 y 2 años",
    url: "https://www.impo.com.uy/bases/codigo-civil/16603-1994/1844",
  },
];

export default function BibliotecaPage() {
  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-semibold text-[#1A3A5C] mb-2">
        Biblioteca
      </h1>
      <p className="text-slate-500 mb-8">
        Normativa y leyes puntuales relevantes para presupuestar obra.
      </p>

      <ListaReferencias items={referencias} />

      <div className="flex flex-col items-center justify-center text-center bg-white rounded-xl border border-slate-200 py-16 px-6 mt-6">
        <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-4">
          <BookOpen className="w-5 h-5 text-[#2563EB]" />
        </div>
        <h2 className="text-sm font-semibold text-[#1E293B] mb-1">
          Próximamente
        </h2>
        <p className="text-sm text-slate-500 max-w-sm">
          Además de estas leyes, acá vas a poder consultar guías,
          procedimientos y otra documentación de referencia interna.
        </p>
      </div>
    </div>
  );
}
