import { Package } from "lucide-react";

export default function MaterialesPage() {
  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-semibold text-[#1A3A5C] mb-2">
        Materiales
      </h1>
      <p className="text-slate-500 mb-8">
        Catálogo de materiales de construcción y sus precios de referencia.
      </p>

      <div className="flex flex-col items-center justify-center text-center bg-white rounded-xl border border-slate-200 py-16 px-6">
        <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-4">
          <Package className="w-5 h-5 text-[#2563EB]" />
        </div>
        <h2 className="text-sm font-semibold text-[#1E293B] mb-1">
          Próximamente
        </h2>
        <p className="text-sm text-slate-500 max-w-sm">
          Acá vas a poder consultar los materiales usados en los descompuestos
          del Catálogo de Rubros, con sus precios y fuentes.
        </p>
      </div>
    </div>
  );
}
