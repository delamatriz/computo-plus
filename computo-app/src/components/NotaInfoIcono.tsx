"use client";

import { useState } from "react";
import { Info } from "lucide-react";

// Ícono de información + tooltip oscuro posicionado en `fixed` con las
// coordenadas del ícono — mismo patrón que NotaInternaIcono de
// proyectos/[id]/page.tsx. Con `absolute` el tooltip se recortaría contra los
// contenedores con overflow (tarjetas colapsables, listas con scroll); `fixed`
// lo dibuja por encima de todo. Abre a la derecha del ícono, centrado en
// vertical y acotado al viewport.
export function NotaInfoIcono({ texto, ancho = 288 }: { texto: string; ancho?: number }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const mostrar = (e: React.MouseEvent<HTMLSpanElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    // Alto estimado (≈40 caracteres por renglón de 16px + padding) solo para no
    // salirse del viewport; el centrado real lo hace translateY(-50%).
    const alto = Math.ceil(texto.length / (ancho / 7)) * 16 + 20;
    const y = Math.min(Math.max(r.top + r.height / 2, alto / 2 + 8), window.innerHeight - alto / 2 - 8);
    const x = Math.max(8, Math.min(r.right + 8, window.innerWidth - ancho - 8));
    setPos({ x, y });
  };
  return (
    <span className="inline-flex align-middle ml-1.5 flex-shrink-0" onMouseEnter={mostrar} onMouseLeave={() => setPos(null)}>
      <Info className={`w-3 h-3 transition-colors cursor-help ${pos ? "text-[#2563EB]" : "text-slate-400"}`} aria-label="Más información" />
      {pos && (
        <span className="pointer-events-none fixed z-50" style={{ left: pos.x, top: pos.y, width: ancho, transform: "translateY(-50%)" }}>
          <span className="block rounded-[8px] bg-[#1A3A5C] text-white text-xs font-normal leading-relaxed px-3 py-2 shadow-lg normal-case tracking-normal">
            {texto}
          </span>
        </span>
      )}
    </span>
  );
}
