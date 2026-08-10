import { BookOpen } from "lucide-react";

export default function BibliotecaPage() {
  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-semibold text-[#1A3A5C] mb-2">
        Biblioteca
      </h1>
      <p className="text-slate-500 mb-8">
        Documentación y contenido de referencia interno de Cómputo+.
      </p>

      <div className="flex flex-col items-center justify-center text-center bg-white rounded-xl border border-slate-200 py-16 px-6">
        <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-4">
          <BookOpen className="w-5 h-5 text-[#2563EB]" />
        </div>
        <h2 className="text-sm font-semibold text-[#1E293B] mb-1">
          Próximamente
        </h2>
        <p className="text-sm text-slate-500 max-w-sm">
          Acá vas a poder consultar guías, procedimientos y documentación de
          referencia interna.
        </p>
      </div>
    </div>
  );
}
