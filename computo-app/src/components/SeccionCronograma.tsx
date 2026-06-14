"use client";

import { useEffect, useState } from "react";
import { CalendarDays, ChevronDown, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

/* ─── Tipos ───────────────────────────────────────────────── */
interface CapituloCronograma {
  id: string;
  nombre: string;
  codigo?: string;
  fechaInicio?: string | null;
  fechaFin?: string | null;
}

interface Props {
  capitulos: CapituloCronograma[];
}

/* ─── Helpers ─────────────────────────────────────────────── */
function toInputDate(v?: string | null): string {
  if (!v) return "";
  return v.slice(0, 10);
}

function duracionDias(inicio: string, fin: string): number | null {
  if (!inicio || !fin) return null;
  const a = new Date(inicio);
  const b = new Date(fin);
  const dias = Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return dias >= 0 ? dias : null;
}

function fmtFecha(v: string): string {
  if (!v) return "—";
  const [y, m, d] = v.split("-");
  return `${d}/${m}/${y}`;
}

/* ─── Componente principal ────────────────────────────────── */
export default function SeccionCronograma({ capitulos }: Props) {
  const [expandido, setExpandido] = useState(false);
  const [fechas, setFechas] = useState<Record<string, { inicio: string; fin: string }>>({});
  const [errores, setErrores] = useState<Record<string, string>>({});

  // Incorpora capítulos nuevos (o recién cargados) sin pisar ediciones en curso
  useEffect(() => {
    setFechas((prev) => {
      const next = { ...prev };
      for (const cap of capitulos) {
        if (!(cap.id in next)) {
          next[cap.id] = { inicio: toInputDate(cap.fechaInicio), fin: toInputDate(cap.fechaFin) };
        }
      }
      return next;
    });
  }, [capitulos]);

  const actualizar = (capId: string, campo: "inicio" | "fin", valor: string) => {
    setFechas((prev) => ({ ...prev, [capId]: { ...prev[capId], [campo]: valor } }));
  };

  const guardar = async (capId: string) => {
    const { inicio, fin } = fechas[capId] ?? { inicio: "", fin: "" };

    if (inicio && fin && fin < inicio) {
      setErrores((prev) => ({ ...prev, [capId]: "La fecha de fin no puede ser anterior a la de inicio" }));
      return;
    }
    setErrores((prev) => {
      const next = { ...prev };
      delete next[capId];
      return next;
    });

    try {
      await fetch(`/api/capitulos/${capId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fechaInicio: inicio || null,
          fechaFin: fin || null,
        }),
      });
    } catch (err) {
      console.error("[cronograma] error guardando fechas", err);
    }
  };

  /* ── Resumen general — fecha más temprana / más tardía ────── */
  const fechasInicio = Object.values(fechas).map((f) => f.inicio).filter(Boolean);
  const fechasFin = Object.values(fechas).map((f) => f.fin).filter(Boolean);
  const inicioObra = fechasInicio.length > 0 ? fechasInicio.reduce((a, b) => (a < b ? a : b)) : "";
  const finObra = fechasFin.length > 0 ? fechasFin.reduce((a, b) => (a > b ? a : b)) : "";
  const duracionTotal = duracionDias(inicioObra, finObra);

  const thCls = "text-[10px] font-semibold text-slate-400 uppercase tracking-wider";

  return (
    <div className="mt-6 bg-white rounded-[16px] border border-slate-300 shadow-sm overflow-hidden">
      {/* Header colapsable */}
      <button
        onClick={() => setExpandido((p) => !p)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors text-left group"
      >
        <div className="flex items-center gap-2.5">
          <CalendarDays className="w-4 h-4 text-[#2563EB]" />
          <h2 className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">Cronograma</h2>
        </div>
        <span className="text-slate-400 group-hover:text-slate-600 transition-colors">
          {expandido ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expandido && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-slate-200"
          >
            {capitulos.length === 0 ? (
              <p className="text-xs text-slate-400 italic px-5 py-5">
                Todavía no hay capítulos cargados en este proyecto.
              </p>
            ) : (
              <>
                {/* Encabezado de columnas */}
                <div className="flex items-center px-5 py-2 bg-slate-50 border-b border-slate-200">
                  <div className={cn(thCls, "flex-1 pr-2")}>Capítulo</div>
                  <div className={cn(thCls, "text-center")} style={{ width: 150 }}>Fecha inicio</div>
                  <div className={cn(thCls, "text-center")} style={{ width: 150 }}>Fecha fin</div>
                  <div className={cn(thCls, "text-right pr-1")} style={{ width: 110 }}>Duración</div>
                </div>

                {/* Filas */}
                {capitulos.map((cap, idx) => {
                  const f = fechas[cap.id] ?? { inicio: "", fin: "" };
                  const duracion = duracionDias(f.inicio, f.fin);
                  const error = errores[cap.id];
                  return (
                    <div
                      key={cap.id}
                      className={cn("border-b border-slate-100 last:border-0", idx % 2 === 1 ? "bg-[#F8FAFC]" : "bg-white")}
                    >
                      <div className="flex items-center px-5" style={{ minHeight: 44 }}>
                        <div className="flex-1 pr-2 text-sm text-slate-700 font-medium truncate">
                          {cap.codigo ? `${cap.codigo} · ` : ""}{cap.nombre}
                        </div>
                        <div style={{ width: 150 }} className="px-1">
                          <input
                            type="date"
                            value={f.inicio}
                            onChange={(e) => actualizar(cap.id, "inicio", e.target.value)}
                            onBlur={() => guardar(cap.id)}
                            className="w-full rounded-[8px] border border-slate-200 px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
                          />
                        </div>
                        <div style={{ width: 150 }} className="px-1">
                          <input
                            type="date"
                            value={f.fin}
                            onChange={(e) => actualizar(cap.id, "fin", e.target.value)}
                            onBlur={() => guardar(cap.id)}
                            className="w-full rounded-[8px] border border-slate-200 px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
                          />
                        </div>
                        <div style={{ width: 110 }} className="text-sm tabular-nums text-slate-600 text-right pr-1">
                          {duracion != null ? `${duracion} día${duracion === 1 ? "" : "s"}` : "—"}
                        </div>
                      </div>
                      {error && (
                        <div className="px-5 pb-2 -mt-1 text-xs text-red-500">{error}</div>
                      )}
                    </div>
                  );
                })}

                {/* Footer — resumen general */}
                <div className="flex items-center px-5 py-3 border-t-2 border-slate-300 bg-white gap-4">
                  <div className="flex-1 text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">
                    Duración total estimada de la obra
                  </div>
                  <div className="text-sm text-slate-500">
                    {inicioObra ? fmtFecha(inicioObra) : "—"} — {finObra ? fmtFecha(finObra) : "—"}
                  </div>
                  <div className="text-base font-bold tabular-nums text-[#1A3A5C] text-right" style={{ minWidth: 110 }}>
                    {duracionTotal != null ? `${duracionTotal} días` : "—"}
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
