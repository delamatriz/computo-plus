"use client";

import { useState } from "react";
import { Building2, ChevronDown, ChevronRight, RotateCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export interface LeyesSocialesData {
  tipoContratante: "empresa" | "propietario_directo";
  montoImponibleMO: number;
  aucPct: number;
  focerPatronalPct: number;
  fscFocapPct: number;
  fosvocPct: number;
  frlPct: number;
  fondoGarantiaPct: number;
  snisAdicionalPct: number;
  focerPersonalPct: number;
}

interface Props {
  proyectoId: string;
  moneda: string;
  data: LeyesSocialesData;
  onChange: (data: LeyesSocialesData) => void;
  onRecalcular: () => Promise<void>;
  onGuardar: () => Promise<void>;
  recalculando: boolean;
  guardando: boolean;
}

function fmtMoneda(v: number, moneda: string): string {
  if (!v) return "—";
  const fmt = Math.round(v).toLocaleString("es-UY");
  return moneda === "USD" ? `U$S ${fmt}` : `$ ${fmt}`;
}

function fmtPct(v: number): string {
  return (v * 100).toLocaleString("es-UY", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** Input editable inline para un porcentaje (almacenado como fracción 0–1) */
function PctInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <span className="inline-flex items-center gap-0.5">
      <input
        type="number"
        step="0.1"
        value={value === 0 ? "" : (value * 100).toFixed(1)}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          onChange(isNaN(n) ? 0 : n / 100);
        }}
        className="w-12 text-right text-sm font-semibold text-slate-600 bg-transparent border-b border-dashed border-slate-300 focus:outline-none focus:border-[#2563EB] focus:text-[#2563EB] tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <span className="text-xs text-slate-400">%</span>
    </span>
  );
}

function FilaAporte({
  concepto,
  codigo,
  pct,
  onPctChange,
  monto,
  moneda,
  destacado = false,
}: {
  concepto: string;
  codigo: string;
  pct: number;
  onPctChange?: (v: number) => void;
  monto: number;
  moneda: string;
  destacado?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center px-4 py-1.5",
        destacado ? "bg-slate-50 border-t border-slate-200" : "border-b border-slate-50 last:border-0"
      )}
    >
      <div className={cn("flex-1 min-w-0 text-sm truncate", destacado ? "font-bold text-[#1A3A5C] uppercase tracking-wide text-xs" : "text-slate-700")}>
        {concepto}
      </div>
      <div className="text-[11px] text-slate-400 tabular-nums" style={{ width: 56 }}>
        Cód. {codigo}
      </div>
      <div className="text-right" style={{ width: 80 }}>
        {onPctChange ? (
          <PctInput value={pct} onChange={onPctChange} />
        ) : (
          <span className="text-sm font-semibold tabular-nums text-slate-600">{fmtPct(pct)}%</span>
        )}
      </div>
      <div className={cn("text-right tabular-nums pl-3", destacado ? "text-base font-bold text-[#1A3A5C]" : "text-sm font-semibold text-[#2563EB]")} style={{ width: 110 }}>
        {fmtMoneda(monto, moneda)}
      </div>
    </div>
  );
}

function CardResumen({ titulo, monto, moneda }: { titulo: string; monto: number; moneda: string }) {
  return (
    <div className="flex-1 min-w-0 rounded-[10px] border border-slate-200 bg-white px-4 py-3">
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">{titulo}</p>
      <p className="text-lg font-bold tabular-nums text-[#1A3A5C] mt-1">{fmtMoneda(monto, moneda)}</p>
    </div>
  );
}

export default function SeccionLeyesSociales({
  moneda,
  data,
  onChange,
  onRecalcular,
  onGuardar,
  recalculando,
  guardando,
}: Props) {
  const [expandido, setExpandido] = useState(false);
  const [editandoMonto, setEditandoMonto] = useState(false);

  const base = data.montoImponibleMO;

  // Propietario
  const montoAUC = base * data.aucPct;
  const totalPropietario = montoAUC; // timbres CJP: monto fijo a confirmar, no se suma aún

  // Empresa — patronal
  const montoFocerPatronal = base * data.focerPatronalPct;
  const montoFscFocap      = base * data.fscFocapPct;
  const montoFosvoc        = base * data.fosvocPct;
  const montoFrl           = base * data.frlPct;
  const montoFondoGarantia = base * data.fondoGarantiaPct;
  const montoSnisAdicional = base * data.snisAdicionalPct;
  const pctTotalEmpresa =
    data.focerPatronalPct + data.fscFocapPct + data.fosvocPct +
    data.frlPct + data.fondoGarantiaPct + data.snisAdicionalPct;
  const totalEmpresa =
    montoFocerPatronal + montoFscFocap + montoFosvoc +
    montoFrl + montoFondoGarantia + montoSnisAdicional;

  // Retención personal
  const montoFocerPersonal = base * data.focerPersonalPct;

  const set = <K extends keyof LeyesSocialesData>(field: K, value: LeyesSocialesData[K]) =>
    onChange({ ...data, [field]: value });

  const inputCls = "px-2 py-1 text-sm text-slate-700 bg-white border border-slate-200 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]";

  return (
    <div id="seccion-leyes-sociales" className="mt-6 bg-white rounded-[16px] border border-slate-300 shadow-sm overflow-hidden scroll-mt-6">
      {/* Header colapsable */}
      <button
        onClick={() => setExpandido((p) => !p)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors text-left group"
      >
        <div className="flex items-center gap-2.5">
          <Building2 className="w-4 h-4 text-[#2563EB]" />
          <h2 className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">Leyes Sociales / BPS</h2>
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

              {/* Bloque superior — monto imponible */}
              <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                <div className="flex-1">
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Monto imponible mano de obra (calculado automáticamente)
                  </label>
                  <div className="flex items-center gap-2">
                    {editandoMonto ? (
                      <input
                        type="number"
                        value={data.montoImponibleMO || ""}
                        onChange={(e) => set("montoImponibleMO", parseFloat(e.target.value) || 0)}
                        onBlur={() => setEditandoMonto(false)}
                        placeholder="0.00"
                        autoFocus
                        className={cn(inputCls, "w-44 text-right tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none")}
                      />
                    ) : (
                      <span
                        onClick={() => setEditandoMonto(true)}
                        className="w-44 px-2 py-1 text-sm text-right font-semibold text-slate-700 tabular-nums bg-white border border-slate-200 rounded-[6px] cursor-pointer hover:border-[#2563EB]/40 transition-colors"
                      >
                        {fmtMoneda(data.montoImponibleMO, moneda)}
                      </span>
                    )}
                    <button
                      onClick={onRecalcular}
                      disabled={recalculando}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] border border-slate-300 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                      <RotateCw className={cn("w-3.5 h-3.5", recalculando && "animate-spin")} />
                      Recalcular desde APUs
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Tipo de contratante
                  </label>
                  <select
                    value={data.tipoContratante}
                    onChange={(e) => set("tipoContratante", e.target.value as LeyesSocialesData["tipoContratante"])}
                    className={cn(inputCls, "w-52")}
                  >
                    <option value="empresa">Empresa constructora</option>
                    <option value="propietario_directo">Propietario directo</option>
                  </select>
                </div>
              </div>

              {/* Bloque medio — tabla de aportes */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">

                {/* Propietario paga */}
                <div className="rounded-[10px] border border-slate-200 bg-white overflow-hidden">
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
                    <span className="text-xs font-bold text-[#1A3A5C] uppercase tracking-wide">Propietario paga</span>
                  </div>
                  <FilaAporte
                    concepto="AUC patronal"
                    codigo="2"
                    pct={data.aucPct}
                    onPctChange={(v) => set("aucPct", v)}
                    monto={montoAUC}
                    moneda={moneda}
                  />
                  <div className="flex items-center px-4 py-1.5 border-b border-slate-50">
                    <div className="flex-1 min-w-0 text-sm text-slate-700 truncate">Timbres CJP/CJPPU</div>
                    <div className="text-[11px] text-slate-400 tabular-nums" style={{ width: 56 }}>Cód. 113</div>
                    <div className="text-right text-xs text-slate-400" style={{ width: 80 }}>—</div>
                    <div className="text-right tabular-nums pl-3 text-xs text-slate-400 italic" style={{ width: 110 }}>
                      monto fijo (a confirmar)
                    </div>
                  </div>
                  <FilaAporte
                    concepto="TOTAL Propietario"
                    codigo=""
                    pct={data.aucPct}
                    monto={totalPropietario}
                    moneda={moneda}
                    destacado
                  />
                </div>

                {/* Empresa paga */}
                <div className="rounded-[10px] border border-slate-200 bg-white overflow-hidden">
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
                    <span className="text-xs font-bold text-[#1A3A5C] uppercase tracking-wide">Empresa paga</span>
                  </div>
                  <FilaAporte concepto="FOCER patronal"           codigo="145" pct={data.focerPatronalPct} onPctChange={(v) => set("focerPatronalPct", v)} monto={montoFocerPatronal} moneda={moneda} />
                  <FilaAporte concepto="FSC/FOCAP"                codigo="34"  pct={data.fscFocapPct}      onPctChange={(v) => set("fscFocapPct", v)}      monto={montoFscFocap}      moneda={moneda} />
                  <FilaAporte concepto="FOSVOC"                   codigo="43"  pct={data.fosvocPct}        onPctChange={(v) => set("fosvocPct", v)}        monto={montoFosvoc}        moneda={moneda} />
                  <FilaAporte concepto="FRL"                      codigo="47"  pct={data.frlPct}           onPctChange={(v) => set("frlPct", v)}           monto={montoFrl}           moneda={moneda} />
                  <FilaAporte concepto="Fdo. Garantía Créd. Lab." codigo="49"  pct={data.fondoGarantiaPct} onPctChange={(v) => set("fondoGarantiaPct", v)} monto={montoFondoGarantia} moneda={moneda} />
                  <FilaAporte concepto="SNIS adicional"           codigo="108" pct={data.snisAdicionalPct} onPctChange={(v) => set("snisAdicionalPct", v)} monto={montoSnisAdicional} moneda={moneda} />
                  <FilaAporte concepto="TOTAL Empresa" codigo="" pct={pctTotalEmpresa} monto={totalEmpresa} moneda={moneda} destacado />
                </div>
              </div>

              {/* Retención personal */}
              <div className="rounded-[10px] border border-slate-200 bg-white overflow-hidden max-w-md">
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
                  <span className="text-xs font-bold text-[#1A3A5C] uppercase tracking-wide">Retención personal (descuento al obrero)</span>
                </div>
                <FilaAporte
                  concepto="FOCER personal"
                  codigo="146"
                  pct={data.focerPersonalPct}
                  onPctChange={(v) => set("focerPersonalPct", v)}
                  monto={montoFocerPersonal}
                  moneda={moneda}
                />
              </div>

              {/* Bloque inferior — resumen */}
              <div className="flex flex-col sm:flex-row gap-3">
                <CardResumen titulo="Aportes propietario"            monto={totalPropietario}    moneda={moneda} />
                <CardResumen titulo="Aportes empresa (patronal)"     monto={totalEmpresa}        moneda={moneda} />
                <CardResumen titulo="Retención personal"             monto={montoFocerPersonal}  moneda={moneda} />
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
