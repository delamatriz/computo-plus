"use client";

import { useState } from "react";
import { TrendingUp, ChevronDown, ChevronRight, Loader2, Search, Calculator, AlertCircle } from "lucide-react";
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

interface ResultadoICCV {
  factor: number;
  indiceBase: number;
  indiceActual: number;
  mesBase: string;
  mesActual: string;
  variante: string;
  totalActual: number;
  totalProyectado: number;
}

interface RubroSinDesglose {
  rubroId: string;
  codigo: string;
  descripcion: string;
}

interface ResultadoParametrica {
  total: number;
  actualizados: number;
  sinDesglose: RubroSinDesglose[];
  errores: { rubroId: string; motivo: string }[];
  totalActualAntes: number;
  totalProyectadoDespues: number;
}

// Dos métodos independientes para actualizar precios de un presupuesto
// existente, ninguno reemplaza al otro (ver relevamiento):
// - ICCV: un único factor (índice INE) sobre TODO el presupuesto — rápido,
//   pero no distingue qué rubro tiene qué mezcla de materiales.
// - Paramétrica: recalcula cada rubro contra sus precios de biblioteca
//   vigentes (PrecioMTOP/CategoriaLaboral) — más preciso, pero un rubro
//   sin descompuesto (APU) no tiene nada de qué partir y queda afuera
//   (se avisa, nunca se oculta).
export default function SeccionActualizacionPrecios({
  proyectoId,
  moneda,
  totalActual,
  fechaBaseDefault,
  ultimaActualizacionIndice,
}: Props) {
  const [expandido, setExpandido] = useState(false);

  // ── ICCV ──
  const [fechaBase, setFechaBase] = useState(fechaBaseDefault ?? "");
  const [consultando, setConsultando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoICCV | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [aplicado, setAplicado] = useState(false);

  // ── Paramétrica ──
  const [consultandoParam, setConsultandoParam] = useState(false);
  const [resultadoParam, setResultadoParam] = useState<ResultadoParametrica | null>(null);
  const [errorParam, setErrorParam] = useState<string | null>(null);
  const [mostrarModalParam, setMostrarModalParam] = useState(false);
  const [aplicandoParam, setAplicandoParam] = useState(false);
  const [aplicadoParam, setAplicadoParam] = useState<{ actualizados: number; sinDesglose: RubroSinDesglose[] } | null>(null);

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

  async function consultarParametrica() {
    setConsultandoParam(true);
    setErrorParam(null);
    setResultadoParam(null);
    try {
      const res = await fetch("/api/configuracion/aplicar-precios-vigentes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proyectoId, dryRun: true }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setErrorParam(data.error ?? "No se pudo calcular la actualización paramétrica. Probá de nuevo.");
        return;
      }
      setResultadoParam(data);
    } catch {
      setErrorParam("No se pudo calcular la actualización paramétrica. Probá de nuevo.");
    } finally {
      setConsultandoParam(false);
    }
  }

  async function aplicarParametrica() {
    setAplicandoParam(true);
    try {
      const res = await fetch("/api/configuracion/aplicar-precios-vigentes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proyectoId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error();
      setMostrarModalParam(false);
      setAplicadoParam({ actualizados: data.actualizados, sinDesglose: data.sinDesglose ?? [] });
      setResultadoParam(null);
    } catch {
      setErrorParam("No se pudo aplicar la actualización paramétrica.");
    } finally {
      setAplicandoParam(false);
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
          <h2 className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">Actualización de precios del presupuesto</h2>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* ── Columna ICCV ── */}
                <div className="rounded-[12px] border border-slate-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-[#1A3A5C] mb-1">Índice ICCV</h3>
                  <p className="text-xs text-slate-500 mb-3">
                    Ajuste rápido con el índice oficial del INE — aplica el mismo factor a todo el
                    presupuesto, sin distinguir de qué está hecho cada rubro.
                  </p>
                  <div className="flex items-end gap-2 mb-2">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-slate-500 mb-1.5">
                        Fecha base del presupuesto
                      </label>
                      <input
                        type="month"
                        value={fechaBase}
                        onChange={(e) => setFechaBase(e.target.value)}
                        className="w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                      />
                    </div>
                  </div>
                  <button
                    onClick={consultar}
                    disabled={consultando || !fechaBase}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-[10px] bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1A3A5C] transition-colors disabled:opacity-60"
                  >
                    {consultando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    {consultando ? "Consultando..." : "Actualizar por ICCV"}
                  </button>

                  {error && (
                    <div className="flex items-start gap-2 rounded-[10px] bg-amber-50 border border-amber-200 px-3 py-2.5 mt-3">
                      <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-amber-800">{error}</p>
                    </div>
                  )}

                  {aplicado && (
                    <div className="rounded-[10px] bg-green-50 border border-green-200 px-3 py-2.5 mt-3">
                      <p className="text-xs text-green-700">Precios actualizados correctamente.</p>
                    </div>
                  )}

                  {resultado && (
                    <div className="mt-3">
                      <p className="text-xs text-slate-700 mb-2">
                        ICCV {resultado.mesBase}: <span className="font-semibold">{resultado.indiceBase}</span>
                        {" → "}
                        ICCV {resultado.mesActual}: <span className="font-semibold">{resultado.indiceActual}</span>
                        {" "}(factor <span className="font-semibold text-[#2563EB]">{resultado.factor.toFixed(4)}</span>)
                        {resultado.variante && (
                          <>
                            {" — "}
                            <span className="font-semibold">{resultado.variante}</span>
                          </>
                        )}
                      </p>
                      <div className="flex items-center justify-between gap-3 mb-3 rounded-[10px] bg-slate-50 px-3 py-2.5">
                        <div>
                          <p className="text-[10px] text-slate-500">Total actual</p>
                          <p className="text-xs font-semibold text-slate-700">{fmtMoneda(resultado.totalActual, moneda)}</p>
                        </div>
                        <span className="text-slate-400">→</span>
                        <div>
                          <p className="text-[10px] text-slate-500">Total proyectado</p>
                          <p className="text-xs font-semibold text-[#1A3A5C]">{fmtMoneda(resultado.totalProyectado, moneda)}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setMostrarModal(true)}
                        className="w-full px-4 py-2 rounded-[10px] bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1A3A5C] transition-colors"
                      >
                        Aplicar actualización por ICCV
                      </button>
                    </div>
                  )}
                </div>

                {/* ── Columna Paramétrica ── */}
                <div className="rounded-[12px] border border-slate-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-[#1A3A5C] mb-1">Fórmula paramétrica</h3>
                  <p className="text-xs text-slate-500 mb-3">
                    Ajuste más preciso — recalcula cada rubro según sus propios materiales y mano de
                    obra reales, pero no cubre rubros sin desglose (APU).
                  </p>
                  <button
                    onClick={consultarParametrica}
                    disabled={consultandoParam}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-[10px] bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1A3A5C] transition-colors disabled:opacity-60"
                  >
                    {consultandoParam ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
                    {consultandoParam ? "Calculando..." : "Actualizar por fórmula paramétrica"}
                  </button>

                  {errorParam && (
                    <div className="flex items-start gap-2 rounded-[10px] bg-amber-50 border border-amber-200 px-3 py-2.5 mt-3">
                      <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-amber-800">{errorParam}</p>
                    </div>
                  )}

                  {aplicadoParam && (
                    <div className="rounded-[10px] bg-green-50 border border-green-200 px-3 py-2.5 mt-3">
                      <p className="text-xs text-green-700">
                        {aplicadoParam.actualizados} de{" "}
                        {aplicadoParam.actualizados + aplicadoParam.sinDesglose.length} rubros actualizados
                        {aplicadoParam.sinDesglose.length > 0 && (
                          <> — {aplicadoParam.sinDesglose.length} sin desglose (APU) quedaron con su precio actual.</>
                        )}
                      </p>
                      {aplicadoParam.sinDesglose.length > 0 && (
                        <ul className="mt-2 space-y-0.5">
                          {aplicadoParam.sinDesglose.map((r) => (
                            <li key={r.rubroId} className="text-[11px] text-green-800">
                              {r.codigo} — {r.descripcion || "Rubro sin nombre"}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {resultadoParam && (
                    <div className="mt-3">
                      <p className="text-xs text-slate-700 mb-2">
                        <span className="font-semibold">{resultadoParam.actualizados}</span> de{" "}
                        <span className="font-semibold">{resultadoParam.total}</span> rubros se actualizarían
                        {resultadoParam.sinDesglose.length > 0 && (
                          <>
                            {" — "}
                            <span className="font-semibold">{resultadoParam.sinDesglose.length}</span> sin
                            desglose (APU) quedarían con su precio actual
                          </>
                        )}
                        .
                      </p>

                      {resultadoParam.sinDesglose.length > 0 && (
                        <div className="rounded-[10px] bg-amber-50 border border-amber-200 px-3 py-2 mb-3">
                          <p className="text-[11px] font-medium text-amber-800 mb-1">Rubros sin desglose (no se tocan):</p>
                          <ul className="space-y-0.5">
                            {resultadoParam.sinDesglose.map((r) => (
                              <li key={r.rubroId} className="text-[11px] text-amber-700">
                                {r.codigo} — {r.descripcion || "Rubro sin nombre"}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-3 mb-3 rounded-[10px] bg-slate-50 px-3 py-2.5">
                        <div>
                          <p className="text-[10px] text-slate-500">Total actual</p>
                          <p className="text-xs font-semibold text-slate-700">{fmtMoneda(resultadoParam.totalActualAntes, moneda)}</p>
                        </div>
                        <span className="text-slate-400">→</span>
                        <div>
                          <p className="text-[10px] text-slate-500">Total proyectado</p>
                          <p className="text-xs font-semibold text-[#1A3A5C]">{fmtMoneda(resultadoParam.totalProyectadoDespues, moneda)}</p>
                        </div>
                      </div>

                      {resultadoParam.actualizados > 0 && (
                        <button
                          onClick={() => setMostrarModalParam(true)}
                          className="w-full px-4 py-2 rounded-[10px] bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1A3A5C] transition-colors"
                        >
                          Aplicar actualización paramétrica
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <p className="text-xs text-slate-400 mt-4">
                El INE publica el ICCV con un rezago de hasta 30 días — el mes actual probablemente
                todavía no tenga dato disponible.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de confirmación — ICCV */}
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
              <h3 className="text-base font-bold text-[#1A3A5C] mb-2">Confirmar actualización por ICCV</h3>
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

      {/* Modal de confirmación — Paramétrica */}
      <AnimatePresence>
        {mostrarModalParam && resultadoParam && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
            onClick={() => !aplicandoParam && setMostrarModalParam(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-[16px] shadow-xl max-w-md w-full p-6"
            >
              <h3 className="text-base font-bold text-[#1A3A5C] mb-2">Confirmar actualización paramétrica</h3>
              <p className="text-sm text-slate-600 mb-6">
                Esto va a recalcular el precio de{" "}
                <span className="font-semibold">{resultadoParam.actualizados} rubro{resultadoParam.actualizados === 1 ? "" : "s"}</span>{" "}
                contra sus precios de biblioteca vigentes
                {resultadoParam.sinDesglose.length > 0 && (
                  <>
                    {" "}({resultadoParam.sinDesglose.length} sin desglose quedan sin tocar)
                  </>
                )}
                . Esta acción no se puede deshacer automáticamente. ¿Continuar?
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setMostrarModalParam(false)}
                  disabled={aplicandoParam}
                  className="px-4 py-2.5 rounded-[10px] text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  onClick={aplicarParametrica}
                  disabled={aplicandoParam}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1A3A5C] transition-colors disabled:opacity-60"
                >
                  {aplicandoParam && <Loader2 className="w-4 h-4 animate-spin" />}
                  {aplicandoParam ? "Aplicando..." : "Actualizar por fórmula paramétrica"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
