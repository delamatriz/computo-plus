"use client";

import { useState } from "react";
import { ClipboardList, ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export interface GastoGeneralItem {
  id: string;
  descripcion: string;
  monto: number;
}

interface CapituloResumen {
  id: string;
  nombre: string;
  codigo?: string;
  subtotal: number;
}

interface Props {
  moneda: string;
  capitulos: CapituloResumen[];
  subtotalObra: number;
  montoImponibleMO: number | null;
  incluyeIVA: boolean;
  timbresCJP: number;
  gastosGeneralesItems: GastoGeneralItem[];
  onChangeIncluyeIVA: (v: boolean) => void;
  onChangeTimbresCJP: (v: number) => void;
  onChangeGastosGeneralesItems: (items: GastoGeneralItem[]) => void;
}

function fmtMoneda(v: number, moneda: string): string {
  if (!v) return "—";
  const fmt = Math.round(v).toLocaleString("es-UY");
  return moneda === "USD" ? `U$S ${fmt}` : `$ ${fmt}`;
}

const AUC_PCT = 0.714;
const IVA_PCT = 0.22;

export default function SeccionResumenPresupuesto({
  moneda,
  capitulos,
  subtotalObra,
  montoImponibleMO,
  incluyeIVA,
  timbresCJP,
  gastosGeneralesItems,
  onChangeIncluyeIVA,
  onChangeTimbresCJP,
  onChangeGastosGeneralesItems,
}: Props) {
  const [expandido, setExpandido] = useState(false);

  const capitulosConTotal = capitulos.filter((c) => c.subtotal > 0);

  const montoAUC = montoImponibleMO != null ? montoImponibleMO * AUC_PCT : null;
  const sumaItemsExtras = gastosGeneralesItems.reduce((s, item) => s + (item.monto || 0), 0);
  const subtotalGastosGenerales = (montoAUC ?? 0) + timbresCJP + sumaItemsExtras;

  const baseIVA = subtotalObra + subtotalGastosGenerales;
  const montoIVA = incluyeIVA ? baseIVA * IVA_PCT : 0;
  const totalFinal = baseIVA + montoIVA;

  const agregarItem = () => {
    onChangeGastosGeneralesItems([
      ...gastosGeneralesItems,
      { id: `gg-${Date.now()}`, descripcion: "", monto: 0 },
    ]);
  };

  const actualizarItem = (id: string, campo: "descripcion" | "monto", valor: string) => {
    onChangeGastosGeneralesItems(
      gastosGeneralesItems.map((item) =>
        item.id !== id ? item : { ...item, [campo]: campo === "monto" ? parseFloat(valor) || 0 : valor }
      )
    );
  };

  const eliminarItem = (id: string) => {
    onChangeGastosGeneralesItems(gastosGeneralesItems.filter((item) => item.id !== id));
  };

  const inputCls = "px-2 py-1 text-sm text-slate-700 bg-white border border-slate-200 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]";

  return (
    <div className="mt-6 bg-white rounded-[16px] border border-slate-300 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpandido((p) => !p)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors text-left group"
      >
        <div className="flex items-center gap-2.5">
          <ClipboardList className="w-4 h-4 text-[#2563EB]" />
          <h2 className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">Resumen del Presupuesto</h2>
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

              {/* A) Capítulos con subtotal */}
              <div className="rounded-[10px] border border-slate-200 bg-white overflow-hidden">
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
                  <span className="text-xs font-bold text-[#1A3A5C] uppercase tracking-wide">Capítulos</span>
                </div>
                {capitulosConTotal.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-slate-400 italic">Sin capítulos con totales todavía</div>
                ) : (
                  capitulosConTotal.map((cap) => (
                    <div
                      key={cap.id}
                      className="flex items-center px-4 py-1.5 border-b border-slate-50 last:border-0"
                    >
                      <div className="flex-1 min-w-0 text-sm text-slate-700 truncate">
                        {cap.codigo ? `${cap.codigo} — ${cap.nombre}` : cap.nombre}
                      </div>
                      <div className="text-sm font-semibold tabular-nums text-[#2563EB] pl-3">
                        {fmtMoneda(cap.subtotal, moneda)}
                      </div>
                    </div>
                  ))
                )}
                {/* B) SUBTOTAL OBRA */}
                <div className="flex items-center px-4 py-2 bg-slate-50 border-t border-slate-200">
                  <div className="flex-1 min-w-0 text-xs font-bold text-[#1A3A5C] uppercase tracking-wide">
                    Subtotal obra
                  </div>
                  <div className="text-base font-bold tabular-nums text-[#1A3A5C] pl-3">
                    {fmtMoneda(subtotalObra, moneda)}
                  </div>
                </div>
              </div>

              {/* C) Gastos Generales */}
              <div className="rounded-[10px] border border-slate-200 bg-white overflow-hidden">
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
                  <span className="text-xs font-bold text-[#1A3A5C] uppercase tracking-wide">Gastos generales</span>
                </div>

                <div className="flex items-center px-4 py-1.5 border-b border-slate-50">
                  <div className="flex-1 min-w-0 text-sm text-slate-700">AUC propietario (71,4%)</div>
                  <div className="text-sm font-semibold tabular-nums text-slate-600 pl-3">
                    {montoAUC != null ? fmtMoneda(montoAUC, moneda) : (
                      <span className="text-xs text-amber-600 italic">Calculá Leyes Sociales primero</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center px-4 py-1.5 border-b border-slate-50">
                  <div className="flex-1 min-w-0 text-sm text-slate-700">Timbres CJP</div>
                  <input
                    type="number"
                    value={timbresCJP === 0 ? "" : timbresCJP}
                    onChange={(e) => onChangeTimbresCJP(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className={cn(inputCls, "w-28 text-right tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none")}
                  />
                </div>

                {gastosGeneralesItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 px-4 py-1.5 border-b border-slate-50">
                    <input
                      type="text"
                      value={item.descripcion}
                      onChange={(e) => actualizarItem(item.id, "descripcion", e.target.value)}
                      placeholder="Descripción del ítem"
                      className={cn(inputCls, "flex-1 min-w-0")}
                    />
                    <input
                      type="number"
                      value={item.monto === 0 ? "" : item.monto}
                      onChange={(e) => actualizarItem(item.id, "monto", e.target.value)}
                      placeholder="0"
                      className={cn(inputCls, "w-28 text-right tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none")}
                    />
                    <button
                      onClick={() => eliminarItem(item.id)}
                      className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0"
                      aria-label="Quitar ítem"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                <div className="px-4 py-2 border-b border-slate-50">
                  <button
                    onClick={agregarItem}
                    className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-[#2563EB] transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar ítem
                  </button>
                </div>

                <div className="flex items-center px-4 py-2 bg-slate-50">
                  <div className="flex-1 min-w-0 text-xs font-bold text-[#1A3A5C] uppercase tracking-wide">
                    Subtotal gastos generales
                  </div>
                  <div className="text-base font-bold tabular-nums text-[#1A3A5C] pl-3">
                    {fmtMoneda(subtotalGastosGenerales, moneda)}
                  </div>
                </div>
              </div>

              {/* D) IVA */}
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={incluyeIVA}
                  onChange={(e) => onChangeIncluyeIVA(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]/30"
                />
                <span className="text-sm text-slate-700">Incluir IVA (22%)</span>
              </label>

              {/* E) Total final */}
              <div className="border-t border-slate-300 pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-[#1A3A5C] uppercase tracking-wide">Total presupuesto</span>
                  <span className="text-2xl font-bold tabular-nums text-[#2563EB]">{fmtMoneda(baseIVA, moneda)}</span>
                </div>

                {incluyeIVA && (
                  <>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-sm text-slate-600">IVA (22%)</span>
                      <span className="text-sm font-semibold tabular-nums text-slate-600">
                        {fmtMoneda(montoIVA, moneda)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t-2 border-slate-300">
                      <span className="text-base font-bold text-[#1A3A5C] uppercase tracking-wide">Total con IVA</span>
                      <span className="text-2xl font-bold tabular-nums text-[#2563EB]">{fmtMoneda(totalFinal, moneda)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
