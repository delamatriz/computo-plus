"use client";

import { useRef } from "react";
import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";

// Botón de micrófono que va adentro de un campo de texto (arriba a la
// derecha, con position absolute sobre un contenedor relative). 44×44 px
// para tocarlo cómodo en celular. El estado lo maneja useDictado.
// - Con el dedo (celular): graba mientras se mantiene apretado y corta al
//   soltar, como los audios de cualquier app de mensajes.
// - Con el mouse: un clic empieza (se corta solo con el silencio) y otro termina.
export function BotonDictado({
  escuchando,
  onIniciar,
  onDetener,
  className,
}: {
  escuchando: boolean;
  onIniciar: (opciones: { continuo: boolean }) => void;
  onDetener: () => void;
  className?: string;
}) {
  // El toque dispara también un click al soltar: se ignora para no
  // volver a arrancar lo que el dedo acaba de cortar.
  const fueToque = useRef(false);

  return (
    <button
      type="button"
      onPointerDown={(e) => {
        fueToque.current = e.pointerType !== "mouse";
        if (!fueToque.current) return;
        e.preventDefault(); // sin foco en el campo ni teclado en pantalla
        onIniciar({ continuo: true });
        try {
          e.currentTarget.setPointerCapture(e.pointerId); // el dedo puede moverse un poco sin cortar
        } catch {
          // Sin captura igual funciona: solo corta antes si el dedo sale del botón.
        }
      }}
      onPointerUp={() => {
        if (fueToque.current) onDetener();
      }}
      onPointerCancel={() => {
        if (fueToque.current) onDetener();
      }}
      onClick={() => {
        if (fueToque.current) return;
        if (escuchando) onDetener();
        else onIniciar({ continuo: false });
      }}
      onContextMenu={(e) => e.preventDefault()} // mantener apretado no abre el menú del sistema
      aria-pressed={escuchando}
      aria-label={escuchando ? "Dejar de dictar" : "Dictar con el micrófono"}
      title={escuchando ? "Escuchando…" : "Dictar con el micrófono (en el celular, mantené apretado)"}
      className={cn(
        "absolute top-1 right-1 w-11 h-11 flex items-center justify-center rounded-[8px] transition-colors select-none touch-none [-webkit-touch-callout:none]",
        escuchando
          ? "bg-blue-50 text-[#2563EB] ring-2 ring-blue-200 motion-safe:animate-pulse"
          : "text-slate-400 hover:text-[#2563EB] hover:bg-blue-50",
        className
      )}
    >
      {/* El mismo Mic en los dos estados: lo que cambia es el color y el pulso. */}
      <Mic className="w-5 h-5" />
    </button>
  );
}
