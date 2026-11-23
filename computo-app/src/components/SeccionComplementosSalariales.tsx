"use client";

import { useState } from "react";
import { Users, ChevronDown, ChevronRight } from "lucide-react";
import { NotaInfoIcono } from "@/components/NotaInfoIcono";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { RESERVA_COLA_TABLA } from "@/lib/layoutTablaPresupuesto";

// Interfaz mínima — solo los 4 campos de complementos salariales.
// El monto imponible viene de LeyesSociales (misma base de cálculo).
export interface ComplementosSalarialesData {
  montoImponibleMO: number;
  horasLluviaPct: number;
  desgasteRopaPct: number;
  desgasteHerramientasPct: number;
  complementoTransportePct: number;
}

interface Props {
  moneda: string;
  data: ComplementosSalarialesData;
  onChange: (data: ComplementosSalarialesData) => void;
  onGuardar: () => Promise<void>;
  guardando: boolean;
}

// ── Tooltips ──────────────────────────────────────────────────────────────────
const NOTA_HORAS_LLUVIA =
  "Horas de lluvia y barro (Convenio SUNCA, art. 9 conv. 2023): cuando llueve, el capataz puede suspender las tareas. El obrero cobra igual hasta 6 horas por jornada, descontadas de una bolsa cuatrimestral (36 h nov–feb / 48 h mar–jun / 60 h jul–oct). Más horas adicionales por barro (6/8/10 h por cuatrimestre). Se paga en el recibo del obrero, no al BPS.\n\nReferencia orientativa: obra de verano ~5%, obra de otoño/invierno ~10%, obra anual ~8%. Ajustá según la época de la obra.";

const NOTA_DESGASTE_ROPA =
  "Desgaste de ropa de trabajo (Convenio SUNCA, art. 7): la empresa paga al obrero un complemento por el desgaste de la ropa que usa en obra. Se liquida en el recibo junto al jornal, no al BPS. Default 5% sobre el monto imponible (aproximación práctica); el valor exacto depende del jornal de referencia × jornadas trabajadas.";

const NOTA_DESGASTE_HERRAMIENTAS =
  "Desgaste de herramientas manuales (Convenio SUNCA, art. 8): la empresa paga al obrero un complemento por el uso y desgaste de sus herramientas personales (cuchara, llana, mazo, etc.). Se liquida en el recibo, no al BPS. Default 2% sobre el monto imponible.";

const NOTA_TRANSPORTE =
  "Complemento de transporte (Convenio SUNCA, art. 10): pago al obrero por el costo del transporte hasta la obra. 4,37% del jornal de referencia por jornada trabajada. Se liquida en el recibo, no al BPS. Default 4,37% sobre el monto imponible (aproximación práctica).";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtMoneda(v: number, moneda: string): string {
  if (!v) return "—";
  const fmt = Math.round(v).toLocaleString("es-UY");
  return moneda === "USD" ? `U$S ${fmt}` : `$ ${fmt}`;
}

function fmtPct(v: number): string {
  return (v * 100).toLocaleString("es-UY", { minimumFractionDigits: 1, maximumFractionDigits: 4 });
}

function PctInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
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

function FilaComplemento({
  concepto,
  pct,
  onPctChange,
  monto,
  moneda,
  base,
  nota,
  destacado = false,
}: {
  concepto: string;
  pct: number;
  onPctChange?: (v: number) => void;
  monto: number;
  moneda: string;
  base?: number;
  nota?: string;
  destacado?: boolean;
}) {
  return (
    <div className={cn(
      "flex flex-wrap items-center gap-y-0.5 px-4 py-1.5",
      destacado ? "bg-slate-50 border-t border-slate-200" : "border-b border-slate-50 last:border-0"
    )}>
      <div className="basis-full sm:basis-0 sm:flex-1 min-w-0 sm:min-w-[7rem] leading-tight">
        <span className={cn("text-sm", destacado ? "font-bold text-[#1A3A5C] uppercase tracking-wide text-xs" : "text-slate-700")}>
          {concepto}
        </span>
        {nota && <NotaInfoIcono texto={nota} />}
      </div>
      {/* Columna código — vacía pero mantiene el ancho para alinear con la tarjeta BPS */}
      <div className="text-[11px] text-slate-400 tabular-nums mr-auto sm:mr-0" style={{ width: 64 }} />
      <div className="text-right" style={{ width: 80 }}>
        {onPctChange ? (
          <PctInput value={pct} onChange={onPctChange} />
        ) : (
          <span className="text-sm font-semibold tabular-nums text-slate-600">{fmtPct(pct)}%</span>
        )}
      </div>
      <div className={cn(
        "text-right tabular-nums pl-3",
        destacado ? "text-base font-bold text-[#1A3A5C]" : "text-sm font-semibold text-[#2563EB]"
      )} style={{ width: 110 }}>
        {fmtMoneda(monto, moneda)}
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function SeccionComplementosSalariales({
  moneda,
  data,
  onChange,
  onGuardar,
  guardando,
}: Props) {
  const [expandido, setExpandido] = useState(false);

  const base = data.montoImponibleMO;

  const montoHorasLluvia          = base * data.horasLluviaPct;
  const montoDesgasteRopa         = base * data.desgasteRopaPct;
  const montoDesgasteHerramientas = base * data.desgasteHerramientasPct;
  const montoTransporte           = base * data.complementoTransportePct;

  const pctTotal =
    data.horasLluviaPct + data.desgasteRopaPct +
    data.desgasteHerramientasPct + data.complementoTransportePct;
  const total =
    montoHorasLluvia + montoDesgasteRopa +
    montoDesgasteHerramientas + montoTransporte;

  const set = <K extends keyof ComplementosSalarialesData>(field: K, value: ComplementosSalarialesData[K]) =>
    onChange({ ...data, [field]: value });

  return (
    <div id="seccion-complementos-salariales" className="mt-3 bg-white rounded-[16px] border border-slate-200 shadow-sm overflow-hidden scroll-mt-6">
      {/* Header colapsable */}
      <button
        onClick={() => setExpandido((p) => !p)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors text-left group"
      >
        <div className="flex items-center gap-2.5">
          <Users className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">Complementos salariales</h2>
          <span className="text-[11px] font-normal text-slate-400 normal-case tracking-normal">Convenio SUNCA — pagos al obrero en recibo</span>
        </div>
        <div className="flex items-center gap-3">
          {!!total && (
            <span className="text-lg font-bold text-[#1A3A5C] tabular-nums">{fmtMoneda(total, moneda)}</span>
          )}
          <span className="text-slate-400 group-hover:text-slate-600 transition-colors">
            {expandido ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </span>
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
            <div className="px-5 py-5 space-y-4" style={{ background: "#F8FAFC" }}>

              <p className="text-xs text-slate-500">
                Complementos que el empleador liquida al obrero en el recibo de sueldo. No son aportes al BPS.
                Se expresan como porcentaje sobre el monto imponible de mano de obra (misma base que los aportes patronales).
              </p>

              <div className="rounded-[10px] border border-slate-200 bg-white overflow-hidden max-w-xl">
                <FilaComplemento concepto="Horas de lluvia y barro"  pct={data.horasLluviaPct}          onPctChange={(v) => set("horasLluviaPct", v)}          monto={montoHorasLluvia}          moneda={moneda} base={base} nota={NOTA_HORAS_LLUVIA} />
                <FilaComplemento concepto="Desgaste de ropa"         pct={data.desgasteRopaPct}         onPctChange={(v) => set("desgasteRopaPct", v)}         monto={montoDesgasteRopa}         moneda={moneda} base={base} nota={NOTA_DESGASTE_ROPA} />
                <FilaComplemento concepto="Desgaste de herramientas" pct={data.desgasteHerramientasPct} onPctChange={(v) => set("desgasteHerramientasPct", v)} monto={montoDesgasteHerramientas} moneda={moneda} base={base} nota={NOTA_DESGASTE_HERRAMIENTAS} />
                <FilaComplemento concepto="Complemento transporte"   pct={data.complementoTransportePct} onPctChange={(v) => set("complementoTransportePct", v)} monto={montoTransporte}         moneda={moneda} base={base} nota={NOTA_TRANSPORTE} />
                <FilaComplemento concepto="TOTAL Complementos" pct={pctTotal} monto={total} moneda={moneda} destacado />
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
