"use client";

import { useState } from "react";
import { ClipboardList, ChevronDown, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface CapituloResumen {
  id: string;
  nombre: string;
  codigo?: string;
  subtotal: number;
}

interface Props {
  moneda: string;
  capitulos: CapituloResumen[];
  // Mismos valores ya calculados que recibe/usa la cascada de tarjetas
  // (SeccionCostoPrecioFinal, fuente de verdad) y Leyes Sociales/BPS —
  // acá solo se muestran como filas de solo lectura, sin recalcular ni
  // reimplementar ninguna fórmula.
  costoDirecto: number;
  montoGastosGeneralesYBeneficio: number;
  costoTotal: number;
  montoIVA: number;
  precioFinal: number;
  montoLeyesSociales: number | null;
}

function fmtMoneda(v: number, moneda: string): string {
  if (!v) return "—";
  const fmt = Math.round(v).toLocaleString("es-UY");
  return moneda === "USD" ? `U$S ${fmt}` : `$ ${fmt}`;
}

// Antes esta sección tenía sus propias versiones editables de Gastos
// Generales (Timbres CJP, Ítems extra) y de AUC Propietario, con fórmula
// propia que llegó a desincronizarse de la cascada (ej. "SUBTOTAL GASTOS
// GENERALES" mostraba "—" aunque el Costo Indirecto ya estuviera sumado
// correctamente arriba, por el fix de GG% en modo Porcentaje). Timbres
// CJP e Ítems extra se mudaron a SeccionGastosGeneralesUtilidades.tsx (la
// tarjeta real, con edición). Acá queda: el desglose por capítulo (lo
// único que no está en ningún otro lado) y, debajo, un espejo de solo
// lectura de la misma cascada de arriba — mismos valores recibidos por
// props, sin recalcular ni editar nada.
export default function SeccionResumenPresupuesto({
  moneda,
  capitulos,
  costoDirecto,
  montoGastosGeneralesYBeneficio,
  costoTotal,
  montoIVA,
  precioFinal,
  montoLeyesSociales,
}: Props) {
  const [expandido, setExpandido] = useState(false);

  const capitulosConTotal = capitulos.filter((c) => c.subtotal > 0);

  const filasCascada: { label: string; monto: number | null }[] = [
    { label: "Costo Directo", monto: costoDirecto },
    { label: "Gastos Generales y Beneficio", monto: montoGastosGeneralesYBeneficio },
    { label: "Costo Total", monto: costoTotal },
    { label: "IVA (22%)", monto: montoIVA },
    { label: "Precio Final", monto: precioFinal },
    { label: "Leyes Sociales / BPS", monto: montoLeyesSociales },
  ];

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
            <div className="px-5 py-5" style={{ background: "#F8FAFC" }}>
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
              </div>

              {/* Espejo de solo lectura de la cascada de tarjetas de arriba
                  y de Leyes Sociales/BPS — mismos valores por props, sin
                  editar nada acá (Timbres/Ítems extra/% Utilidad viven en
                  la tarjeta real, "Gastos Generales y Beneficio"). */}
              <div className="rounded-[10px] border border-slate-200 bg-white overflow-hidden mt-3">
                {filasCascada.map((fila) => (
                  <div
                    key={fila.label}
                    className="flex items-center px-4 py-1.5 border-b border-slate-50 last:border-0"
                  >
                    <div className="flex-1 min-w-0 text-sm text-slate-700">{fila.label}</div>
                    <div className="text-sm font-semibold tabular-nums text-[#2563EB] pl-3">
                      {fila.monto != null ? fmtMoneda(fila.monto, moneda) : "—"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
