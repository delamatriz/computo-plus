"use client";

import { useState } from "react";
import { StickyNote, ChevronDown, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  proyectoId: string;
  notasInicial: string | null;
}

export default function SeccionNotas({ proyectoId, notasInicial }: Props) {
  const [expandido, setExpandido] = useState(false);
  const [texto, setTexto] = useState(notasInicial ?? "");
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(valor: string) {
    if (valor === notasInicial) return;
    setGuardando(true);
    setGuardado(false);
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/notas-presupuesto`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: valor }),
      });
      if (!res.ok) throw new Error();
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2000);
    } catch {
      setError("No se pudo guardar la edición.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="mt-6 bg-white rounded-[16px] border border-slate-300 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpandido((p) => !p)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors text-left group"
      >
        <div className="flex items-center gap-2.5">
          <StickyNote className="w-4 h-4 text-[#2563EB]" />
          <h2 className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">Notas</h2>
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
              {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

              <p className="text-xs text-slate-500 mb-3">
                {guardando ? "Guardando..." : guardado ? "Guardado ✓" : "Editable — los cambios se guardan al salir del campo."}
              </p>

              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onBlur={(e) => guardar(e.target.value)}
                rows={10}
                placeholder="Notas varias sobre este presupuesto..."
                className="w-full rounded-[12px] border border-slate-200 bg-white p-4 text-sm text-slate-700 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 resize-y"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
