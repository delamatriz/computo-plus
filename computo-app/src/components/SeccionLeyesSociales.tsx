"use client";

import { useState } from "react";
import { Building2, ChevronDown, ChevronRight, RotateCw, Info } from "lucide-react";
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
  metodoMontoImponible?: "apu" | "estimado" | null;
  // Jornal SUNCA de Medio Oficial — mismo valor que usa la Cuantía de obra
  // en proyectos/[id]/page.tsx (computarCuantiaObra), para expresar el
  // monto imponible en cantidad de jornales. undefined si todavía no hay
  // categorías laborales cargadas.
  jornalMedioOficial?: number;
  // Monto real de proyecto.timbresCJP — mismo campo que ya usan
  // SeccionResumenPresupuesto y el PDF (fuente única, no se duplica acá).
  timbresCJP: number;
  // Desglose de mano de obra por capítulo — calculado en page.tsx sobre
  // capitulos+apuData ya cargados en memoria (misma fórmula que
  // computarCostoManoObraTotal, sin consulta nueva). Puede no coincidir
  // con data.montoImponibleMO si el usuario lo editó a mano o si el
  // presupuesto cambió después del último "Calcular" — se avisa en la UI.
  desgloseMOPorCapitulo?: { capituloId: string; nombre: string; codigo?: string; monto: number }[];
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
  base,
}: {
  concepto: string;
  codigo: string;
  pct: number;
  onPctChange?: (v: number) => void;
  monto: number;
  moneda: string;
  destacado?: boolean;
  // Monto base sobre el que se aplica pct — solo se pasa cuando la fila
  // representa una fórmula simple "base × pct = monto" (las filas TOTAL
  // no, porque suman conceptos distintos). Habilita el ícono de info con
  // la cuenta completa al hover/tap.
  base?: number;
}) {
  return (
    <div
      className={cn(
        "flex items-center px-4 py-1.5",
        destacado ? "bg-slate-50 border-t border-slate-200" : "border-b border-slate-50 last:border-0"
      )}
    >
      <div className="flex-1 min-w-0 flex items-center gap-1">
        <span className={cn("text-sm truncate", destacado ? "font-bold text-[#1A3A5C] uppercase tracking-wide text-xs" : "text-slate-700")}>
          {concepto}
        </span>
        {base != null && (
          <span
            title={`${fmtMoneda(base, moneda)} × ${fmtPct(pct)}% = ${fmtMoneda(monto, moneda)}`}
            className="inline-flex flex-shrink-0 cursor-help"
          >
            <Info className="w-3 h-3 text-slate-300 hover:text-slate-500 transition-colors" />
          </span>
        )}
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
  metodoMontoImponible,
  jornalMedioOficial,
  timbresCJP,
  desgloseMOPorCapitulo,
}: Props) {
  const [expandido, setExpandido] = useState(false);
  const [editandoMonto, setEditandoMonto] = useState(false);
  const [desgloseExpandido, setDesgloseExpandido] = useState(false);
  const [desgloseAUCExpandido, setDesgloseAUCExpandido] = useState(false);

  const base = data.montoImponibleMO;

  // Jornales que representa el monto imponible MOSTRADO (editable a mano),
  // no el costo de mano de obra en vivo de la Cuantía de obra — ambos
  // pueden diferir (edición manual acá, o método "estimado" 38%).
  const jornalesMontoImponible =
    jornalMedioOficial != null && jornalMedioOficial > 0 ? base / jornalMedioOficial : null;

  // Suma del desglose por capítulo — se compara contra el monto imponible
  // MOSTRADO (editable/persistido) para avisar si divergen, en vez de
  // asumir que siempre van a coincidir (ver comentario del prop).
  const sumaDesglose = desgloseMOPorCapitulo?.reduce((s, d) => s + d.monto, 0) ?? null;
  const hayDiscrepanciaDesglose =
    sumaDesglose != null && Math.abs(sumaDesglose - base) > 1;

  // Propietario — AUC patronal + Timbres CJP/CJPPU (proyecto.timbresCJP,
  // mismo campo real que ya usan SeccionResumenPresupuesto y el PDF).
  const montoAUC = base * data.aucPct;
  const totalPropietario = montoAUC + timbresCJP;

  // Desglose legal del 71,4% de AUC (fuente: sau.org.uy) — 4 componentes
  // fijos que no se editan por separado, solo informativos. Se calculan
  // sobre `base` con los porcentajes legales, no sobre `data.aucPct`
  // (editable) — si alguien edita el % de AUC arriba, este desglose puede
  // dejar de sumar exactamente lo mismo, y se avisa igual que en el
  // desglose por capítulo.
  const AUC_PCT_JUBILATORIOS = 0.09 + 0.179; // patronal 9% + personal 17,9%
  const AUC_PCT_CARGAS_SALARIALES = 0.295;
  const AUC_PCT_FONASA = 0.055 + 0.035; // patronal 5,5% + obrero 3,5%
  const AUC_PCT_BSE = 0.06;
  const montoAucJubilatorios = base * AUC_PCT_JUBILATORIOS;
  const montoAucCargasSalariales = base * AUC_PCT_CARGAS_SALARIALES;
  const montoAucFonasa = base * AUC_PCT_FONASA;
  const montoAucBSE = base * AUC_PCT_BSE;
  const sumaDesgloseAUC = montoAucJubilatorios + montoAucCargasSalariales + montoAucFonasa + montoAucBSE;
  const hayDiscrepanciaAUC = Math.abs(sumaDesgloseAUC - montoAUC) > 1;

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
    <div id="seccion-leyes-sociales" className="mt-6 bg-white rounded-[16px] border-2 border-[#1A3A5C] shadow-sm overflow-hidden scroll-mt-6">
      {/* Header colapsable */}
      <button
        onClick={() => setExpandido((p) => !p)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors text-left group"
      >
        <div className="flex items-center gap-2.5">
          <Building2 className="w-4 h-4 text-[#2563EB]" />
          <h2 className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">Leyes Sociales / BPS</h2>
        </div>
        <div className="flex items-center gap-3">
          {!!totalPropietario && (
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs font-normal text-slate-400">(aportes propietario: AUC + Timbres)</span>
              <span className="text-lg font-bold text-[#2563EB] tabular-nums">{fmtMoneda(totalPropietario, moneda)}</span>
            </div>
          )}
          <span className="text-slate-400 group-hover:text-slate-600 transition-colors">
            {expandido ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </span>
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

              {/* Bloque superior — monto imponible */}
              <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                <div className="flex-1">
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Monto imponible mano de obra (calculado automáticamente)
                    {jornalesMontoImponible != null && (
                      <span
                        title="Jornales que representa este monto respecto al jornal SUNCA de Medio Oficial — mismo cálculo que la Cuantía de obra."
                        className="text-xs font-bold text-slate-500 bg-slate-100 rounded px-1.5 py-0.5 leading-4 normal-case tracking-normal whitespace-nowrap"
                      >
                        ≈ {Math.round(jornalesMontoImponible)} jornales de medio oficial
                      </span>
                    )}
                  </label>
                  <p className="text-xs text-slate-400 mb-2">
                    El monto imponible es la suma de la mano de obra real de cada rubro (jornal ÷ rendimiento ×
                    cantidad); si un rubro no la tiene desglosada, estima un 38% de su precio.
                  </p>
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
                      Calcular
                    </button>
                  </div>
                  {metodoMontoImponible === "estimado" && (
                    <p className="text-xs text-amber-600 mt-1.5">
                      ⚠ Monto imponible estimado (38% sobre precio unitario). Cargá el APU con mano de obra para mayor precisión.
                    </p>
                  )}

                  {desgloseMOPorCapitulo && desgloseMOPorCapitulo.length > 0 && (
                    <>
                      <button
                        onClick={() => setDesgloseExpandido((p) => !p)}
                        className="flex items-center gap-1 mt-2 text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {desgloseExpandido ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        Ver desglose por capítulo
                      </button>
                      <AnimatePresence initial={false}>
                        {desgloseExpandido && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-2 rounded-[8px] border border-slate-200 bg-white overflow-hidden max-w-md">
                              {desgloseMOPorCapitulo.map((d) => (
                                <div key={d.capituloId} className="flex items-center px-3 py-1.5 border-b border-slate-50 last:border-0">
                                  <div className="flex-1 min-w-0 text-xs text-slate-600 truncate">
                                    {d.codigo ? `${d.codigo} — ${d.nombre}` : d.nombre}
                                  </div>
                                  <div className="text-xs font-semibold tabular-nums text-[#2563EB]">
                                    {fmtMoneda(d.monto, moneda)}
                                  </div>
                                </div>
                              ))}
                            </div>
                            {hayDiscrepanciaDesglose && (
                              <div className="flex items-start gap-2 mt-2 rounded-[8px] bg-amber-50 border border-amber-200 px-3 py-2 max-w-md">
                                <span className="text-amber-500 flex-shrink-0">⚠</span>
                                <p className="text-xs text-amber-700">
                                  Este desglose refleja el presupuesto actual — puede no coincidir con el monto de
                                  arriba si lo editaste a mano o si el presupuesto cambió después del último
                                  &quot;Calcular&quot;.
                                </p>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  )}
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">

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
                    base={base}
                  />
                  <div className="px-4 py-1.5 border-b border-slate-50 bg-slate-50/50">
                    <button
                      onClick={() => setDesgloseAUCExpandido((p) => !p)}
                      className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {desgloseAUCExpandido ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      Ver de qué se compone el 71,4%
                    </button>
                    <AnimatePresence initial={false}>
                      {desgloseAUCExpandido && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-2 space-y-1">
                            {[
                              { label: "Aportes jubilatorios (patronal 9% + personal 17,9%)", pct: AUC_PCT_JUBILATORIOS, monto: montoAucJubilatorios },
                              { label: "Cargas salariales (licencia, aguinaldo, salario vacacional)", pct: AUC_PCT_CARGAS_SALARIALES, monto: montoAucCargasSalariales },
                              { label: "Seguro Nacional de Salud — FONASA (patronal 5,5% + obrero 3,5%)", pct: AUC_PCT_FONASA, monto: montoAucFonasa },
                              { label: "Banco de Seguros del Estado (BSE)", pct: AUC_PCT_BSE, monto: montoAucBSE },
                            ].map((item) => (
                              <div key={item.label} className="flex items-center gap-2">
                                <div className="flex-1 min-w-0 text-[11px] text-slate-500">{item.label}</div>
                                <div className="text-[11px] text-slate-400 tabular-nums flex-shrink-0" style={{ width: 40 }}>
                                  {fmtPct(item.pct)}%
                                </div>
                                <div className="text-[11px] font-medium text-slate-600 tabular-nums flex-shrink-0 text-right" style={{ width: 80 }}>
                                  {fmtMoneda(item.monto, moneda)}
                                </div>
                              </div>
                            ))}
                          </div>
                          {hayDiscrepanciaAUC && (
                            <div className="flex items-start gap-2 mt-2 rounded-[8px] bg-amber-50 border border-amber-200 px-3 py-2">
                              <span className="text-amber-500 flex-shrink-0">⚠</span>
                              <p className="text-[11px] text-amber-700">
                                Este desglose usa los porcentajes legales fijos (71,4% en total) — si editaste el %
                                de AUC arriba, puede no coincidir con el monto mostrado.
                              </p>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="flex items-center px-4 py-1.5 border-b border-slate-50">
                    <div className="flex-1 min-w-0 text-sm text-slate-700 truncate">Timbres CJP/CJPPU</div>
                    <div className="text-[11px] text-slate-400 tabular-nums" style={{ width: 56 }}>Cód. 113</div>
                    <div className="text-right text-xs text-slate-400" style={{ width: 80 }}>—</div>
                    <div className="text-right tabular-nums pl-3 text-sm font-semibold text-[#2563EB]" style={{ width: 110 }}>
                      {fmtMoneda(timbresCJP, moneda)}
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
                  <FilaAporte concepto="FOCER patronal"           codigo="145" pct={data.focerPatronalPct} onPctChange={(v) => set("focerPatronalPct", v)} monto={montoFocerPatronal} moneda={moneda} base={base} />
                  <FilaAporte concepto="FSC/FOCAP"                codigo="34"  pct={data.fscFocapPct}      onPctChange={(v) => set("fscFocapPct", v)}      monto={montoFscFocap}      moneda={moneda} base={base} />
                  <FilaAporte concepto="FOSVOC"                   codigo="43"  pct={data.fosvocPct}        onPctChange={(v) => set("fosvocPct", v)}        monto={montoFosvoc}        moneda={moneda} base={base} />
                  <FilaAporte concepto="FRL"                      codigo="47"  pct={data.frlPct}           onPctChange={(v) => set("frlPct", v)}           monto={montoFrl}           moneda={moneda} base={base} />
                  <FilaAporte concepto="Fdo. Garantía Créd. Lab." codigo="49"  pct={data.fondoGarantiaPct} onPctChange={(v) => set("fondoGarantiaPct", v)} monto={montoFondoGarantia} moneda={moneda} base={base} />
                  <FilaAporte concepto="SNIS adicional"           codigo="108" pct={data.snisAdicionalPct} onPctChange={(v) => set("snisAdicionalPct", v)} monto={montoSnisAdicional} moneda={moneda} base={base} />
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
                  base={base}
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
