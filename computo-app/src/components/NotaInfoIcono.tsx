"use client";

import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";

// Ícono de información + tooltip oscuro posicionado en `fixed` con las
// coordenadas del disparador — mismo patrón que NotaInternaIcono de
// proyectos/[id]/page.tsx. Con `absolute` el tooltip se recortaría contra los
// contenedores con overflow (tarjetas colapsables, listas con scroll); `fixed`
// lo dibuja por encima de todo.
//
// Hover con mouse; en pantallas táctiles (sin hover) un tap lo muestra y otro
// tap — o tocar afuera — lo oculta. Los saltos de línea del texto se respetan.
//
// Sin `children` el disparador es el ícono ⓘ y el tooltip abre a la derecha,
// centrado en vertical. Con `children` ese contenido es el disparador (ej. un
// aviso completo) y el tooltip abre debajo de él (o arriba si no entra).
export function NotaInfoIcono({
  texto,
  ancho = 288,
  children,
  className,
}: {
  texto: string;
  ancho?: number;
  children?: React.ReactNode;
  className?: string;
}) {
  const [pos, setPos] = useState<{ x: number; y: number; arriba?: boolean } | null>(null);
  const raiz = useRef<HTMLSpanElement>(null);
  const tipoPuntero = useRef<string>("mouse");

  const mostrar = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    // Alto estimado (≈ ancho/7 caracteres por renglón de 16px + padding) solo
    // para no salirse del viewport.
    const renglones = texto
      .split("\n")
      .reduce((s, linea) => s + Math.max(1, Math.ceil(linea.length / (ancho / 7))), 0);
    const alto = renglones * 16 + 20;
    if (children) {
      const x = Math.max(8, Math.min(r.left, window.innerWidth - ancho - 8));
      const abajoEntra = r.bottom + 8 + alto <= window.innerHeight - 8;
      setPos(abajoEntra ? { x, y: r.bottom + 8 } : { x, y: r.top - 8, arriba: true });
      return;
    }
    const y = Math.min(Math.max(r.top + r.height / 2, alto / 2 + 8), window.innerHeight - alto / 2 - 8);
    const x = Math.max(8, Math.min(r.right + 8, window.innerWidth - ancho - 8));
    setPos({ x, y });
  };

  // Abierto con un tap: se cierra al tocar cualquier otro lado.
  useEffect(() => {
    if (!pos) return;
    const cerrarSiAfuera = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" && raiz.current && !raiz.current.contains(e.target as Node)) setPos(null);
    };
    document.addEventListener("pointerdown", cerrarSiAfuera);
    return () => document.removeEventListener("pointerdown", cerrarSiAfuera);
  }, [pos]);

  const estilo = children
    ? { left: pos?.x, top: pos?.y, width: ancho, transform: pos?.arriba ? "translateY(-100%)" : undefined }
    : { left: pos?.x, top: pos?.y, width: ancho, transform: "translateY(-50%)" };

  return (
    <span
      ref={raiz}
      className={className ?? "inline-flex align-middle ml-1.5 flex-shrink-0"}
      onPointerDown={(e) => { tipoPuntero.current = e.pointerType; }}
      onPointerEnter={(e) => { if (e.pointerType === "mouse") mostrar(e.currentTarget); }}
      onPointerLeave={(e) => { if (e.pointerType === "mouse") setPos(null); }}
      onClick={(e) => {
        if (tipoPuntero.current === "mouse") return;
        if (pos) setPos(null);
        else mostrar(e.currentTarget);
      }}
    >
      {children ?? (
        <Info className={`w-3 h-3 transition-colors cursor-help ${pos ? "text-[#2563EB]" : "text-slate-400"}`} aria-label="Más información" />
      )}
      {pos && (
        <span className="pointer-events-none fixed z-50" style={estilo}>
          <span className="block whitespace-pre-line rounded-[8px] bg-[#1A3A5C] text-white text-xs font-normal leading-relaxed px-3 py-2 shadow-lg normal-case tracking-normal">
            {texto}
          </span>
        </span>
      )}
    </span>
  );
}
