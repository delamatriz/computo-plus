"use client";

import { useMemo, useState } from "react";
import { Lock, Loader2, RefreshCw, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface RubroAfectado {
  rubroId: string;
  codigo: string;
  descripcion: string;
  precioUnitAnterior: number;
  precioUnitVigente: number;
  diffPct: number;
  cambiaMateriales: boolean;
  cambiaManoObra: boolean;
}

interface ProyectoAfectado {
  proyectoId: string;
  nombre: string;
  moneda: string;
  finalizado: boolean;
  rubros: RubroAfectado[];
}

interface DryRunResultado {
  proyectos: ProyectoAfectado[];
  totalProyectos: number;
  totalRubros: number;
}

interface ResultadoApply {
  actualizados: number;
  errores: { rubroId: string; motivo: string }[];
}

function fmtMoneda(v: number, moneda: string): string {
  if (v === 0) return "—";
  const fmt = Math.round(v).toLocaleString("es-UY");
  return moneda === "USD" ? `U$S ${fmt}` : `$ ${fmt}`;
}

export default function SeccionAplicarPreciosVigentes() {
  const [estado, setEstado] = useState<"cerrado" | "revisando">("cerrado");
  const [cargandoDryRun, setCargandoDryRun] = useState(false);
  const [datos, setDatos] = useState<DryRunResultado | null>(null);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [mostrarConfirm, setMostrarConfirm] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [resultadoApply, setResultadoApply] = useState<ResultadoApply | null>(null);

  const abrirRevision = async () => {
    setCargandoDryRun(true);
    setError(null);
    setResultadoApply(null);
    try {
      const res = await fetch("/api/configuracion/aplicar-precios-vigentes/dry-run");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: DryRunResultado = await res.json();
      setDatos(data);
      // Tildados por defecto todos los rubros de proyectos NO finalizados —
      // los de un proyecto entregado se muestran pero arrancan destildados,
      // porque aplicar ahí fallaría (ver guard 403 en el endpoint de apply)
      // hasta que alguien apriete "Habilitar edición" en ese proyecto.
      const inicial = new Set<string>();
      for (const p of data.proyectos) {
        if (p.finalizado) continue;
        for (const r of p.rubros) inicial.add(r.rubroId);
      }
      setSeleccionados(inicial);
      setEstado("revisando");
    } catch {
      setError("No se pudo calcular qué presupuestos están desactualizados. Probá de nuevo.");
    } finally {
      setCargandoDryRun(false);
    }
  };

  const cerrar = () => {
    setEstado("cerrado");
    setDatos(null);
    setResultadoApply(null);
    setError(null);
  };

  const toggleRubro = (rubroId: string) => {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(rubroId)) next.delete(rubroId);
      else next.add(rubroId);
      return next;
    });
  };

  const toggleProyecto = (proyecto: ProyectoAfectado) => {
    if (proyecto.finalizado) return;
    setSeleccionados((prev) => {
      const next = new Set(prev);
      const todosMarcados = proyecto.rubros.every((r) => next.has(r.rubroId));
      for (const r of proyecto.rubros) {
        if (todosMarcados) next.delete(r.rubroId);
        else next.add(r.rubroId);
      }
      return next;
    });
  };

  const totalSeleccionados = seleccionados.size;

  const proyectosConSeleccion = useMemo(() => {
    if (!datos) return 0;
    return datos.proyectos.filter((p) => p.rubros.some((r) => seleccionados.has(r.rubroId))).length;
  }, [datos, seleccionados]);

  const aplicarSeleccionados = async () => {
    setAplicando(true);
    setError(null);
    try {
      const res = await fetch("/api/configuracion/aplicar-precios-vigentes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rubroIds: Array.from(seleccionados) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ResultadoApply = await res.json();
      setResultadoApply(data);
      setMostrarConfirm(false);
    } catch {
      setError("No se pudo aplicar la actualización. Probá de nuevo.");
      setMostrarConfirm(false);
    } finally {
      setAplicando(false);
    }
  };

  return (
    <section className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
      <h2 className="text-lg font-semibold text-[#1E293B] mb-1">Aplicar a presupuestos existentes</h2>
      <p className="text-sm text-slate-500 mb-4">
        Revisá y actualizá los presupuestos ya entregados cuyos materiales o jornales quedaron desactualizados
        respecto a la Lista MTOP y el Convenio SUNCA vigentes.
      </p>

      <button
        onClick={abrirRevision}
        disabled={cargandoDryRun}
        className="inline-flex items-center gap-2 bg-[#2563EB] text-white text-sm font-medium px-3.5 py-2 rounded-lg hover:bg-[#1d4ed8] disabled:opacity-60 transition-colors"
      >
        {cargandoDryRun ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        {cargandoDryRun ? "Revisando presupuestos…" : "Aplicar a presupuestos existentes"}
      </button>

      {error && !datos && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 rounded-lg px-3 py-2.5 mt-3 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Pantalla de revisión ── */}
      {estado === "revisando" && datos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl max-h-[85vh] bg-white rounded-2xl shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
              <h3 className="text-base font-bold text-[#1A3A5C]">Revisión antes de aplicar</h3>
              <button onClick={cerrar} className="text-slate-400 hover:text-slate-600 transition-colors">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {resultadoApply ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-4 py-3 text-sm">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>
                      Se actualizaron <strong>{resultadoApply.actualizados}</strong> rubro
                      {resultadoApply.actualizados === 1 ? "" : "s"} correctamente.
                    </span>
                  </div>
                  {resultadoApply.errores.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
                      <p className="font-medium mb-1.5">
                        {resultadoApply.errores.length} rubro{resultadoApply.errores.length === 1 ? "" : "s"} no{" "}
                        {resultadoApply.errores.length === 1 ? "se pudo" : "se pudieron"} actualizar:
                      </p>
                      <ul className="space-y-1">
                        {resultadoApply.errores.map((e) => (
                          <li key={e.rubroId} className="flex items-start gap-1.5">
                            <XCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                            <span>{e.motivo}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : datos.totalRubros === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
                  <p className="text-sm font-medium text-[#1E293B] mb-1">
                    No hay presupuestos pendientes de actualización.
                  </p>
                  <p className="text-xs text-slate-400">
                    Todos los rubros con precio pactado ya reflejan los precios y jornales vigentes.
                  </p>
                </div>
              ) : (
                <>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 mb-4 text-sm text-slate-600">
                    <strong className="text-[#1E293B]">{datos.totalRubros}</strong> rubro
                    {datos.totalRubros === 1 ? "" : "s"} desactualizado{datos.totalRubros === 1 ? "" : "s"} en{" "}
                    <strong className="text-[#1E293B]">{datos.totalProyectos}</strong> proyecto
                    {datos.totalProyectos === 1 ? "" : "s"} — {totalSeleccionados} tildado
                    {totalSeleccionados === 1 ? "" : "s"} para aplicar.
                  </div>

                  <div className="space-y-4">
                    {datos.proyectos.map((p) => (
                      <div key={p.proyectoId} className="border border-slate-200 rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between bg-slate-50 px-4 py-2.5 border-b border-slate-200">
                          <label className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={p.rubros.every((r) => seleccionados.has(r.rubroId))}
                              disabled={p.finalizado}
                              onChange={() => toggleProyecto(p)}
                              className="rounded border-slate-300 disabled:opacity-40"
                            />
                            <span className="text-sm font-semibold text-[#1E293B] truncate">{p.nombre}</span>
                            <span className="text-xs text-slate-400 flex-shrink-0">
                              ({p.rubros.length} rubro{p.rubros.length === 1 ? "" : "s"})
                            </span>
                          </label>
                          {p.finalizado && (
                            <span
                              className="flex-shrink-0 flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 whitespace-nowrap"
                              title="Este proyecto fue entregado y está de solo lectura — habilitá edición desde el proyecto para poder aplicar acá."
                            >
                              <Lock className="w-3 h-3" /> Entregado — habilitá edición primero
                            </span>
                          )}
                        </div>
                        <table className="w-full text-sm">
                          <tbody>
                            {p.rubros.map((r) => (
                              <tr key={r.rubroId} className="border-b border-slate-100 last:border-0">
                                <td className="py-2 px-4 w-8">
                                  <input
                                    type="checkbox"
                                    checked={seleccionados.has(r.rubroId)}
                                    disabled={p.finalizado}
                                    onChange={() => toggleRubro(r.rubroId)}
                                    className="rounded border-slate-300 disabled:opacity-40"
                                  />
                                </td>
                                <td className="py-2 px-2">
                                  <p className="text-[#1E293B]">{r.descripcion}</p>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    {r.cambiaMateriales && (
                                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                                        Materiales
                                      </span>
                                    )}
                                    {r.cambiaManoObra && (
                                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                                        Mano de obra
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2 px-2 text-right whitespace-nowrap tabular-nums">
                                  <span className="text-slate-500">{fmtMoneda(r.precioUnitAnterior, p.moneda)}</span>
                                  <span className="text-slate-300 mx-1">→</span>
                                  <span className="font-semibold text-[#1E293B]">
                                    {fmtMoneda(r.precioUnitVigente, p.moneda)}
                                  </span>
                                  {r.diffPct !== 0 && (
                                    <span
                                      className={cn(
                                        "ml-1.5 text-xs font-medium",
                                        r.diffPct > 0 ? "text-amber-600" : "text-emerald-600"
                                      )}
                                    >
                                      ({r.diffPct > 0 ? "+" : ""}
                                      {r.diffPct.toFixed(1)}%)
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 rounded-lg px-3 py-2.5 mt-4 text-sm">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 flex-shrink-0">
              <button
                onClick={cerrar}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-50 transition-colors"
              >
                {resultadoApply ? "Cerrar" : "Cancelar"}
              </button>
              {!resultadoApply && datos.totalRubros > 0 && (
                <button
                  onClick={() => setMostrarConfirm(true)}
                  disabled={totalSeleccionados === 0}
                  className="bg-[#2563EB] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#1d4ed8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Aplicar cambios seleccionados
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmación final — esto escribe sobre presupuestos reales ── */}
      {mostrarConfirm && datos && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4"
          onClick={() => !aplicando && setMostrarConfirm(false)}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-[#1A3A5C] mb-2">Confirmar actualización masiva</h3>
            <p className="text-sm text-slate-600 mb-6">
              Esto va a actualizar <strong>{totalSeleccionados}</strong> rubro{totalSeleccionados === 1 ? "" : "s"}{" "}
              en <strong>{proyectosConSeleccion}</strong> proyecto{proyectosConSeleccion === 1 ? "" : "s"}. Esta
              acción no se puede deshacer masivamente — solo rubro por rubro, a mano, desde cada proyecto. ¿Continuar?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setMostrarConfirm(false)}
                disabled={aplicando}
                className="px-4 py-2.5 rounded-lg text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                onClick={aplicarSeleccionados}
                disabled={aplicando}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1d4ed8] transition-colors disabled:opacity-60"
              >
                {aplicando && <Loader2 className="w-4 h-4 animate-spin" />}
                {aplicando ? "Aplicando…" : "Sí, aplicar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
