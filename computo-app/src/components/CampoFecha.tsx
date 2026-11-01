"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { hoyUruguayISO } from "@/lib/fechaUruguay";

// Selector de fecha propio de CÓMPUTO+ — reemplaza al <input type="date">
// nativo, que se ve distinto en cada navegador. Mismo contrato que el input:
// value y onChange en "YYYY-MM-DD" ("" = sin fecha). Fechas "solo día", sin
// husos: todo se arma con Date.UTC.
//
// El calendario se dibuja en un portal (position: fixed), así no lo recortan
// los modales y paneles con overflow; se reubica para entrar en la pantalla.

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const DIAS = ["L", "M", "M", "J", "V", "S", "D"];
const ANCHO = 280;

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** "sm" para tablas y filas compactas. */
  tamano?: "sm" | "md";
  className?: string;
  "aria-label"?: string;
}

function partes(iso: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? { y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) } : null;
}

function fmt(iso: string): string {
  const p = partes(iso);
  return p ? `${String(p.d).padStart(2, "0")}/${String(p.m + 1).padStart(2, "0")}/${p.y}` : "";
}

export default function CampoFecha({
  value,
  onChange,
  placeholder = "dd/mm/aaaa",
  disabled,
  tamano = "md",
  className,
  "aria-label": ariaLabel,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const hoy = hoyUruguayISO();
  const base = partes(value) ?? partes(hoy)!;
  const [mes, setMes] = useState({ y: base.y, m: base.m });
  const boton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const abrir = () => {
    if (disabled) return;
    const p = partes(value) ?? partes(hoy)!;
    setMes({ y: p.y, m: p.m });
    setAbierto(true);
  };

  // Ubica el panel debajo del botón (o arriba si no entra), dentro de la pantalla.
  useLayoutEffect(() => {
    if (!abierto) return;
    const ubicar = () => {
      const r = boton.current?.getBoundingClientRect();
      if (!r) return;
      const alto = panel.current?.offsetHeight ?? 320;
      const left = Math.min(Math.max(8, r.left), window.innerWidth - ANCHO - 8);
      const abajo = r.bottom + 6;
      const top = abajo + alto > window.innerHeight - 8 && r.top - alto - 6 > 8 ? r.top - alto - 6 : abajo;
      setPos({ top, left });
    };
    ubicar();
    window.addEventListener("resize", ubicar);
    window.addEventListener("scroll", ubicar, true);
    return () => {
      window.removeEventListener("resize", ubicar);
      window.removeEventListener("scroll", ubicar, true);
    };
  }, [abierto]);

  // Cierra con clic afuera o Escape.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !boton.current?.contains(t)) setAbierto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setAbierto(false);
        boton.current?.focus();
      }
    };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", tecla, true);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", tecla, true);
    };
  }, [abierto]);

  const elegir = (iso: string) => {
    onChange(iso);
    setAbierto(false);
  };

  const moverMes = (delta: number) =>
    setMes((p) => {
      const d = new Date(Date.UTC(p.y, p.m + delta, 1));
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
    });

  // Grilla: semanas de lunes a domingo, con los días de los meses vecinos atenuados.
  const primero = new Date(Date.UTC(mes.y, mes.m, 1));
  const desplazamiento = (primero.getUTCDay() + 6) % 7;
  const celdas = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(Date.UTC(mes.y, mes.m, 1 - desplazamiento + i));
    return { iso: d.toISOString().slice(0, 10), dia: d.getUTCDate(), delMes: d.getUTCMonth() === mes.m };
  });
  const semanas = celdas.slice(35).every((c) => !c.delMes) ? celdas.slice(0, 35) : celdas;

  return (
    <>
      <button
        ref={boton}
        type="button"
        disabled={disabled}
        onClick={() => (abierto ? setAbierto(false) : abrir())}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        className={cn(
          "w-full inline-flex items-center gap-2 bg-white border border-slate-200 text-left tabular-nums transition-colors",
          "focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30 hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed",
          tamano === "sm" ? "rounded-[6px] px-2 py-1 text-xs" : "rounded-[8px] px-3 py-2 text-sm",
          abierto && "border-[#2563EB] ring-1 ring-[#2563EB]/30",
          className
        )}
      >
        <CalendarDays className={cn("flex-shrink-0 text-slate-400", tamano === "sm" ? "w-3.5 h-3.5" : "w-4 h-4")} />
        <span className={cn("flex-1 truncate", value ? "text-slate-700" : "text-slate-400")}>
          {value ? fmt(value) : placeholder}
        </span>
      </button>

      {abierto &&
        createPortal(
          <div
            ref={panel}
            role="dialog"
            aria-label="Elegir fecha"
            style={{ position: "fixed", top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: ANCHO, zIndex: 70 }}
            className="bg-white rounded-[12px] border border-slate-200 shadow-xl p-3 font-[inherit]"
          >
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={() => moverMes(-1)}
                className="p-1.5 rounded-[6px] text-slate-500 hover:bg-slate-100 transition-colors"
                aria-label="Mes anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-semibold text-[#1A3A5C] capitalize">
                {MESES[mes.m]} {mes.y}
              </span>
              <button
                type="button"
                onClick={() => moverMes(1)}
                className="p-1.5 rounded-[6px] text-slate-500 hover:bg-slate-100 transition-colors"
                aria-label="Mes siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-0.5 text-center">
              {DIAS.map((d, i) => (
                <span key={i} className="text-[10px] font-semibold text-slate-400 py-1">
                  {d}
                </span>
              ))}
              {semanas.map((c) => {
                const elegido = c.iso === value;
                const esHoy = c.iso === hoy;
                return (
                  <button
                    key={c.iso}
                    type="button"
                    onClick={() => elegir(c.iso)}
                    className={cn(
                      "h-8 rounded-[6px] text-xs tabular-nums transition-colors",
                      elegido
                        ? "bg-[#2563EB] text-white font-semibold"
                        : esHoy
                          ? "text-[#2563EB] font-semibold ring-1 ring-inset ring-[#2563EB]/40 hover:bg-[#EFF6FF]"
                          : c.delMes
                            ? "text-slate-700 hover:bg-[#F0F4F8]"
                            : "text-slate-300 hover:bg-slate-50"
                    )}
                  >
                    {c.dia}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => elegir(hoy)}
                className="text-xs font-semibold text-[#2563EB] hover:underline"
              >
                Hoy
              </button>
              {value && (
                <button
                  type="button"
                  onClick={() => elegir("")}
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-600 transition-colors"
                >
                  <X className="w-3 h-3" /> Borrar
                </button>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

