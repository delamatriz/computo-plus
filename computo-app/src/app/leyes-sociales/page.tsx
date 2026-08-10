import { Scale } from "lucide-react";

export default function LeyesSocialesPage() {
  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-semibold text-[#1A3A5C] mb-2">
        Leyes Sociales
      </h1>
      <p className="text-slate-500 mb-8">
        Referencia general de aportes BPS, AUC y fondos de la industria de la
        construcción.
      </p>

      <div className="flex flex-col items-center justify-center text-center bg-white rounded-xl border border-slate-200 py-16 px-6">
        <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-4">
          <Scale className="w-5 h-5 text-[#2563EB]" />
        </div>
        <h2 className="text-sm font-semibold text-[#1E293B] mb-1">
          Próximamente
        </h2>
        <p className="text-sm text-slate-500 max-w-sm">
          Acá vas a encontrar la referencia general de leyes sociales (AUC,
          FOCER, FSC, FONASA, etc.). El cálculo puntual de cada obra sigue
          viviendo en la pestaña Presupuesto de cada proyecto.
        </p>
      </div>
    </div>
  );
}
