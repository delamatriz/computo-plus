"use client";

import { useState } from "react";
import { Landmark, ChevronDown, ChevronRight, Info, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { RESERVA_COLA_TABLA } from "@/lib/layoutTablaPresupuesto";
import { COEFICIENTE_BPS_OBRA_PUBLICA_DEFAULT } from "@/lib/auc";

// Leyes Sociales de obra pública (Proyecto.tipoContratacion === "PUBLICA") —
// módulo alternativo a SeccionLeyesSociales (AUC de obra privada), que no se
// toca. En obra pública el organismo contratante paga los aportes al BPS
// directamente: no hay AUC del propietario ni fondos de empresa que mostrar,
// solo Leyes sociales = monto imponible × coeficiente BPS.
//
// El monto imponible son los jornales reales que declara el contratista
// (LeyesSociales.montoImponibleMO, el mismo campo que usa obra privada). El
// coeficiente arranca en COEFICIENTE_BPS_OBRA_PUBLICA_DEFAULT (ver auc.ts,
// fuente y fecha) y es editable.

interface Props {
  moneda: string;
  montoImponible: number;
  onMontoImponibleChange: (v: number) => void;
  coeficiente: number; // fracción 0–1 (0.718 = 71,8%)
  onCoeficienteChange: (v: number) => void;
  onGuardar: () => Promise<void>;
  guardando: boolean;
  // Jornal SUNCA de Medio Oficial — mismo uso que en SeccionLeyesSociales:
  // expresar el monto imponible en cantidad de jornales.
  jornalMedioOficial?: number;
}

function fmtMoneda(v: number, moneda: string): string {
  if (!v) return "—";
  const fmt = Math.round(v).toLocaleString("es-UY");
  return moneda === "USD" ? `U$S ${fmt}` : `$ ${fmt}`;
}

function fmtPct(v: number): string {
  return (v * 100).toLocaleString("es-UY", { minimumFractionDigits: 1, maximumFractionDigits: 4 });
}

const sinFlechas = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

export default function SeccionLeyesSocialesPublica({
  moneda,
  montoImponible,
  onMontoImponibleChange,
  coeficiente,
  onCoeficienteChange,
  onGuardar,
  guardando,
  jornalMedioOficial,
}: Props) {
  const [expandido, setExpandido] = useState(false);
  const [editandoMonto, setEditandoMonto] = useState(false);

  const montoLeyes = montoImponible * coeficiente;
  const jornales =
    jornalMedioOficial != null && jornalMedioOficial > 0 ? montoImponible / jornalMedioOficial : null;
  const coeficienteModificado = Math.abs(coeficiente - COEFICIENTE_BPS_OBRA_PUBLICA_DEFAULT) > 1e-9;

  const inputCls = "px-2 py-1 text-sm text-slate-700 bg-white border border-slate-200 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]";

  return (
    <div id="seccion-leyes-sociales" className="mt-6 bg-white rounded-[16px] border-2 border-[#1A3A5C] shadow-sm overflow-hidden scroll-mt-6">
      {/* Header colapsable — mismo formato que la tarjeta de obra privada */}
      <button
        onClick={() => setExpandido((p) => !p)}
        className="w-full flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors text-left group"
      >
        <div className="flex items-center gap-2.5">
          <Landmark className="w-4 h-4 text-[#2563EB]" />
          <h2 className="text-sm font-bold text-[#2563EB] uppercase tracking-wide whitespace-nowrap">Leyes Sociales / BPS</h2>
          <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-wider text-[#1A3A5C] bg-[#1A3A5C]/10 rounded px-1.5 py-0.5">
            Obra pública
          </span>
        </div>
        <div className="flex items-center gap-3 min-w-0">
          {!!montoLeyes && (
            <div className="flex items-baseline gap-1.5">
              <span className="hidden sm:inline text-xs font-normal text-slate-400">(paga el organismo al BPS)</span>
              <span className="text-lg font-bold text-[#2563EB] tabular-nums whitespace-nowrap">{fmtMoneda(montoLeyes, moneda)}</span>
            </div>
          )}
          <span className="text-slate-400 group-hover:text-slate-600 transition-colors">
            {expandido ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </span>
          {/* Alineación con la cola de la tabla de capítulos (ver
              layoutTablaPresupuesto.ts); en celular le saca lugar al monto. */}
          <span style={{ width: `calc(${RESERVA_COLA_TABLA} - 40px)` }} className="hidden sm:block flex-shrink-0" aria-hidden="true" />
        </div>
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

              {/* Texto explicativo */}
              <div className="flex items-start gap-2.5 rounded-[10px] border border-[#2563EB]/20 bg-[#2563EB]/5 px-4 py-3">
                <Info className="w-4 h-4 text-[#2563EB] flex-shrink-0 mt-0.5" />
                <div className="text-xs text-slate-600 space-y-1 leading-relaxed">
                  <p>
                    El coeficiente es el mismo porcentaje que en obra privada. Lo que cambia es quién paga y sobre
                    qué base:
                  </p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>
                      <span className="font-semibold text-slate-700">Quién paga:</span> el Estado, como propietario
                      de la obra, paga los aportes directamente al BPS (Decreto-Ley 14.411). No el contratista: no
                      aplica el AUC de obra privada.
                    </li>
                    <li>
                      <span className="font-semibold text-slate-700">Sobre qué base:</span> los jornales reales que
                      declara el contratista, no un porcentaje del valor de la obra.
                    </li>
                  </ul>
                  <p>Este monto se paga aparte: no entra al precio de ningún rubro.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Monto imponible */}
                <div>
                  <label className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Monto imponible (jornales declarados)
                    {jornales != null && montoImponible > 0 && (
                      <span
                        title="Jornales que representa este monto respecto al jornal SUNCA de Medio Oficial — mismo cálculo que la Cuantía de obra."
                        className="text-xs font-bold text-slate-500 bg-slate-100 rounded px-1.5 py-0.5 leading-4 normal-case tracking-normal whitespace-nowrap"
                      >
                        ≈ {Math.round(jornales)} jornales de medio oficial
                      </span>
                    )}
                  </label>
                  {editandoMonto ? (
                    <input
                      type="number"
                      value={montoImponible || ""}
                      onChange={(e) => onMontoImponibleChange(parseFloat(e.target.value) || 0)}
                      onBlur={() => setEditandoMonto(false)}
                      placeholder="0.00"
                      autoFocus
                      className={cn(inputCls, "w-44 text-right tabular-nums", sinFlechas)}
                    />
                  ) : (
                    <span
                      onClick={() => setEditandoMonto(true)}
                      className="inline-block w-44 px-2 py-1 text-sm text-right font-semibold text-slate-700 tabular-nums bg-white border border-slate-200 rounded-[6px] cursor-pointer hover:border-[#2563EB]/40 transition-colors"
                    >
                      {fmtMoneda(montoImponible, moneda)}
                    </span>
                  )}
                  <p className="text-xs text-slate-400 mt-1.5">
                    Lo que declara el contratista, no el estimado del presupuesto.
                  </p>
                </div>

                {/* Coeficiente BPS */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Coeficiente BPS vigente
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1">
                      <input
                        type="number"
                        step="any"
                        value={coeficiente === 0 ? "" : String(Number((coeficiente * 100).toFixed(4)))}
                        onChange={(e) => {
                          const n = parseFloat(e.target.value);
                          onCoeficienteChange(isNaN(n) ? 0 : n / 100);
                        }}
                        className={cn(inputCls, "w-24 text-right font-semibold tabular-nums", sinFlechas)}
                      />
                      <span className="text-sm text-slate-400">%</span>
                    </span>
                    {coeficienteModificado && (
                      <button
                        onClick={() => onCoeficienteChange(COEFICIENTE_BPS_OBRA_PUBLICA_DEFAULT)}
                        title={`Volver al valor vigente (${fmtPct(COEFICIENTE_BPS_OBRA_PUBLICA_DEFAULT)}%)`}
                        className="flex items-center gap-1 px-2 py-1 rounded-[6px] text-xs font-medium text-slate-500 hover:bg-slate-100 transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                        {fmtPct(COEFICIENTE_BPS_OBRA_PUBLICA_DEFAULT)}%
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5">
                    Por defecto {fmtPct(COEFICIENTE_BPS_OBRA_PUBLICA_DEFAULT)}%: aporte unificado de la construcción
                    (Decreto 241/007, redacción del Decreto 341/018).
                  </p>
                </div>
              </div>

              {/* Cuenta — siempre visible */}
              <div className="rounded-[10px] border border-slate-200 bg-white px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-slate-500 tabular-nums">
                  {fmtMoneda(montoImponible, moneda)} × {fmtPct(coeficiente)}%
                </p>
                <div className="text-right">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Leyes sociales</p>
                  <p className="text-lg font-bold tabular-nums text-[#1A3A5C]">{fmtMoneda(montoLeyes, moneda)}</p>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={onGuardar}
                  disabled={guardando}
                  className="px-4 py-2.5 rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {guardando ? "Guardando…" : "Guardar configuración"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
