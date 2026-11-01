"use client";

import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";

// Botón de micrófono que va adentro de un campo de texto (arriba a la
// derecha, con position absolute sobre un contenedor relative). 44×44 px
// para tocarlo cómodo en celular. El estado lo maneja useDictado.
export function BotonDictado({
  escuchando,
  onClick,
  className,
}: {
  escuchando: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={escuchando}
      aria-label={escuchando ? "Dejar de dictar" : "Dictar con el micrófono"}
      title={escuchando ? "Escuchando… tocá para terminar" : "Dictar con el micrófono"}
      className={cn(
        "absolute top-1 right-1 w-11 h-11 flex items-center justify-center rounded-[8px] transition-colors",
        escuchando
          ? "bg-blue-50 text-[#2563EB] ring-2 ring-blue-200 motion-safe:animate-pulse"
          : "text-slate-400 hover:text-[#2563EB] hover:bg-blue-50",
        className
      )}
    >
      {escuchando ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
    </button>
  );
}
