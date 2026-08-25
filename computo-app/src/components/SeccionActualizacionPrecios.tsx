"use client";

import { useState } from "react";
import { TrendingUp, ChevronDown, ChevronRight, Loader2, Search, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function fmtMoneda(v: number, moneda: string): string {
  if (v === 0) return "—";
  const fmt = Math.round(v).toLocaleString("es-UY");
  return moneda === "USD" ? `U$S ${fmt}` : `$ ${fmt}`;
}

interface Props {
  proyectoId: string;
  moneda: string;
  totalActual: number;
  fechaBaseDefault: string | null;
  ultimaActualizacionIndice: string | null;
}

interface ResultadoConsulta {
  factor: number;
  indiceBase: number;
  indiceActual: number;
  mesBase: string;
  mesActual: string;
  totalActual: number;
  totalProyectado: number;
}

export default function SeccionActualizacionPrecios({
  proyectoId,
  moneda,
  totalActual,
  fechaBaseDefault,
  ultimaActualizacionIndice,
}: Props) {
  const [expandido, setExpandido] = useState(false);
  const [fechaBase, setFechaBase] = useState(fechaBaseDefault ?? "");
  const [consultando, setConsultando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoConsulta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [aplicado, setAplicado] = useState(false);

  async function consultar() {
    if (!fechaBase) return;
    setConsultando(true);
    setError(null);
    setResultado(null);
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/actualizar-precios-indice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fechaBase }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? "No se pudo consultar el ICCV. Probá de nuevo.");
        return;
      }
      setResultado(data);
    } catch {
      setError("No se pudo consultar el ICCV. Probá de nuevo.");
    } finally {
      setConsultando(false);
    }
  }

  async function aplicar() {
    if (!resultado) return;
    setAplicando(true);
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/actualizar-precios-indice`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factor: resultado.factor }),
      });
      if (!res.ok) throw new Error();
      setMostrarModal(false);
      setAplicado(true);
      window.location.reload();
    } catch {
      setError("No se pudo aplicar la actualización de precios.");
      setAplicando(false);
    }
  }

  return (
    <div className="mt-6 bg-white rounded-[16px] border border-slate-300 shadow-sm overflow-hidden">
      {/* Header colapsable */}
      <button
        onClick={() => setExpandido((p) => !p)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors text-left group"
      >
        <div className="flex items-center gap-2.5">
          <TrendingUp className="w-4 h-4 text-[#2563EB]" />
          <h2 className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">Actualización de precios por índice ICCV</h2>
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
              <p className="text-xs text-slate-500 mb-4">
                Actualizá los precios unitarios del presupuesto según la variación del
                Índice de Costo de la Construcción de Vivienda (ICCV) publicado por el INE,
                entre la fecha base del presupuesto y el mes más reciente disponible.
              </p>

              {ultimaActualizacionIndice && (
                <p className="text-xs text-slate-500 mb-4">
                  Última actualización aplicada:{" "}
                  <span className="font-medium text-slate-700">
                    {new Date(ultimaActualizacionIndice).toLocaleDateString("es-UY", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </p>
              )}

              <div className="flex items-end gap-3 mb-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">
                    Fecha base del presupuesto
                  </label>
                  <input
                    type="month"
                    value={fechaBase}
                    onChange={(e) => setFechaBase(e.target.value)}
                    className="rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                  />
                </div>
                <button
                  onClick={consultar}
                  disabled={consultando || !fechaBase}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1A3A5C] transition-colors disabled:opacity-60"
                >
                  {consultando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  {consultando ? "Consultando..." : "Consultar ICCV"}
                </button>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-[10px] bg-amber-50 border border-amber-200 px-4 py-3 mb-4">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-800">{error}</p>
                </div>
              )}

              {aplicado && (
                <div className="rounded-[10px] bg-green-50 border border-green-200 px-4 py-3 mb-4">
                  <p className="text-xs text-green-700">Precios actualizados correctamente.</p>
                </div>
              )}

              {resultado && (
                <div className="rounded-[12px] border border-slate-200 bg-white p-4">
                  <p className="text-sm text-slate-700 mb-3">
                    ICCV {resultado.mesBase}: <span className="font-semibold">{resultado.indiceBase}</span>
                    {" → "}
                    ICCV {resultado.mesActual}: <span className="font-semibold">{resultado.indiceActual}</span>
                    {" "}(factor <span className="font-semibold text-[#2563EB]">{resultado.factor.toFixed(4)}</span>)
                  </p>

                  <div className="flex items-center justify-between gap-4 mb-4 rounded-[10px] bg-slate-50 px-4 py-3">
                    <div>
                      <p className="text-xs text-slate-500">Total actual</p>
                      <p className="text-sm font-semibold text-slate-700">{fmtMoneda(resultado.totalActual, moneda)}</p>
                    </div>
                    <span className="text-slate-400">→</span>
                    <div>
                      <p className="text-xs text-slate-500">Total proyectado actualizado</p>
                      <p className="text-sm font-semibold text-[#1A3A5C]">{fmtMoneda(resultado.totalProyectado, moneda)}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => setMostrarModal(true)}
                    className="px-4 py-2.5 rounded-[10px] bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1A3A5C] transition-colors"
                  >
                    Aplicar actualización a todos los precios
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de confirmación */}
      <AnimatePresence>
        {mostrarModal && resultado && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
            onClick={() => !aplicando && setMostrarModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-[16px] shadow-xl max-w-md w-full p-6"
            >
              <h3 className="text-base font-bold text-[#1A3A5C] mb-2">Confirmar actualización de precios</h3>
              <p className="text-sm text-slate-600 mb-6">
                Esto multiplicará todos los precios unitarios por{" "}
                <span className="font-semibold">{resultado.factor.toFixed(4)}</span>. Esta acción
                no se puede deshacer automáticamente. ¿Continuar?
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setMostrarModal(false)}
                  disabled={aplicando}
                  className="px-4 py-2.5 rounded-[10px] text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  onClick={aplicar}
                  disabled={aplicando}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1A3A5C] transition-colors disabled:opacity-60"
                >
                  {aplicando && <Loader2 className="w-4 h-4 animate-spin" />}
                  {aplicando ? "Aplicando..." : "Actualizar por ICCV"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
