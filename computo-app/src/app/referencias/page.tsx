import { FileText } from "lucide-react";

// Los 9 links que vivían acá se repartieron entre Materiales, Mano de
// Obra, Leyes Sociales y Biblioteca (Sistema) — ver commit del reparto.
// Esta pantalla queda para documentación propia del sistema.
export default function ReferenciasPage() {
  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-semibold text-[#1A3A5C] mb-2">
        Referencias
      </h1>
      <p className="text-slate-500 mb-8">
        Documentación propia del sistema — tutoriales, glosario, ejemplos.
      </p>

      <div className="flex flex-col items-center justify-center text-center bg-white rounded-xl border border-slate-200 py-16 px-6">
        <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-4">
          <FileText className="w-5 h-5 text-[#2563EB]" />
        </div>
        <h2 className="text-sm font-semibold text-[#1E293B] mb-1">
          Próximamente
        </h2>
        <p className="text-sm text-slate-500 max-w-sm">
          Acá vas a encontrar tutoriales, glosario de términos de obra y
          ejemplos de uso de Cómputo+.
        </p>
      </div>
    </div>
  );
}
