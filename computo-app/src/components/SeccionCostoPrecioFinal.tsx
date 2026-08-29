"use client";

import { useState } from "react";
import { Calculator, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { normalizarCategoriasGastosGenerales, type CategoriaGastoGeneral } from "@/lib/gastosGenerales";

interface Props {
  moneda: string;
  costoDirecto: number;
  // "estimado" si al menos un rubro no tiene APU propio (ver
  // calcularCostoDirectoAgregado en costoAgregado.ts) — ese rubro entra
  // completo como Costo Directo, sin poder separar cuánto sería Utilidad.
  metodoCostoDirecto: "apu" | "estimado";
  rubrosSinApu: number;
  modoGastosGenerales: "PORCENTAJE" | "DETALLADO";
  gastosGeneralesPctDefault: number | null;
  gastosGeneralesDetallado: CategoriaGastoGeneral[] | null;
  costosIndirectos: number;
  utilidadAgregada: number;
}

function fmtMoneda(v: number, moneda: string): string {
  if (!v) return "—";
  const fmt = Math.round(v).toLocaleString("es-UY");
  return moneda === "USD" ? `U$S ${fmt}` : `$ ${fmt}`;
}

export default function SeccionCostoPrecioFinal({
  moneda,
  costoDirecto,
  metodoCostoDirecto,
  rubrosSinApu,
  modoGastosGenerales,
  gastosGeneralesPctDefault,
  gastosGeneralesDetallado,
  costosIndirectos,
  utilidadAgregada,
}: Props) {
  const [desgloseIndirectosAbierto, setDesgloseIndirectosAbierto] = useState(false);

  const costoTotal = costoDirecto + costosIndirectos;
  const baseImponible = costoTotal + utilidadAgregada;
  const precioFinal = baseImponible * 1.22;

  const categorias =
    modoGastosGenerales === "DETALLADO" ? normalizarCategoriasGastosGenerales(gastosGeneralesDetallado) : null;
  const pctEfectivo = gastosGeneralesPctDefault ?? 15;

  return (
    <div className="mt-2 bg-white rounded-[16px] border-2 border-[#1A3A5C] shadow-sm overflow-hidden">
      <div className="px-5 py-4">
        <div className="flex items-center gap-2.5 mb-3">
          <Calculator className="w-4 h-4 text-[#2563EB]" />
          <h2 className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">Costo y Precio Final</h2>
        </div>

        {metodoCostoDirecto === "estimado" && (
          <div className="flex items-start gap-2 rounded-[8px] bg-amber-50 border border-amber-200 px-3 py-2 mb-3">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              {rubrosSinApu} rubro{rubrosSinApu !== 1 ? "s" : ""} sin Análisis de Precio Unitario — se usó su precio
              cargado a mano como Costo Directo completo, sin poder separar cuánto de eso sería Utilidad.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between text-sm py-1.5">
          <span className="text-slate-500">Costo Directo</span>
          <span className="font-semibold tabular-nums text-slate-700">{fmtMoneda(costoDirecto, moneda)}</span>
        </div>

        <div className="rounded-[10px] border border-slate-200 bg-slate-50/60 px-3 py-2 my-1">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-slate-500 truncate">Costos Indirectos (Gastos Generales)</span>
              <span className="text-[11px] text-slate-400 flex-shrink-0">
                {modoGastosGenerales === "DETALLADO" ? "(detallado)" : `(${pctEfectivo}%)`}
              </span>
            </div>
            <span className="font-semibold tabular-nums text-slate-700 flex-shrink-0 pl-2">
              {fmtMoneda(costosIndirectos, moneda)}
            </span>
          </div>

          {modoGastosGenerales === "DETALLADO" && categorias && (
            <>
              <button
                onClick={() => setDesgloseIndirectosAbierto((p) => !p)}
                className="flex items-center gap-1 mt-2 text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors"
              >
                {desgloseIndirectosAbierto ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                Ver desglose
              </button>
              <AnimatePresence initial={false}>
                {desgloseIndirectosAbierto && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 space-y-1">
                      {categorias.map((cat) => {
                        const subtotal = cat.items.reduce((s, it) => s + (it.monto || 0), 0);
                        return (
                          <div key={cat.id} className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                            <span className="truncate">{cat.nombre}</span>
                            <span className="tabular-nums font-medium text-slate-600 flex-shrink-0">
                              {fmtMoneda(subtotal, moneda)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>

        <div className="flex items-center justify-between py-1.5 border-t border-slate-200">
          <span className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">Costo Total</span>
          <span className="text-base font-bold tabular-nums text-[#1A3A5C]">{fmtMoneda(costoTotal, moneda)}</span>
        </div>

        <div className="flex items-center justify-between text-sm py-1.5">
          <span className="text-slate-500">Utilidad</span>
          <span className="font-semibold tabular-nums text-slate-700">{fmtMoneda(utilidadAgregada, moneda)}</span>
        </div>

        <div className="flex items-center justify-between py-1.5 border-t border-slate-200">
          <span className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">Base Imponible</span>
          <span className="text-base font-bold tabular-nums text-[#1A3A5C]">{fmtMoneda(baseImponible, moneda)}</span>
        </div>

        <div className="flex items-center justify-between pt-3 mt-2 border-t-2 border-[#1A3A5C]">
          <span className="text-sm font-bold uppercase tracking-wide text-[#2563EB]">Precio Final (+IVA 22%)</span>
          <span className="text-xl font-bold text-[#2563EB]">{fmtMoneda(precioFinal, moneda)}</span>
        </div>
      </div>
    </div>
  );
}
