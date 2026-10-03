"use client";

import { useState } from "react";
import { Building2, ChevronDown, ChevronRight, RotateCw, Info, Loader2, AlertTriangle, Percent } from "lucide-react";
import { NotaInfoIcono } from "@/components/NotaInfoIcono";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { RESERVA_COLA_TABLA } from "@/lib/layoutTablaPresupuesto";
import { CAJA_PROFESIONALES_ETIQUETA, CAJA_PROFESIONALES_PCT, montoCajaProfesionales, normalizarTipoCaja, type TipoCajaProfesionales } from "@/lib/cajaProfesionales";
import { AUC_PCT_DEFAULT, AUC_PCT_JUBILATORIOS, AUC_PCT_CARGAS_SALARIALES, AUC_PCT_FONASA, AUC_PCT_BSE } from "@/lib/auc";

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
  // Caja de Profesionales (Ley 17.738) — informativa, sin efecto en ningún
  // precio. Ver src/lib/cajaProfesionales.ts.
  cajaProfesionalesTipo: TipoCajaProfesionales;
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
  // Desglose de mano de obra por capítulo — calculado en page.tsx sobre
  // capitulos+apuData ya cargados en memoria (misma fórmula que
  // computarCostoManoObraTotal, sin consulta nueva). Puede no coincidir
  // con data.montoImponibleMO si el usuario lo editó a mano o si el
  // presupuesto cambió después del último "Calcular" — se avisa en la UI.
  desgloseMOPorCapitulo?: { capituloId: string; nombre: string; codigo?: string; monto: number }[];
}

// Tooltip del FOCER patronal (junto a su input).
const NOTA_FOCER =
  "FOCER patronal: 5% por defecto. Corresponde 0,5% si el trabajador tiene derecho a indemnización por despido y la empresa lo declara (declaración jurada). Al cambiarlo, los rubros ya creados no se modifican: usá 'Aplicar aportes patronales a rubros existentes'.";

// Vista previa de POST /api/proyectos/[id]/propagar-aportes-patronales (dryRun).
interface PreviewAportes {
  actualizarian: number;
  protegidos: { rubroId: string; codigo: string; descripcion: string }[];
  sinApu: number;
  yaAlDia: number;
  pctNuevo: number; // puntos porcentuales (6.4191)
  antes: { costoTotal: number; precioFinal: number };
  despues: { costoTotal: number; precioFinal: number };
  contratado: { contrato: boolean; certificaciones: number; ordenesCompra: number; liquidacionFinal: boolean };
  requiereConfirmacion: boolean;
}

function fmtMoneda(v: number, moneda: string): string {
  if (!v) return "—";
  const fmt = Math.round(v).toLocaleString("es-UY");
  return moneda === "USD" ? `U$S ${fmt}` : `$ ${fmt}`;
}

// Hasta 4 decimales (mínimo 1): los fondos patronales legales tienen
// 1,2691% (FSC + FOCAP) y 0,025% (FOSVOC, Fondo de Garantía) — con 1 decimal
// se veían como 1,3% y 0,0%.
function fmtPct(v: number): string {
  return (v * 100).toLocaleString("es-UY", { minimumFractionDigits: 1, maximumFractionDigits: 4 });
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
        step="any"
        value={value === 0 ? "" : String(Number((value * 100).toFixed(4)))}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          onChange(isNaN(n) ? 0 : n / 100);
        }}
        className="w-14 text-right text-sm font-semibold text-slate-600 bg-transparent border-b border-dashed border-slate-300 focus:outline-none focus:border-[#2563EB] focus:text-[#2563EB] tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
  nota,
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
  // Tooltip oscuro (NotaInfoIcono, posición fija: no se corta con el scroll)
  // junto al nombre del concepto.
  nota?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-y-0.5 px-4 py-1.5",
        destacado ? "bg-slate-50 border-t border-slate-200" : "border-b border-slate-50 last:border-0"
      )}
    >
      {/* El concepto no se corta con "…": en pantallas angostas (< 640 px) ocupa
          su propia línea (basis-full) y código / % / monto pasan a la línea de
          abajo; de 640 px para arriba van en la misma fila y, si el texto es
          largo, pasa a una segunda línea. Flujo de texto en línea, así los
          íconos (fórmula y nota) quedan pegados al final del texto. */}
      <div className="basis-full sm:basis-0 sm:flex-1 min-w-0 sm:min-w-[7rem] leading-tight">
        <span className={cn("text-sm", destacado ? "font-bold text-[#1A3A5C] uppercase tracking-wide text-xs" : "text-slate-700")}>
          {concepto}
        </span>
        {base != null && (
          <span
            title={`${fmtMoneda(base, moneda)} × ${fmtPct(pct)}% = ${fmtMoneda(monto, moneda)}`}
            className="inline-flex align-middle ml-1 flex-shrink-0 cursor-help"
          >
            <Info className="w-3 h-3 text-slate-300 hover:text-slate-500 transition-colors" />
          </span>
        )}
        {nota && <NotaInfoIcono texto={nota} />}
      </div>
      <div className="text-[11px] text-slate-400 tabular-nums mr-auto sm:mr-0" style={{ width: 56 }}>
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
  proyectoId,
  moneda,
  data,
  onChange,
  onRecalcular,
  onGuardar,
  recalculando,
  guardando,
  metodoMontoImponible,
  jornalMedioOficial,
  desgloseMOPorCapitulo,
}: Props) {
  const [expandido, setExpandido] = useState(false);
  const [editandoMonto, setEditandoMonto] = useState(false);
  const [desgloseExpandido, setDesgloseExpandido] = useState(false);
  const [desgloseAUCExpandido, setDesgloseAUCExpandido] = useState(false);

  // ── Aplicar aportes patronales a rubros existentes ─────────────────────
  // Cambiar un fondo acá solo afecta a los rubros que se creen DESPUÉS (cada APU
  // congela su aportesPatronalesPct). Este botón propaga el % vigente a los ya
  // creados — mismo patrón de dos pasos que "Aplicar X% a rubros existentes" de
  // Utilidad: vista previa (dry-run) → confirmación → aplicar.
  const [consultandoAportes, setConsultandoAportes] = useState(false);
  const [aplicandoAportes, setAplicandoAportes] = useState(false);
  const [errorAportes, setErrorAportes] = useState<string | null>(null);
  const [previewAportes, setPreviewAportes] = useState<PreviewAportes | null>(null);
  const [confirmaContrato, setConfirmaContrato] = useState(false);

  async function consultarAportes() {
    setConsultandoAportes(true);
    setErrorAportes(null);
    setPreviewAportes(null);
    setConfirmaContrato(false);
    try {
      // La propagación lee los fondos GUARDADOS del proyecto: se guarda primero
      // lo que esté editado en pantalla para que vista previa y aplicación
      // usen exactamente los valores que se ven.
      await onGuardar();
      const res = await fetch(`/api/proyectos/${proyectoId}/propagar-aportes-patronales`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: true }),
      });
      const d = await res.json();
      if (!res.ok || d.error) {
        setErrorAportes(d.mensaje ?? d.error ?? "No se pudo calcular la vista previa. Probá de nuevo.");
        return;
      }
      setPreviewAportes(d);
    } catch {
      setErrorAportes("No se pudo calcular la vista previa. Probá de nuevo.");
    } finally {
      setConsultandoAportes(false);
    }
  }

  async function aplicarAportes() {
    if (!previewAportes) return;
    setAplicandoAportes(true);
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/propagar-aportes-patronales`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmarContrato: confirmaContrato }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.mensaje ?? "No se pudieron aplicar los aportes patronales.");
      }
      setPreviewAportes(null);
      window.location.reload();
    } catch (e) {
      setErrorAportes(e instanceof Error ? e.message : "No se pudieron aplicar los aportes patronales.");
      setPreviewAportes(null);
      setAplicandoAportes(false);
    }
  }

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

  // Propietario — AUC patronal. Timbres CJP/CJPPU se sacó de acá: ahora
  // vive como ítem (exentoIVA) dentro de Gastos Generales Detallado, ver
  // gastosGenerales.ts — se muestra ahí, no se duplica en esta cascada.
  const montoAUC = base * data.aucPct;
  const totalPropietario = montoAUC; // header de la tarjeta y Precio Final: solo AUC
  // Caja de Profesionales — informativa: mismo monto imponible que el AUC, se
  // recauda junto con él. No entra a ningún precio ni al header de arriba.
  const tipoCaja = normalizarTipoCaja(data.cajaProfesionalesTipo);
  const montoCaja = montoCajaProfesionales(base, tipoCaja);
  const totalPropietarioConCaja = montoAUC + montoCaja;

  // Desglose legal del 71,8% de AUC (Decreto 341/018 — ver src/lib/auc.ts) —
  // 4 componentes fijos que no se editan por separado, solo informativos. Se
  // calculan sobre `base` con los porcentajes legales, no sobre `data.aucPct`
  // (editable) — si alguien edita el % de AUC arriba, este desglose puede
  // dejar de sumar exactamente lo mismo, y se avisa igual que en el
  // desglose por capítulo.
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
  // SNIS adicional ya NO es patronal: es un aporte personal variable del
  // trabajador (ver aportesPatronales.ts) — vive en "Retención personal".
  const pctTotalEmpresa =
    data.focerPatronalPct + data.fscFocapPct + data.fosvocPct +
    data.frlPct + data.fondoGarantiaPct;
  const totalEmpresa =
    montoFocerPatronal + montoFscFocap + montoFosvoc +
    montoFrl + montoFondoGarantia;

  // Retención personal (informativa, no entra al precio)
  const montoFocerPersonal = base * data.focerPersonalPct;
  const montoSnisAdicional = base * data.snisAdicionalPct;
  const totalRetencionPersonal = montoFocerPersonal + montoSnisAdicional;

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
          {/* Única tarjeta (junto con Precio Final) que lleva el azul
              acento en el título — no el navy #1A3A5C que usan las demás. */}
          <h2 className="text-sm font-bold text-[#2563EB] uppercase tracking-wide">Leyes Sociales / BPS</h2>
        </div>
        <div className="flex items-center gap-3">
          {!!totalPropietario && (
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs font-normal text-slate-400">(aportes propietario: AUC)</span>
              {/* Mismo tamaño que el monto de Precio Final (text-lg) —
                  las dos únicas tarjetas en azul de la cascada comparten
                  el mismo peso visual, incluido el tamaño del monto. */}
              <span className="text-lg font-bold text-[#2563EB] tabular-nums">{fmtMoneda(totalPropietario, moneda)}</span>
            </div>
          )}
          <span className="text-slate-400 group-hover:text-slate-600 transition-colors">
            {expandido ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </span>
          {/* Mismo ancho de cola que la tabla de capítulos/rubros después
              del chevron (ver layoutTablaPresupuesto.ts) — sin esto, el
              monto quedaba alineado solo contra el chevron, no contra el
              TOTAL de la tabla. */}
          <span style={{ width: `calc(${RESERVA_COLA_TABLA} - 40px)` }} className="flex-shrink-0" aria-hidden="true" />
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
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">

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
                      Ver de qué se compone el {fmtPct(AUC_PCT_DEFAULT)}%
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
                                Este desglose usa los porcentajes legales fijos ({fmtPct(AUC_PCT_DEFAULT)}% en total) — si editaste el %
                                de AUC arriba, puede no coincidir con el monto mostrado.
                              </p>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  {/* Caja de Profesionales — informativa (Ley 17.738): se recauda
                      junto con el AUC sobre el mismo monto imponible. Sin efecto
                      en ningún precio. Selector Arquitectura / Ingeniería / No aplica. */}
                  <div className="flex flex-wrap items-center gap-y-1 px-4 py-1.5 border-b border-slate-50">
                    <div className="flex-1 min-w-[150px] flex items-center gap-1">
                      <span className="text-sm text-slate-700">Caja de Profesionales</span>
                      <span
                        title="Aporte del propietario que se recauda junto con el AUC (Ley 17.738): 4% en obras de arquitectura, 2% en ingeniería. Solo informativo: no entra al precio de ningún rubro."
                        className="inline-flex flex-shrink-0 cursor-help"
                      >
                        <Info className="w-3 h-3 text-slate-300 hover:text-slate-500 transition-colors" />
                      </span>
                    </div>
                    <select
                      value={tipoCaja}
                      onChange={(e) => set("cajaProfesionalesTipo", e.target.value as TipoCajaProfesionales)}
                      aria-label="Tipo de obra para la Caja de Profesionales"
                      className="ml-auto mr-2 px-1.5 py-0.5 text-xs text-slate-600 bg-white border border-slate-200 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
                    >
                      {(Object.keys(CAJA_PROFESIONALES_ETIQUETA) as TipoCajaProfesionales[]).map((t) => (
                        <option key={t} value={t}>{CAJA_PROFESIONALES_ETIQUETA[t]}</option>
                      ))}
                    </select>
                    <div className="text-right tabular-nums text-sm font-semibold text-[#2563EB]" style={{ width: 80 }}>
                      {tipoCaja === "NO_APLICA" ? "—" : fmtMoneda(montoCaja, moneda)}
                    </div>
                  </div>
                  <FilaAporte
                    concepto="TOTAL Propietario"
                    codigo=""
                    pct={data.aucPct + CAJA_PROFESIONALES_PCT[tipoCaja] / 100}
                    monto={totalPropietarioConCaja}
                    moneda={moneda}
                    destacado
                  />
                </div>

                {/* Empresa paga */}
                <div className="rounded-[10px] border border-slate-200 bg-white overflow-hidden">
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
                    <span className="text-xs font-bold text-[#1A3A5C] uppercase tracking-wide">Empresa paga</span>
                  </div>
                  <FilaAporte concepto="FOCER patronal"           codigo="145" pct={data.focerPatronalPct} onPctChange={(v) => set("focerPatronalPct", v)} monto={montoFocerPatronal} moneda={moneda} base={base} nota={NOTA_FOCER} />
                  <FilaAporte concepto="FSC/FOCAP"                codigo="34"  pct={data.fscFocapPct}      onPctChange={(v) => set("fscFocapPct", v)}      monto={montoFscFocap}      moneda={moneda} base={base} />
                  <FilaAporte concepto="FOSVOC"                   codigo="43"  pct={data.fosvocPct}        onPctChange={(v) => set("fosvocPct", v)}        monto={montoFosvoc}        moneda={moneda} base={base} />
                  <FilaAporte concepto="FRL"                      codigo="47"  pct={data.frlPct}           onPctChange={(v) => set("frlPct", v)}           monto={montoFrl}           moneda={moneda} base={base} />
                  <FilaAporte concepto="Fdo. Garantía Créd. Lab." codigo="49"  pct={data.fondoGarantiaPct} onPctChange={(v) => set("fondoGarantiaPct", v)} monto={montoFondoGarantia} moneda={moneda} base={base} />
                  <FilaAporte concepto="TOTAL Empresa" codigo="" pct={pctTotalEmpresa} monto={totalEmpresa} moneda={moneda} destacado />
                  <div className="px-4 py-3 border-t border-slate-100">
                    <button
                      onClick={consultarAportes}
                      disabled={consultandoAportes}
                      className="flex items-center gap-1.5 text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors disabled:opacity-60"
                    >
                      {consultandoAportes ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Percent className="w-3.5 h-3.5" />}
                      {consultandoAportes ? "Calculando…" : "Aplicar aportes patronales a rubros existentes"}
                    </button>
                    <p className="text-xs text-slate-400 mt-1">
                      Los rubros ya creados guardan el % de aportes con el que se crearon; esto lo actualiza a {fmtPct(pctTotalEmpresa)}%
                      (guarda la configuración y muestra una vista previa antes de aplicar).
                    </p>
                    {errorAportes && (
                      <div className="flex items-start gap-2 rounded-[10px] bg-amber-50 border border-amber-200 px-3 py-2.5 mt-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-amber-800">{errorAportes}</p>
                      </div>
                    )}
                  </div>
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
                {/* SNIS adicional: aporte personal variable del trabajador (no
                    patronal) — informativo, no entra al precio. */}
                <FilaAporte
                  concepto="SNIS adicional"
                  codigo="108"
                  pct={data.snisAdicionalPct}
                  onPctChange={(v) => set("snisAdicionalPct", v)}
                  monto={montoSnisAdicional}
                  moneda={moneda}
                  base={base}
                />
              </div>

              {/* Bloque inferior — resumen */}
              <div className="flex flex-col sm:flex-row gap-3">
                <CardResumen titulo="Aportes propietario"  monto={totalPropietarioConCaja} moneda={moneda} />
                <CardResumen titulo="Aportes empresa (patronal)"     monto={totalEmpresa}        moneda={moneda} />
                <CardResumen titulo="Retención personal"             monto={totalRetencionPersonal} moneda={moneda} />
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

      {/* Modal de confirmación — aplicar aportes patronales a rubros existentes.
          Mismo patrón visual que el de "Aplicar Utilidad a rubros existentes". */}
      <AnimatePresence>
        {previewAportes && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
            onClick={() => !aplicandoAportes && setPreviewAportes(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-[16px] shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
            >
              <h3 className="text-base font-bold text-[#1A3A5C] mb-2">Aplicar aportes patronales {fmtPct(previewAportes.pctNuevo / 100)}% a rubros existentes</h3>
              <p className="text-sm text-slate-600 mb-3">
                <span className="font-semibold">{previewAportes.actualizarian} rubro{previewAportes.actualizarian === 1 ? "" : "s"}</span> se
                actualizaría{previewAportes.actualizarian === 1 ? "" : "n"}, recalculando su precio unitario (los aportes entran solo sobre la mano de obra).
              </p>
              <ul className="text-xs text-slate-500 mb-3 space-y-0.5">
                {previewAportes.protegidos.length > 0 && (
                  <li><span className="font-semibold">{previewAportes.protegidos.length}</span> con precio congelado: protegido{previewAportes.protegidos.length === 1 ? "" : "s"}, no se toca{previewAportes.protegidos.length === 1 ? "" : "n"}.</li>
                )}
                {previewAportes.sinApu > 0 && (
                  <li><span className="font-semibold">{previewAportes.sinApu}</span> sin análisis de precio unitario (APU): se saltean, no cambian.</li>
                )}
                {previewAportes.yaAlDia > 0 && (
                  <li><span className="font-semibold">{previewAportes.yaAlDia}</span> ya tienen este %: no cambian.</li>
                )}
              </ul>
              <div className="rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 mb-3 text-xs text-slate-600 space-y-1">
                <div className="flex items-center justify-between">
                  <span>Costo Total</span>
                  <span className="tabular-nums">{fmtMoneda(previewAportes.antes.costoTotal, moneda)} → <span className="font-semibold text-[#1A3A5C]">{fmtMoneda(previewAportes.despues.costoTotal, moneda)}</span></span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Precio Final</span>
                  <span className="tabular-nums">{fmtMoneda(previewAportes.antes.precioFinal, moneda)} → <span className="font-semibold text-[#1A3A5C]">{fmtMoneda(previewAportes.despues.precioFinal, moneda)}</span></span>
                </div>
              </div>
              {previewAportes.protegidos.length > 0 && (
                <div className="rounded-[10px] bg-amber-50 border border-amber-200 px-3 py-2 mb-3 max-h-32 overflow-y-auto">
                  <p className="text-[11px] font-medium text-amber-800 mb-1">Rubros protegidos (no se tocan):</p>
                  <ul className="space-y-0.5">
                    {previewAportes.protegidos.map((r) => (
                      <li key={r.rubroId} className="text-[11px] text-amber-700">{r.codigo} — {r.descripcion || "Rubro sin nombre"}</li>
                    ))}
                  </ul>
                </div>
              )}
              {previewAportes.requiereConfirmacion && (
                <div className="rounded-[10px] bg-red-50 border border-red-200 px-3 py-2.5 mb-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-red-800">
                      Este proyecto ya tiene contrato o certificaciones: cambiar precios altera lo contratado
                      ({[
                        previewAportes.contratado.contrato && "contrato",
                        previewAportes.contratado.certificaciones > 0 && `${previewAportes.contratado.certificaciones} certificación(es)`,
                        previewAportes.contratado.ordenesCompra > 0 && `${previewAportes.contratado.ordenesCompra} orden(es) de compra`,
                        previewAportes.contratado.liquidacionFinal && "liquidación final",
                      ].filter(Boolean).join(", ")}).
                    </p>
                  </div>
                  <label className="flex items-start gap-2 mt-2 cursor-pointer">
                    <input type="checkbox" checked={confirmaContrato} onChange={(e) => setConfirmaContrato(e.target.checked)} className="mt-0.5" />
                    <span className="text-xs text-red-800">Entiendo que esto modifica precios ya contratados y quiero continuar.</span>
                  </label>
                </div>
              )}
              <p className="text-sm text-slate-600 mb-5">Esta acción no se puede deshacer automáticamente. ¿Continuar?</p>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setPreviewAportes(null)}
                  disabled={aplicandoAportes}
                  className="px-4 py-2.5 rounded-[10px] text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  onClick={aplicarAportes}
                  disabled={aplicandoAportes || previewAportes.actualizarian === 0 || (previewAportes.requiereConfirmacion && !confirmaContrato)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1A3A5C] transition-colors disabled:opacity-60"
                >
                  {aplicandoAportes && <Loader2 className="w-4 h-4 animate-spin" />}
                  {aplicandoAportes ? "Aplicando…" : `Aplicar a ${previewAportes.actualizarian} rubro${previewAportes.actualizarian === 1 ? "" : "s"}`}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
