"use client";

import { useState, type ReactNode } from "react";
import { HardHat, ChevronDown, ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { JornalesCategoria } from "@/lib/jornalesPorCategoria";

// Tarjeta de solo lectura: total de materiales, total de mano de obra y
// jornales por categoría — todo calculado en page.tsx sobre capitulos +
// apuData ya en memoria (computarMaterialesGlobales,
// computarCostoManoObraTotal, calcularJornalesPorCategoria).

interface Props {
  moneda: string;
  totalMateriales: number;
  totalManoObra: number;
  jornalesPorCategoria: JornalesCategoria[];
}

function fmtMoneda(v: number, moneda: string): string {
  if (v === 0) return "—";
  const fmt = Math.round(v).toLocaleString("es-UY");
  return moneda === "USD" ? `U$S ${fmt}` : `$ ${fmt}`;
}

function fmtJornales(v: number): string {
  return v.toLocaleString("es-UY", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function Fila({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <span className="text-sm text-slate-500 min-w-0">{label}</span>
      <span className="text-sm font-bold text-[#1A3A5C] tabular-nums whitespace-nowrap">{valor}</span>
    </div>
  );
}

// Fila de jornales: categoría a la izquierda; jornales y costo estimado a
// la derecha, en columnas de ancho fijo para que queden alineados entre
// filas.
function FilaJornales({ c, moneda }: { c: JornalesCategoria; moneda: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-sm text-slate-500 min-w-0">{c.categoria}</span>
      <div className="flex items-baseline gap-3 flex-shrink-0">
        <span className="text-sm text-slate-500 tabular-nums whitespace-nowrap text-right w-[6.5rem]">
          {fmtJornales(c.jornales)} jornales
        </span>
        <span className="text-sm font-bold text-[#1A3A5C] tabular-nums whitespace-nowrap text-right w-[6.5rem]">
          {fmtMoneda(c.costo, moneda)}
        </span>
      </div>
    </div>
  );
}

function Titulo({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{children}</p>;
}

export default function SeccionMaterialesManoObra({ moneda, totalMateriales, totalManoObra, jornalesPorCategoria }: Props) {
  const [expandido, setExpandido] = useState(false);

  return (
    <div className="mt-6 bg-white rounded-[16px] border border-slate-300 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpandido((p) => !p)}
        aria-expanded={expandido}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors text-left group"
      >
        <div className="flex items-center gap-2.5">
          <HardHat className="w-4 h-4 text-[#2563EB]" />
          <h2 className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">Materiales y Mano de Obra</h2>
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
            <div className="px-5 py-5 space-y-5" style={{ background: "#F8FAFC" }}>
              <div>
                <Titulo>Materiales</Titulo>
                <Fila label="Total materiales" valor={fmtMoneda(totalMateriales, moneda)} />
              </div>

              <div>
                <Titulo>Mano de obra</Titulo>
                <Fila label="Total mano de obra" valor={fmtMoneda(totalManoObra, moneda)} />
              </div>

              <div>
                <Titulo>Jornales por categoría</Titulo>
                {jornalesPorCategoria.length === 0 ? (
                  <Fila label="Sin mano de obra desglosada" valor="—" />
                ) : (
                  <div className="divide-y divide-slate-100">
                    {jornalesPorCategoria.map((c) => (
                      <FilaJornales key={c.categoria} c={c} moneda={moneda} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
