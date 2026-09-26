"use client";

import { useState } from "react";
import { Sparkles, ChevronDown, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  texto: string;
  /** true = tarjeta siempre visible (proyecto todavía ANTEPROYECTO — es
   * el contenido principal en ese momento). false = tarjeta colapsable,
   * mismo patrón visual que SeccionNotas (una vez convertido a proyecto
   * completo, no debe competir con la tabla de capítulos/rubros). */
  destacada?: boolean;
}

// Texto plano (no JSON/markdown) guardado en Proyecto.resumenCalculoRapido
// por "Guardar como anteproyecto" en Cálculo Rápido (ver calcular/page.tsx)
// — se renderiza tal cual, respetando los saltos de línea ya armados ahí,
// sin parsear línea por línea (el formato exacto puede seguir cambiando
// del lado de Cálculo Rápido sin que esto se rompa).
export default function SeccionEstimacionCalculoRapido({ texto, destacada = false }: Props) {
  const [expandido, setExpandido] = useState(false);

  if (destacada) {
    return (
      <div className="mb-6 rounded-[14px] border border-violet-200 bg-white px-5 py-4">
        <div className="flex items-center gap-2 mb-2.5">
          <Sparkles className="w-4 h-4 text-violet-600" />
          <h2 className="text-sm font-bold text-violet-800 uppercase tracking-wide">
            Estimación de Cálculo Rápido
          </h2>
        </div>
        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{texto}</p>
      </div>
    );
  }

  return (
    <div className="mt-6 bg-white rounded-[16px] border border-slate-300 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpandido((p) => !p)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors text-left group"
      >
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-4 h-4 text-[#2563EB]" />
          <h2 className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">
            Estimación original de Cálculo Rápido
          </h2>
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
            <div className="px-5 py-5" style={{ background: "#F8FAFC" }}>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{texto}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
