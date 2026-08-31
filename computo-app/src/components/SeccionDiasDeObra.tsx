"use client";

import { useState } from "react";
import { CalendarClock, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface Props {
  diasObra: number;
  rubrosConDatos: number;
  rubrosSinDatos: number;
}

function fmtDias(v: number): string {
  const redondeado = Math.round(v);
  return `${redondeado} día${redondeado !== 1 ? "s" : ""}`;
}

export default function SeccionDiasDeObra({ diasObra, rubrosConDatos, rubrosSinDatos }: Props) {
  const [expandido, setExpandido] = useState(false);

  return (
    <div className="mt-6 bg-white rounded-[16px] border border-slate-300 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpandido((p) => !p)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors text-left group"
      >
        <div className="flex items-center gap-2.5">
          <CalendarClock className="w-4 h-4 text-[#2563EB]" />
          <h2 className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">Días Estimados de Obra</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-slate-900 tabular-nums">{fmtDias(diasObra)}</span>
          <span className="text-slate-400 group-hover:text-slate-600 transition-colors">
            {expandido ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </span>
        </div>
      </button>

      {/* Aclaración siempre visible (no depende de expandir) — deja claro
          que el número asume una cuadrilla chica de referencia, no la
          dotación real que pueda tener la empresa. */}
      <div className="px-5 pb-3 -mt-1">
        <p className="text-xs text-slate-400">
          Basados en una plantilla de dos a tres personas trabajando en simultáneo.
        </p>
      </div>

      <AnimatePresence initial={false}>
        {expandido && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-slate-200"
          >
            <div className="px-5 py-5 space-y-3" style={{ background: "#F8FAFC" }}>
              <p className="text-sm text-slate-600 leading-relaxed">
                Estimado con una sola cuadrilla, sin tareas en paralelo — por cada rubro se toma la
                categoría de mano de obra que más tarda (la misma cuadrilla hace todo, así que esa es
                la que marca el ritmo), y el total suma esos días de todos los rubros.
              </p>
              {rubrosSinDatos > 0 && (
                <div className="flex items-start gap-2 rounded-[8px] bg-amber-50 border border-amber-200 px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    {rubrosSinDatos} rubro{rubrosSinDatos !== 1 ? "s" : ""} sin mano de obra desglosada
                    (precio cargado a mano, o sin Análisis de Precio Unitario) no está{rubrosSinDatos !== 1 ? "n" : ""} contado{rubrosSinDatos !== 1 ? "s" : ""} en esta estimación — de {rubrosConDatos + rubrosSinDatos} rubro{rubrosConDatos + rubrosSinDatos !== 1 ? "s" : ""} en total, {rubrosConDatos} aporta{rubrosConDatos !== 1 ? "n" : ""} días.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
