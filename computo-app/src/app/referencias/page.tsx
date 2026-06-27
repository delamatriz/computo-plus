import { ExternalLink } from "lucide-react";

interface Referencia {
  titulo: string;
  descripcion: string;
  url: string;
}

const referencias: Referencia[] = [
  {
    titulo: "Convenio SUNCA",
    descripcion: "Escalas salariales y convenio colectivo vigente",
    url: "https://sunca.uy/category/convenios/",
  },
  {
    titulo: "Lista de Precios MTOP N°599",
    descripcion: "Precios de materiales de construcción — Ministerio de Transporte",
    url: "https://www.gub.uy/ministerio-transporte-obras-publicas/tematica/precios-construccion",
  },
  {
    titulo: "Índice ICCV — INE",
    descripcion: "Índice del Costo de la Construcción de Vivienda",
    url: "https://www.ine.gub.uy",
  },
  {
    titulo: "Leyes Sociales — BPS",
    descripcion: "Aportes patronales y personales de la construcción",
    url: "https://www.bps.gub.uy",
  },
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
    titulo: "Pequeñas Obras de Mantenimiento — BPS",
    descripcion: "Condiciones y requisitos para obras de mantenimiento menores",
    url: "https://www.bps.gub.uy/9037/",
  },
  {
    titulo: "Artículo 1844 — Responsabilidad por Defectos de Construcción",
    descripcion: "Código Civil uruguayo modificado por Ley 19.726 (2018) — plazos 10, 5 y 2 años",
    url: "https://www.impo.com.uy/bases/codigo-civil/16603-1994/1844",
  },
];

export default function ReferenciasPage() {
  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-semibold text-[#1A3A5C] mb-2">
        Referencias y Documentos
      </h1>
      <p className="text-slate-500 mb-8">
        Fuentes oficiales para precios, jornales y normativa de obra en Uruguay.
      </p>

      <div className="space-y-3">
        {referencias.map((ref) => (
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
    </div>
  );
}
