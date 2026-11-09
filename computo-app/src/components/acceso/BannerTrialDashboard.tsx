"use client";

import { Gift, Zap, FolderOpen } from "lucide-react";

// Banner informativo del trial — visible solo para empresas en PRUEBA con más
// de 10 días restantes (cuando quedan ≤10 ya aparece AvisoPrueba en el header).
// Muestra los cupos disponibles y los días que quedan.
export function BannerTrialDashboard({
  diasRestantes,
  crUsados,
  crLimite,
  proyectosIAUsados,
  proyectosIALimite,
}: {
  diasRestantes: number;
  crUsados: number;
  crLimite: number;
  proyectosIAUsados: number;
  proyectosIALimite: number;
}) {
  const crRestantes = Math.max(0, crLimite - crUsados);
  const proyectosRestantes = Math.max(0, proyectosIALimite - proyectosIAUsados);

  return (
    <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-blue-900">
      <span className="flex items-center gap-1.5 font-semibold text-blue-700">
        <Gift className="w-4 h-4 flex-shrink-0" />
        Prueba gratuita · {diasRestantes} {diasRestantes === 1 ? "día" : "días"} restantes
      </span>
      <span className="hidden sm:block w-px h-4 bg-blue-200" />
      <span className="flex items-center gap-1.5 text-blue-800">
        <Zap className="w-3.5 h-3.5 flex-shrink-0 text-blue-500" />
        {crRestantes === 0
          ? "Cálculos Rápidos agotados"
          : `${crRestantes} ${crRestantes === 1 ? "Cálculo Rápido" : "Cálculos Rápidos"} disponible${crRestantes === 1 ? "" : "s"}`}
      </span>
      <span className="hidden sm:block w-px h-4 bg-blue-200" />
      <span className="flex items-center gap-1.5 text-blue-800">
        <FolderOpen className="w-3.5 h-3.5 flex-shrink-0 text-blue-500" />
        {proyectosRestantes === 0
          ? "Proyecto con IA agotado"
          : `${proyectosRestantes} proyecto con presupuesto completo`}
      </span>
    </div>
  );
}
