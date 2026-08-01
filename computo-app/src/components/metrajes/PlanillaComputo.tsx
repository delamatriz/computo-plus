"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Plus, X, ChevronDown, Sparkles, Calculator, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtNum, subtotalFila, type MetrajeFila, type RubroOption } from "./metrajeFila";

// Planilla de cómputo + Calculadora rápida — vive dentro del Visor
// (Página 2), al costado del documento principal, en la misma columna
// redimensionable (ver UI_UX_REDESIGN.md 2quinquies). El estado de las
// filas lo dueña SeccionMetrajesPresupuesto (necesita `filas` también
// para exportar a Excel); este componente es presentacional.
export default function PlanillaComputo({
  filas,
  rubrosDisponibles,
  totalGeneral,
  iaTexto,
  iaCargando,
  mostrarCalculadora,
  onActualizarFila,
  onAgregarFila,
  onEliminarFila,
  onIaTextoChange,
  onAgregarFilaIA,
  onToggleCalculadora,
  onExportarExcel,
}: {
  filas: MetrajeFila[];
  rubrosDisponibles: RubroOption[];
  totalGeneral: number;
  iaTexto: string;
  iaCargando: boolean;
  mostrarCalculadora: boolean;
  onActualizarFila: (id: string, field: keyof MetrajeFila, value: string) => void;
  onAgregarFila: () => void;
  onEliminarFila: (id: string) => void;
  onIaTextoChange: (value: string) => void;
  onAgregarFilaIA: () => void;
  onToggleCalculadora: () => void;
  onExportarExcel: () => void;
}) {
  const inputCls =
    "w-full text-sm text-slate-600 bg-transparent focus:outline-none focus:bg-white focus:rounded focus:ring-1 focus:ring-[#2563EB]/20 placeholder:text-slate-300";

  return (
    <div className="space-y-4">
      {/* ── Planilla de cómputo ───────────────────────────── */}
      <div className="bg-white rounded-[16px] border border-slate-300 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
          <span className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">
            Planilla de cómputo
          </span>
          <button
            onClick={onExportarExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-slate-300 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Exportar Excel
          </button>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[860px]">
            {/* Cabecera */}
            <div className="flex items-center bg-slate-50 border-b border-slate-200" style={{ height: 32 }}>
              <div className="flex-1 px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Descripción</div>
              <div style={{ width: 88, flexShrink: 0 }} className="px-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-right">Largo</div>
              <div style={{ width: 88, flexShrink: 0 }} className="px-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-right">Ancho</div>
              <div style={{ width: 88, flexShrink: 0 }} className="px-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-right">Alto</div>
              <div style={{ width: 80, flexShrink: 0 }} className="px-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-right">Cant.</div>
              <div style={{ width: 110, flexShrink: 0 }} className="px-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-right">Subtotal</div>
              <div style={{ width: 220, flexShrink: 0 }} className="px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Rubro vinculado</div>
              <div style={{ width: 36, flexShrink: 0 }} />
            </div>

            {/* Filas */}
            {filas.map((fila, idx) => {
              const subtotal = subtotalFila(fila);
              return (
                <div
                  key={fila.id}
                  className={cn(
                    "flex items-center hover:bg-blue-50/20 transition-colors",
                    idx % 2 === 1 ? "bg-[#F8FAFC]" : "bg-white"
                  )}
                  style={{ height: 36, borderBottom: "1px solid #F1F5F9" }}
                >
                  <div className="flex-1 px-3">
                    <input
                      type="text"
                      value={fila.descripcion}
                      onChange={(e) => onActualizarFila(fila.id, "descripcion", e.target.value)}
                      placeholder="Descripción del elemento"
                      className={inputCls}
                    />
                  </div>
                  <div style={{ width: 88, flexShrink: 0 }} className="px-2">
                    <input
                      type="number"
                      value={fila.largo ?? ""}
                      onChange={(e) => onActualizarFila(fila.id, "largo", e.target.value)}
                      placeholder="—"
                      className={cn(inputCls, "text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none")}
                    />
                  </div>
                  <div style={{ width: 88, flexShrink: 0 }} className="px-2">
                    <input
                      type="number"
                      value={fila.ancho ?? ""}
                      onChange={(e) => onActualizarFila(fila.id, "ancho", e.target.value)}
                      placeholder="—"
                      className={cn(inputCls, "text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none")}
                    />
                  </div>
                  <div style={{ width: 88, flexShrink: 0 }} className="px-2">
                    <input
                      type="number"
                      value={fila.alto ?? ""}
                      onChange={(e) => onActualizarFila(fila.id, "alto", e.target.value)}
                      placeholder="—"
                      className={cn(inputCls, "text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none")}
                    />
                  </div>
                  <div style={{ width: 80, flexShrink: 0 }} className="px-2">
                    <input
                      type="number"
                      value={fila.cantidad ?? ""}
                      onChange={(e) => onActualizarFila(fila.id, "cantidad", e.target.value)}
                      placeholder="—"
                      className={cn(inputCls, "text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none")}
                    />
                  </div>
                  <div style={{ width: 110, flexShrink: 0 }} className="px-2 text-right">
                    <span className={cn("text-sm font-semibold tabular-nums", subtotal > 0 ? "text-[#2563EB]" : "text-slate-300")}>
                      {subtotal > 0 ? fmtNum(subtotal) : "—"}
                    </span>
                  </div>
                  <div style={{ width: 220, flexShrink: 0 }} className="px-3">
                    <select
                      value={fila.rubroId ?? ""}
                      onChange={(e) => onActualizarFila(fila.id, "rubroId", e.target.value)}
                      className={cn(inputCls, "cursor-pointer", !fila.rubroId && "text-slate-400")}
                    >
                      <option value="">Sin vincular</option>
                      {Object.entries(
                        rubrosDisponibles.reduce<Record<string, RubroOption[]>>((acc, r) => {
                          (acc[r.capituloNombre] ??= []).push(r);
                          return acc;
                        }, {})
                      ).map(([capNombre, rubros]) => (
                        <optgroup key={capNombre} label={capNombre}>
                          {rubros.map((r) => (
                            <option key={r.id} value={r.id}>{r.nombre}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div style={{ width: 36, flexShrink: 0 }} className="flex items-center justify-center">
                    <button
                      onClick={() => onEliminarFila(fila.id)}
                      className="text-slate-300 hover:text-red-500 transition-colors"
                      aria-label="Eliminar fila"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Agregar fila */}
            <div className="flex items-center pl-3" style={{ height: 32, borderTop: "1px solid #F1F5F9" }}>
              <button
                onClick={onAgregarFila}
                className="flex items-center gap-1.5 text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
              >
                <Plus className="w-3 h-3" /> Agregar fila
              </button>
            </div>

            {/* Fila IA */}
            <div className="flex items-center gap-2 px-3 py-2.5 border-t border-slate-100 bg-[#F0F7FF]">
              <Sparkles className="w-4 h-4 text-[#2563EB] flex-shrink-0" />
              <input
                type="text"
                value={iaTexto}
                onChange={(e) => onIaTextoChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onAgregarFilaIA()}
                placeholder="Describí el elemento (ej: tabique de durlock 2.40m x 3.10m, 4 unidades) y la IA completa la fila"
                className="flex-1 min-w-0 text-sm text-slate-700 bg-white border border-blue-200 rounded-[8px] px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] placeholder:text-slate-400"
              />
              <button
                onClick={onAgregarFilaIA}
                disabled={!iaTexto.trim() || iaCargando}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-sm font-semibold transition-colors flex-shrink-0",
                  !iaTexto.trim() || iaCargando
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
                )}
              >
                {iaCargando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Generar fila
              </button>
            </div>

            {/* Total general */}
            <div className="flex items-center border-t-2 border-slate-300 bg-white" style={{ height: 40 }}>
              <div className="flex-1 px-3 text-sm font-bold text-slate-400 uppercase tracking-wide">Total general</div>
              <div style={{ width: 88 }} />
              <div style={{ width: 88 }} />
              <div style={{ width: 88 }} />
              <div style={{ width: 80 }} />
              <div style={{ width: 110, flexShrink: 0 }} className="px-2 text-right">
                <span className="text-base font-bold tabular-nums" style={{ color: "#1A3A5C" }}>
                  {fmtNum(totalGeneral)}
                </span>
              </div>
              <div style={{ width: 220 }} />
              <div style={{ width: 36 }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Calculadora rápida ────────────────────────────── */}
      <div className="space-y-2.5">
        <button
          type="button"
          onClick={onToggleCalculadora}
          className="relative flex items-center justify-center gap-2 w-full py-3 rounded-[12px] border border-slate-300 text-slate-500 hover:text-slate-700 hover:border-slate-400 font-medium text-sm transition-colors bg-white"
        >
          <Calculator className="w-4 h-4" />
          Calculadora rápida
          <ChevronDown
            className={cn("w-4 h-4 absolute right-4 transition-transform", mostrarCalculadora && "rotate-180")}
          />
        </button>
        <AnimatePresence initial={false}>
          {mostrarCalculadora && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="rounded-[12px] border border-slate-300 bg-white p-3 max-w-xs">
                <CalculadoraInline />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ─── Calculadora rápida inline ──────────────────────────── */
function CalculadoraInline() {
  const [display, setDisplay] = useState("0");
  const [operacion, setOperacion] = useState("");
  const [valorPrevio, setValorPrevio] = useState("");
  const [esperandoOperando, setEsperandoOperando] = useState(false);

  const presionarNumero = (num: string) => {
    if (esperandoOperando) {
      setDisplay(num);
      setEsperandoOperando(false);
    } else {
      setDisplay(display === "0" ? num : display + num);
    }
  };

  const presionarOperacion = (op: string) => {
    setValorPrevio(display);
    setOperacion(op);
    setEsperandoOperando(true);
  };

  const calcular = () => {
    const prev = parseFloat(valorPrevio);
    const curr = parseFloat(display);
    let resultado = 0;
    if (operacion === "+") resultado = prev + curr;
    if (operacion === "-") resultado = prev - curr;
    if (operacion === "×") resultado = prev * curr;
    if (operacion === "÷") resultado = curr !== 0 ? prev / curr : 0;
    setDisplay(resultado % 1 === 0 ? resultado.toString() : resultado.toFixed(2));
    setOperacion("");
    setEsperandoOperando(true);
  };

  const limpiar = () => {
    setDisplay("0");
    setOperacion("");
    setValorPrevio("");
    setEsperandoOperando(false);
  };

  const btnCls = "h-9 rounded-lg text-sm font-medium transition-colors";

  return (
    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
      <div className="bg-white rounded-lg px-3 py-2 text-right text-lg font-mono font-semibold text-[#1A3A5C] mb-2 border border-slate-200 min-h-[40px]">
        {parseFloat(display).toLocaleString("es-UY")}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        <button onClick={limpiar} className={`${btnCls} col-span-2 bg-red-50 text-red-600 hover:bg-red-100`}>C</button>
        <button onClick={() => presionarOperacion("÷")} className={`${btnCls} bg-blue-50 text-[#2563EB] hover:bg-blue-100`}>÷</button>
        <button onClick={() => presionarOperacion("×")} className={`${btnCls} bg-blue-50 text-[#2563EB] hover:bg-blue-100`}>×</button>

        {["7", "8", "9"].map((n) => (
          <button key={n} onClick={() => presionarNumero(n)} className={`${btnCls} bg-white border border-slate-200 text-[#1E293B] hover:bg-slate-100`}>{n}</button>
        ))}
        <button onClick={() => presionarOperacion("-")} className={`${btnCls} bg-blue-50 text-[#2563EB] hover:bg-blue-100`}>−</button>

        {["4", "5", "6"].map((n) => (
          <button key={n} onClick={() => presionarNumero(n)} className={`${btnCls} bg-white border border-slate-200 text-[#1E293B] hover:bg-slate-100`}>{n}</button>
        ))}
        <button onClick={() => presionarOperacion("+")} className={`${btnCls} bg-blue-50 text-[#2563EB] hover:bg-blue-100`}>+</button>

        {["1", "2", "3"].map((n) => (
          <button key={n} onClick={() => presionarNumero(n)} className={`${btnCls} bg-white border border-slate-200 text-[#1E293B] hover:bg-slate-100`}>{n}</button>
        ))}
        <button onClick={calcular} className={`${btnCls} row-span-2 bg-[#2563EB] text-white hover:bg-blue-700`}>=</button>

        <button onClick={() => presionarNumero("0")} className={`${btnCls} col-span-2 bg-white border border-slate-200 text-[#1E293B] hover:bg-slate-100`}>0</button>
        <button onClick={() => presionarNumero(".")} className={`${btnCls} bg-white border border-slate-200 text-[#1E293B] hover:bg-slate-100`}>.</button>
      </div>
    </div>
  );
}
