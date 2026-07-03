"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Scale, ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

/* ─── Tipos ───────────────────────────────────────────────── */
interface ManoObraAPU {
  jornadaHs: number;
  rendimiento: number;
  jornalRef: number;
}

interface RubroComp {
  id: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  cantidad: number;
  precioUnit: number;
  capituloId: string;
  moCostoTotal: number;
  cantCotizaciones: number;
}

interface CapituloInfo {
  id: string;
  nombre: string;
  codigo?: string;
}

interface Cotizacion {
  id: string;
  rubroId: string;
  proveedor: string;
  montoNeto: number;
  ivaPorcentaje: number;
  leyesSociales: number;
  financiacion: string;
  observaciones: string;
}

interface Props {
  proyectoId: string;
  moneda: string;
}

/* ─── Formato ─────────────────────────────────────────────── */
function fmtMoneda(v: number, moneda: string): string {
  if (!v) return "—";
  const fmt = Math.round(v).toLocaleString("es-UY");
  return moneda === "USD" ? `U$S ${fmt}` : `$ ${fmt}`;
}

function fmtNum(v: number, decimales = 2): string {
  return v.toLocaleString("es-UY", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

const IVA_PCT_DEFAULT = 22;

/* ─── Componente principal ────────────────────────────────── */
export default function SeccionComparativoOfertas({ proyectoId, moneda }: Props) {
  const [expandido, setExpandido] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [capitulos, setCapitulos] = useState<CapituloInfo[]>([]);
  const [rubros, setRubros] = useState<RubroComp[]>([]);
  const [pctLeyesEmpresa, setPctLeyesEmpresa] = useState(0);
  const [rubroActivoId, setRubroActivoId] = useState<string | null>(null);
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [cargandoCotizaciones, setCargandoCotizaciones] = useState(false);
  const [agregando, setAgregando] = useState(false);

  /* ── Carga de rubros + leyes sociales ──────────────────── */
  const cargarDatos = useCallback(async () => {
    try {
      const [resProyecto, resLeyes] = await Promise.all([
        fetch(`/api/proyectos/${proyectoId}`),
        fetch(`/api/proyectos/${proyectoId}/leyes-sociales`),
      ]);
      const proyecto = await resProyecto.json();
      const leyes = await resLeyes.json();

      const pctEmpresa =
        (leyes.focerPatronalPct ?? 0) +
        (leyes.fscFocapPct ?? 0) +
        (leyes.fosvocPct ?? 0) +
        (leyes.frlPct ?? 0) +
        (leyes.fondoGarantiaPct ?? 0) +
        (leyes.snisAdicionalPct ?? 0);
      setPctLeyesEmpresa(pctEmpresa);

      const caps: CapituloInfo[] = [];
      const rubs: RubroComp[] = [];

      for (const cap of proyecto.capitulos ?? []) {
        caps.push({ id: cap.id, nombre: cap.nombre, codigo: cap.codigo });
        for (const r of cap.rubros ?? []) {
          const manoObra: ManoObraAPU[] = r.apu?.manoObra ?? [];
          // jornalRef ya es el costo de la jornada completa — jornadaHs no participa.
          const moCostoPorUnidad = manoObra.reduce(
            (acc, mo) => acc + mo.jornalRef / mo.rendimiento,
            0
          );
          rubs.push({
            id: r.id,
            codigo: r.codigo,
            descripcion: r.descripcion,
            unidad: r.unidad,
            cantidad: r.cantidad ?? 0,
            precioUnit: r.precioUnit ?? 0,
            capituloId: r.capituloId,
            moCostoTotal: moCostoPorUnidad * (r.cantidad ?? 0),
            cantCotizaciones: r._count?.cotizaciones ?? 0,
          });
        }
      }

      setCapitulos(caps);
      setRubros(rubs);
      if (rubs.length > 0) {
        setRubroActivoId((prev) => prev ?? rubs[0].id);
      }
    } catch (err) {
      console.error("[comparativo] error cargando datos", err);
    } finally {
      setCargado(true);
    }
  }, [proyectoId]);

  useEffect(() => {
    if (expandido && !cargado) cargarDatos();
  }, [expandido, cargado, cargarDatos]);

  /* ── Carga de cotizaciones del rubro activo ────────────── */
  const cargarCotizaciones = useCallback(async (rubroId: string) => {
    setCargandoCotizaciones(true);
    try {
      const res = await fetch(`/api/rubros/${rubroId}/cotizaciones`);
      const data = await res.json();
      setCotizaciones(Array.isArray(data.cotizaciones) ? data.cotizaciones : []);
    } catch (err) {
      console.error("[comparativo] error cargando cotizaciones", err);
    } finally {
      setCargandoCotizaciones(false);
    }
  }, []);

  useEffect(() => {
    if (rubroActivoId) cargarCotizaciones(rubroActivoId);
    else setCotizaciones([]);
  }, [rubroActivoId, cargarCotizaciones]);

  /* ── Agregar cotización ─────────────────────────────────── */
  const agregarCotizacion = async () => {
    if (!rubroActivoId) return;
    setAgregando(true);
    try {
      const res = await fetch(`/api/rubros/${rubroActivoId}/cotizaciones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proveedor: "Nuevo proveedor", montoNeto: 0, ivaPorcentaje: IVA_PCT_DEFAULT, leyesSociales: 0 }),
      });
      if (!res.ok) throw new Error("No se pudo crear");
      const nueva: Cotizacion = await res.json();
      setCotizaciones((prev) => [...prev, nueva]);
      setRubros((prev) => prev.map((r) => (r.id === rubroActivoId ? { ...r, cantCotizaciones: r.cantCotizaciones + 1 } : r)));
    } catch (err) {
      console.error("[comparativo] error agregando cotización", err);
    } finally {
      setAgregando(false);
    }
  };

  /* ── Actualizar campo de cotización ────────────────────── */
  const actualizarCotizacion = (id: string, campo: keyof Cotizacion, valor: string | number) => {
    setCotizaciones((prev) => prev.map((c) => (c.id === id ? { ...c, [campo]: valor } : c)));
  };

  const guardarCotizacion = async (id: string, campo: keyof Cotizacion, valor: string | number) => {
    try {
      await fetch(`/api/cotizaciones/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [campo]: valor }),
      });
    } catch (err) {
      console.error("[comparativo] error guardando cotización", err);
    }
  };

  /* ── Eliminar cotización ────────────────────────────────── */
  const eliminarCotizacion = async (id: string) => {
    setCotizaciones((prev) => prev.filter((c) => c.id !== id));
    if (rubroActivoId) {
      setRubros((prev) => prev.map((r) => (r.id === rubroActivoId ? { ...r, cantCotizaciones: Math.max(0, r.cantCotizaciones - 1) } : r)));
    }
    try {
      await fetch(`/api/cotizaciones/${id}`, { method: "DELETE" });
    } catch (err) {
      console.error("[comparativo] error eliminando cotización", err);
    }
  };

  /* ── Agrupar rubros por capítulo ────────────────────────── */
  const gruposPorCapitulo = useMemo(() => {
    const grupos = new Map<string, RubroComp[]>();
    rubros.forEach((r) => {
      if (!grupos.has(r.capituloId)) grupos.set(r.capituloId, []);
      grupos.get(r.capituloId)!.push(r);
    });
    return capitulos
      .filter((c) => grupos.has(c.id))
      .map((c) => ({ capitulo: c, rubros: grupos.get(c.id)! }));
  }, [capitulos, rubros]);

  const rubroActivo = rubros.find((r) => r.id === rubroActivoId) ?? null;

  /* ── "Tu presupuesto" para el rubro activo ─────────────── */
  const tuPresupuesto = useMemo(() => {
    if (!rubroActivo) return null;
    const neto = rubroActivo.cantidad * rubroActivo.precioUnit;
    const leyesSociales = rubroActivo.moCostoTotal * pctLeyesEmpresa;
    const iva = neto * 0.22;
    const total = neto + leyesSociales + iva;
    return { neto, leyesSociales, iva, total };
  }, [rubroActivo, pctLeyesEmpresa]);

  const thCls = "text-[10px] font-semibold text-slate-400 uppercase tracking-wider";

  return (
    <div className="mt-6 bg-white rounded-[16px] border border-slate-300 shadow-sm overflow-hidden">
      {/* Header colapsable */}
      <button
        onClick={() => setExpandido((p) => !p)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors text-left group"
      >
        <div className="flex items-center gap-2.5">
          <Scale className="w-4 h-4 text-[#2563EB]" />
          <h2 className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">Comparativo de ofertas</h2>
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
              <div className="flex flex-col lg:flex-row gap-4 items-start">

                {/* ── Panel izquierdo — lista de rubros ─── */}
                <div className="w-full lg:w-1/3 flex-shrink-0 space-y-3 max-h-[520px] overflow-y-auto pr-1">
                  {rubros.length === 0 ? (
                    <p className="text-xs text-slate-400 italic px-1 py-3">
                      Todavía no hay rubros cargados en este proyecto.
                    </p>
                  ) : (
                    gruposPorCapitulo.map(({ capitulo, rubros: rubrosCap }) => (
                      <div key={capitulo.id}>
                        <div className="px-1 py-1">
                          <span className="text-[11px] font-bold text-[#1A3A5C] uppercase tracking-wider">
                            {capitulo.codigo ? `${capitulo.codigo} · ` : ""}{capitulo.nombre}
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {rubrosCap.map((r) => (
                            <button
                              key={r.id}
                              onClick={() => setRubroActivoId(r.id)}
                              className={cn(
                                "w-full text-left rounded-[10px] border px-3 py-2 transition-colors flex items-center justify-between gap-2",
                                r.id === rubroActivoId ? "border-[#2563EB] bg-[#EFF6FF]" : "border-slate-200 bg-white hover:border-slate-300"
                              )}
                            >
                              <span className="text-xs text-slate-700 truncate">
                                {r.codigo ? `${r.codigo} · ` : ""}{r.descripcion}
                              </span>
                              {r.cantCotizaciones > 0 && (
                                <span className="flex-shrink-0 text-[10px] font-bold text-white bg-[#2563EB] rounded-full px-1.5 py-0.5 min-w-[18px] text-center tabular-nums">
                                  {r.cantCotizaciones}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* ── Panel derecho — comparativo ────────── */}
                <div className="flex-1 min-w-0 rounded-[10px] border border-slate-200 bg-white overflow-hidden">
                  {!rubroActivo ? (
                    <div className="px-6 py-10 text-center text-sm text-slate-400 italic">
                      Seleccioná un rubro para comparar ofertas de proveedores.
                    </div>
                  ) : (
                    <>
                      {/* Header del panel */}
                      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
                        <span className="text-sm font-bold text-[#1A3A5C] truncate">
                          {rubroActivo.codigo ? `${rubroActivo.codigo} · ` : ""}{rubroActivo.descripcion}
                        </span>
                        <button
                          onClick={agregarCotizacion}
                          disabled={agregando}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold transition-colors disabled:opacity-50 flex-shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" /> {agregando ? "Agregando…" : "Agregar cotización"}
                        </button>
                      </div>

                      {/* Tabla comparativa */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-100" style={{ background: "#F8FAFC", height: 30 }}>
                              <th className={cn(thCls, "text-left pl-4 sticky left-0 bg-[#F8FAFC]")} style={{ width: 140, minWidth: 140 }}></th>
                              <th className={cn(thCls, "text-right pr-3")} style={{ width: 140, minWidth: 140 }}>Tu presupuesto</th>
                              {cotizaciones.map((c) => (
                                <th key={c.id} className={cn(thCls, "text-right pr-3")} style={{ width: 160, minWidth: 160 }}>
                                  <div className="flex items-center justify-end gap-1.5">
                                    <input
                                      type="text"
                                      defaultValue={c.proveedor}
                                      onChange={(e) => actualizarCotizacion(c.id, "proveedor", e.target.value)}
                                      onBlur={(e) => guardarCotizacion(c.id, "proveedor", e.target.value)}
                                      placeholder="Proveedor"
                                      className="w-full text-right text-[11px] font-bold text-[#1A3A5C] uppercase tracking-wider bg-white border border-slate-200 rounded-[5px] px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30"
                                    />
                                    <button
                                      onClick={() => eliminarCotizacion(c.id)}
                                      className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0"
                                      title="Eliminar cotización"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {/* Neto */}
                            <tr className="border-b border-slate-50" style={{ height: 32 }}>
                              <td className="pl-4 pr-2 text-slate-500 sticky left-0 bg-white">Neto</td>
                              <td className="text-right pr-3 tabular-nums font-medium text-slate-700">
                                {fmtMoneda(tuPresupuesto?.neto ?? 0, moneda)}
                              </td>
                              {cotizaciones.map((c) => (
                                <td key={c.id} className="text-right pr-3">
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    defaultValue={c.montoNeto || ""}
                                    onChange={(e) => actualizarCotizacion(c.id, "montoNeto", parseFloat(e.target.value) || 0)}
                                    onBlur={(e) => guardarCotizacion(c.id, "montoNeto", parseFloat(e.target.value) || 0)}
                                    placeholder="0"
                                    className="w-24 text-right text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-[5px] px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30 tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                </td>
                              ))}
                            </tr>

                            {/* Leyes sociales */}
                            <tr className="border-b border-slate-50" style={{ height: 32 }}>
                              <td className="pl-4 pr-2 text-slate-500 sticky left-0 bg-white">Leyes sociales</td>
                              <td className="text-right pr-3 tabular-nums text-slate-600">
                                {fmtMoneda(tuPresupuesto?.leyesSociales ?? 0, moneda)}
                              </td>
                              {cotizaciones.map((c) => (
                                <td key={c.id} className="text-right pr-3">
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    defaultValue={c.leyesSociales || ""}
                                    onChange={(e) => actualizarCotizacion(c.id, "leyesSociales", parseFloat(e.target.value) || 0)}
                                    onBlur={(e) => guardarCotizacion(c.id, "leyesSociales", parseFloat(e.target.value) || 0)}
                                    placeholder="0"
                                    className="w-24 text-right text-sm text-slate-600 bg-white border border-slate-200 rounded-[5px] px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30 tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                </td>
                              ))}
                            </tr>

                            {/* IVA */}
                            <tr className="border-b border-slate-50" style={{ height: 32 }}>
                              <td className="pl-4 pr-2 text-slate-500 sticky left-0 bg-white">IVA</td>
                              <td className="text-right pr-3 tabular-nums text-slate-600">{IVA_PCT_DEFAULT}%</td>
                              {cotizaciones.map((c) => (
                                <td key={c.id} className="text-right pr-3">
                                  <div className="flex items-center justify-end gap-1">
                                    <input
                                      type="number"
                                      min={0}
                                      step="0.5"
                                      defaultValue={c.ivaPorcentaje}
                                      onChange={(e) => actualizarCotizacion(c.id, "ivaPorcentaje", parseFloat(e.target.value) || 0)}
                                      onBlur={(e) => guardarCotizacion(c.id, "ivaPorcentaje", parseFloat(e.target.value) || 0)}
                                      className="w-14 text-right text-sm text-slate-600 bg-white border border-slate-200 rounded-[5px] px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30 tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                    <span className="text-[11px] text-slate-400">%</span>
                                  </div>
                                </td>
                              ))}
                            </tr>

                            {/* Total */}
                            <tr className="border-b border-slate-100" style={{ height: 36 }}>
                              <td className="pl-4 pr-2 font-bold text-[#1A3A5C] uppercase tracking-wide text-[11px] sticky left-0 bg-white">Total</td>
                              <td className="text-right pr-3 tabular-nums text-base font-bold text-[#1A3A5C]">
                                {fmtMoneda(tuPresupuesto?.total ?? 0, moneda)}
                              </td>
                              {cotizaciones.map((c) => {
                                const total = c.montoNeto * (1 + c.ivaPorcentaje / 100) + c.leyesSociales;
                                const mejor = tuPresupuesto ? total < tuPresupuesto.total : false;
                                const peor = tuPresupuesto ? total > tuPresupuesto.total : false;
                                return (
                                  <td
                                    key={c.id}
                                    className={cn(
                                      "text-right pr-3 tabular-nums text-base font-bold",
                                      mejor ? "text-green-600" : peor ? "text-red-600" : "text-[#1A3A5C]"
                                    )}
                                  >
                                    {fmtMoneda(total, moneda)}
                                  </td>
                                );
                              })}
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Financiación y observaciones */}
                      {cotizaciones.length > 0 && (
                        <div className="border-t border-slate-200 px-4 py-3 space-y-3">
                          {cotizaciones.map((c) => (
                            <div key={c.id} className="grid grid-cols-1 sm:grid-cols-[140px_1fr_1fr] gap-2 items-start">
                              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate pt-1.5">
                                {c.proveedor || "Proveedor"}
                              </span>
                              <div>
                                <label className="block text-[10px] text-slate-400 mb-0.5">Financiación</label>
                                <input
                                  type="text"
                                  defaultValue={c.financiacion}
                                  onChange={(e) => actualizarCotizacion(c.id, "financiacion", e.target.value)}
                                  onBlur={(e) => guardarCotizacion(c.id, "financiacion", e.target.value)}
                                  placeholder="Ej: 30/60/90 días"
                                  className="w-full text-xs text-slate-700 bg-white border border-slate-200 rounded-[6px] px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-slate-400 mb-0.5">Observaciones</label>
                                <input
                                  type="text"
                                  defaultValue={c.observaciones}
                                  onChange={(e) => actualizarCotizacion(c.id, "observaciones", e.target.value)}
                                  onBlur={(e) => guardarCotizacion(c.id, "observaciones", e.target.value)}
                                  placeholder="Notas sobre esta cotización"
                                  className="w-full text-xs text-slate-700 bg-white border border-slate-200 rounded-[6px] px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {cargandoCotizaciones && (
                        <div className="px-4 py-2 text-[11px] text-slate-400 italic">Cargando cotizaciones…</div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
