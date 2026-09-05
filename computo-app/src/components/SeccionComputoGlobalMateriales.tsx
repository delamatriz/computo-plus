"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, FileText, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { descargarExcelMateriales, type FilaMaterialGlobal } from "@/lib/materialesGlobales";

function fmtMon(v: number): string {
  return Math.round(v).toLocaleString("es-UY");
}

interface Props {
  proyectoId: string;
  proyectoNombre: string;
  filas: FilaMaterialGlobal[];
  total: number;
}

export default function SeccionComputoGlobalMateriales({ proyectoId, proyectoNombre, filas, total }: Props) {
  const [expandido, setExpandido] = useState(false);

  if (filas.length === 0) return null;

  return (
    <div className="mt-6 bg-white rounded-[16px] border border-slate-300 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
        <button
          onClick={() => setExpandido((p) => !p)}
          className="flex items-center gap-2.5 min-w-0 text-left group"
        >
          <span className="text-slate-400 group-hover:text-slate-600 transition-colors flex-shrink-0">
            {expandido ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </span>
          <h2 className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">
            Cómputo global de materiales
          </h2>
        </button>
        <div className="flex items-center gap-2">
          <a
            href={`/api/proyectos/${proyectoId}/lista-materiales-pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-[8px] border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <FileText className="w-3.5 h-3.5" /> PDF
          </a>
          <button
            onClick={() => descargarExcelMateriales(proyectoNombre, filas, total)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-[8px] border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Excel
          </button>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {expandido && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex items-center px-5 py-2 bg-slate-50 border-b border-slate-200">
              <div className="flex-1 pr-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Material</div>
              <div style={{ width: 56 }} className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-center">Unidad</div>
              <div style={{ width: 110 }} className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-right">Cantidad</div>
              <div style={{ width: 100 }} className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-right">P. unit.</div>
              <div style={{ width: 140 }} className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-right pr-4">Costo total</div>
            </div>
            {filas.map((f, idx) => {
              const costoTotal = f.precioUnit != null ? f.cantidadTotal * f.precioUnit : null;
              return (
                <div
                  key={`${f.descripcion}||${f.unidad}`}
                  className={cn("flex items-center px-5 border-b border-slate-100 last:border-0", idx % 2 === 1 ? "bg-[#F8FAFC]" : "bg-white")}
                  style={{ minHeight: 32 }}
                >
                  <div className="flex-1 pr-2 text-sm text-slate-700 font-medium truncate">{f.descripcion}</div>
                  <div style={{ width: 56 }} className="text-sm text-slate-500 text-center">{f.unidad}</div>
                  <div style={{ width: 110 }} className="text-sm tabular-nums text-slate-700 font-semibold text-right">{fmtMon(f.cantidadTotal)}</div>
                  <div style={{ width: 100 }} className="text-sm tabular-nums text-slate-500 text-right">{f.precioUnit != null ? fmtMon(f.precioUnit) : "—"}</div>
                  <div style={{ width: 140 }} className="text-sm font-bold tabular-nums text-[#2563EB] text-right pr-4">{costoTotal != null ? fmtMon(costoTotal) : "—"}</div>
                </div>
              );
            })}
            {/* Total materiales */}
            <div className="flex items-center px-5 py-3 border-t-2 border-slate-300 bg-white">
              <div className="flex-1 text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">Total materiales</div>
              <div style={{ width: 56 }} />
              <div style={{ width: 100 }} />
              <div style={{ width: 110 }} />
              <div style={{ width: 100 }} />
              <div style={{ width: 140 }} className="text-base font-bold tabular-nums text-[#1A3A5C] text-right pr-4">
                {total > 0 ? `$ ${fmtMon(total)}` : "—"}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
