"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Plus, X, ChevronDown, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtNum, subtotalFila, unidadesCoinciden, type MetrajeFila, type RubroOption } from "./metrajeFila";

// Planilla de cómputo — vive dentro del Visor (Página 2), arriba del
// documento principal (ver UI_UX_REDESIGN.md 2quinquies). El estado de
// las filas lo dueña la página /proyectos/[id]/visor (necesita `filas`
// también para exportar a Excel); este componente es presentacional.
// La Calculadora rápida se sacó de acá — quedó redundante con el botón
// flotante circular (CalculadoraFlotante, global en toda la app), que
// es ahora la única forma de acceder a ella desde esta página.
export default function PlanillaComputo({
  filas,
  rubrosDisponibles,
  totalGeneral,
  iaTexto,
  iaCargando,
  onActualizarFila,
  onAgregarFila,
  onEliminarFila,
  onIaTextoChange,
  onAgregarFilaIA,
  onExportarExcel,
}: {
  filas: MetrajeFila[];
  rubrosDisponibles: RubroOption[];
  totalGeneral: number;
  iaTexto: string;
  iaCargando: boolean;
  onActualizarFila: (id: string, field: keyof MetrajeFila, value: string) => void;
  onAgregarFila: () => void;
  onEliminarFila: (id: string) => void;
  onIaTextoChange: (value: string) => void;
  onAgregarFilaIA: () => void;
  onExportarExcel: () => void;
}) {
  const inputCls =
    "w-full text-sm text-slate-600 bg-transparent focus:outline-none focus:bg-white focus:rounded focus:ring-1 focus:ring-[#2563EB]/20 placeholder:text-slate-300";

  // Colapsable — arriba del Visor ya no hay tanta altura de sobra como
  // antes (columna al costado); con pantallas más bajas (ej. 1280x720)
  // Planilla+Visor no entran ambos cómodos sin colapsar uno de los dos.
  // Empieza expandida (el pedido de este cambio fue "que sea más
  // visible"), con la opción de colapsarla para recuperar alto para el
  // documento — ver nota en SeccionMetrajesPresupuesto.tsx.
  const [expandido, setExpandido] = useState(true);

  return (
    <div className="space-y-4">
      {/* ── Planilla de cómputo ───────────────────────────── */}
      <div className="bg-white rounded-[16px] border border-slate-300 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-200">
          <button
            onClick={() => setExpandido((v) => !v)}
            className="flex items-center gap-2 text-left group flex-1 min-w-0"
          >
            <span className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">
              Planilla de cómputo
            </span>
            <ChevronDown
              className={cn(
                "w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-transform flex-shrink-0",
                !expandido && "-rotate-90"
              )}
            />
          </button>
          <button
            onClick={onExportarExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-slate-300 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors flex-shrink-0"
          >
            <Download className="w-3.5 h-3.5" /> Exportar Excel
          </button>
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
                          {rubros.map((r) => {
                            // Si la fila ya tiene una unidad propia (cargada a
                            // mano o heredada de una medición — ver
                            // guardarMedicion en page.tsx), no se puede vincular
                            // a un rubro de unidad distinta (m² vs m³, etc).
                            const incompatible = !!fila.unidad && !unidadesCoinciden(fila.unidad, r.unidad);
                            return (
                              <option
                                key={r.id}
                                value={r.id}
                                disabled={incompatible}
                                title={incompatible ? `Unidad distinta: fila en ${fila.unidad}, rubro en ${r.unidad}` : undefined}
                              >
                                {r.nombre} ({r.unidad}){incompatible ? " — unidad distinta" : ""}
                              </option>
                            );
                          })}
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
