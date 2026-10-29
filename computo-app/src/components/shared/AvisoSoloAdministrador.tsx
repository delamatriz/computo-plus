import { Lock } from "lucide-react";

// Texto estándar para controles que solo puede usar el SUPERADMIN (catálogos
// globales: precios, jornales, convenio, ICCV). Para botones deshabilitados
// va como `title`; para secciones enteras, el banner de abajo.
export const TEXTO_SOLO_ADMINISTRADOR = "Solo puede modificarlo el Administrador de CÓMPUTO+";

export function AvisoSoloAdministrador({ texto = TEXTO_SOLO_ADMINISTRADOR }: { texto?: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-400 py-2">
      <Lock className="w-3.5 h-3.5" />
      <span>{texto}</span>
    </div>
  );
}
