"use client";

import { useState, useCallback } from "react";
import { FileCheck2, ChevronDown, ChevronRight, Pencil, X, Plus, Trash2, Download, AlertTriangle, AlertCircle, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

/* ─── Tipos ───────────────────────────────────────────────── */
const OPCIONES_TIPO = ["Adicional", "Descuento"] as const;
type TipoAjuste = (typeof OPCIONES_TIPO)[number];

interface Ajuste {
  id: string;
  concepto: string;
  monto: number;
  tipo: TipoAjuste;
}

interface Liquidacion {
  id: string;
  fechaLiquidacion: string | null;
  observaciones: string | null;
  ajustes: Ajuste[];
}

type EstadoCruce = "certificado_de_mas" | "falta_certificar" | "coincide";

interface CruceCertificacion {
  totalCertificado: number;
  diferencia: number;
  umbral: number;
  estado: EstadoCruce;
}

interface Props {
  proyectoId: string;
}

/* ─── Formato ─────────────────────────────────────────────── */
function fmtFecha(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-UY", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

function fmtMoneda(v: number, moneda: string): string {
  const fmt = Math.round(v).toLocaleString("es-UY");
  return `${moneda === "USD" ? "US$" : "$"} ${fmt}`;
}

type FormGeneral = { fechaLiquidacion: string; observaciones: string };
type FormAjuste = { concepto: string; monto: string; tipo: TipoAjuste };

function formGeneralVacio(): FormGeneral {
  return { fechaLiquidacion: "", observaciones: "" };
}
function formGeneralDesde(l: Liquidacion): FormGeneral {
  return { fechaLiquidacion: l.fechaLiquidacion ? l.fechaLiquidacion.slice(0, 10) : "", observaciones: l.observaciones ?? "" };
}
function formAjusteVacio(): FormAjuste {
  return { concepto: "", monto: "", tipo: "Adicional" };
}
function formAjusteDesde(a: Ajuste): FormAjuste {
  return { concepto: a.concepto, monto: String(a.monto), tipo: a.tipo };
}

/* ─── Componente principal ────────────────────────────────── */
export default function SeccionLiquidacionFinal({ proyectoId }: Props) {
  const [expandido, setExpandido] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [liquidacion, setLiquidacion] = useState<Liquidacion | null>(null);
  const [presupuestoOriginal, setPresupuestoOriginal] = useState<number | null>(null);
  const [totalLiquidado, setTotalLiquidado] = useState<number | null>(null);
  const [cruceCertificacion, setCruceCertificacion] = useState<CruceCertificacion | null>(null);
  const [monedaProyecto, setMonedaProyecto] = useState("UYU");

  const [formularioGeneralAbierto, setFormularioGeneralAbierto] = useState(false);
  const [formGeneral, setFormGeneral] = useState<FormGeneral>(formGeneralVacio());
  const [guardandoGeneral, setGuardandoGeneral] = useState(false);

  const [ajusteAbierto, setAjusteAbierto] = useState<"nuevo" | string | null>(null);
  const [formAjuste, setFormAjuste] = useState<FormAjuste>(formAjusteVacio());
  const [guardandoAjuste, setGuardandoAjuste] = useState(false);

  const cargarDatos = useCallback(async () => {
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/liquidacion-final`);
      const data = await res.json();
      setLiquidacion(data.liquidacion);
      setPresupuestoOriginal(data.presupuestoOriginal);
      setTotalLiquidado(data.totalLiquidado);
      setCruceCertificacion(data.cruceCertificacion ?? null);
      setMonedaProyecto(data.monedaProyecto ?? "UYU");
    } catch (err) {
      console.error("[liquidacion-final] error cargando datos", err);
    } finally {
      setCargado(true);
    }
  }, [proyectoId]);

  const abrirSeccion = () => {
    setExpandido((p) => !p);
    if (!cargado) cargarDatos();
  };

  /* ── Datos generales ───────────────────────────────────── */
  const abrirCrear = () => {
    setFormGeneral(formGeneralVacio());
    setFormularioGeneralAbierto(true);
  };
  const abrirEditarGeneral = () => {
    if (!liquidacion) return;
    setFormGeneral(formGeneralDesde(liquidacion));
    setFormularioGeneralAbierto(true);
  };
  const guardarGeneral = async () => {
    setGuardandoGeneral(true);
    try {
      const esEdicion = !!liquidacion;
      const res = await fetch(`/api/proyectos/${proyectoId}/liquidacion-final`, {
        method: esEdicion ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formGeneral),
      });
      if (!res.ok) throw new Error("No se pudo guardar");
      const data: Liquidacion = await res.json();
      setLiquidacion(data);
      // presupuestoOriginal/totalLiquidado ya se conocían (crear/editar
      // datos generales no cambia ajustes), pero si es la primera
      // creación, totalLiquidado todavía no vino del POST — recargamos
      // para tenerlo consistente desde la fuente de verdad del GET.
      if (!esEdicion) await cargarDatos();
      setFormularioGeneralAbierto(false);
    } catch (err) {
      console.error("[liquidacion-final] error guardando datos generales", err);
    } finally {
      setGuardandoGeneral(false);
    }
  };

  /* ── Ajustes ────────────────────────────────────────────── */
  const abrirNuevoAjuste = () => {
    setFormAjuste(formAjusteVacio());
    setAjusteAbierto("nuevo");
  };
  const abrirEditarAjuste = (a: Ajuste) => {
    setFormAjuste(formAjusteDesde(a));
    setAjusteAbierto(a.id);
  };
  const guardarAjuste = async () => {
    if (!formAjuste.concepto.trim() || !formAjuste.monto.trim()) return;
    setGuardandoAjuste(true);
    try {
      const esEdicion = ajusteAbierto !== "nuevo" && ajusteAbierto != null;
      const url = esEdicion
        ? `/api/proyectos/${proyectoId}/liquidacion-final/ajustes/${ajusteAbierto}`
        : `/api/proyectos/${proyectoId}/liquidacion-final/ajustes`;
      const body = { ...formAjuste, monto: Number(formAjuste.monto) };
      const res = await fetch(url, {
        method: esEdicion ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("No se pudo guardar");
      // El total liquidado depende de todos los ajustes — más simple y
      // confiable recargar todo desde el GET que recalcular a mano acá.
      await cargarDatos();
      setAjusteAbierto(null);
    } catch (err) {
      console.error("[liquidacion-final] error guardando ajuste", err);
    } finally {
      setGuardandoAjuste(false);
    }
  };
  const eliminarAjuste = async (ajusteId: string) => {
    try {
      await fetch(`/api/proyectos/${proyectoId}/liquidacion-final/ajustes/${ajusteId}`, { method: "DELETE" });
      await cargarDatos();
    } catch (err) {
      console.error("[liquidacion-final] error eliminando ajuste", err);
    }
  };

  return (
    <div className="mt-6 bg-white rounded-[16px] border border-slate-300 shadow-sm overflow-hidden">
      <button
        onClick={abrirSeccion}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors text-left group"
      >
        <div className="flex items-center gap-2.5">
          <FileCheck2 className="w-4 h-4 text-[#2563EB]" />
          <h2 className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">Liquidación Final</h2>
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
            <div className="px-5 py-5 space-y-3" style={{ background: "#F8FAFC" }}>
              <p className="text-xs text-slate-500 -mt-1">
                Presupuesto original (Costo Total del presupuesto) más ajustes reales de obra — adicionales y
                descuentos — igual al total liquidado.
              </p>

              {presupuestoOriginal != null && (
                <div className="rounded-[10px] border border-slate-200 bg-white px-3.5 py-3">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
                    Presupuesto original
                  </p>
                  <p className="text-sm font-semibold text-slate-700">{fmtMoneda(presupuestoOriginal, monedaProyecto)}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Costo Total del presupuesto actual — calculado, no editable.</p>
                </div>
              )}

              {!liquidacion ? (
                <button
                  onClick={abrirCrear}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-colors"
                >
                  <Plus className="w-4 h-4" /> Crear liquidación final
                </button>
              ) : (
                <>
                  <div className="rounded-[10px] border border-slate-200 bg-white px-3.5 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Datos generales</p>
                      <div className="flex items-center gap-3">
                        <a
                          href={`/api/proyectos/${proyectoId}/liquidacion-final/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
                        >
                          <Download className="w-3 h-3" /> Imprimir / PDF
                        </a>
                        <button
                          onClick={abrirEditarGeneral}
                          className="flex items-center gap-1 text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
                        >
                          <Pencil className="w-3 h-3" /> Editar
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-[10px] font-semibold text-slate-400 mb-0.5">Fecha de liquidación</p>
                        <p className={liquidacion.fechaLiquidacion ? "text-slate-700 font-medium" : "text-slate-400 italic"}>
                          {liquidacion.fechaLiquidacion ? fmtFecha(liquidacion.fechaLiquidacion) : "Sin definir"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-slate-400 mb-0.5">Observaciones</p>
                        <p className={liquidacion.observaciones ? "text-slate-700 font-medium whitespace-pre-wrap" : "text-slate-400 italic"}>
                          {liquidacion.observaciones || "Sin definir"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[10px] border border-slate-200 bg-white px-3.5 py-3">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Ajustes</p>
                    {liquidacion.ajustes.length === 0 ? (
                      <p className="text-xs text-slate-400 italic mb-2">Todavía no hay ajustes cargados.</p>
                    ) : (
                      <div className="space-y-1.5 mb-2">
                        {liquidacion.ajustes.map((a) => (
                          <div key={a.id} className="flex items-center justify-between gap-2 rounded-[8px] border border-slate-100 px-2.5 py-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span
                                  className={cn(
                                    "text-[10px] font-semibold px-1.5 py-0.5 rounded-full border flex-shrink-0",
                                    a.tipo === "Adicional" ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"
                                  )}
                                >
                                  {a.tipo}
                                </span>
                                <span className="text-xs text-slate-700 font-medium truncate">{a.concepto}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className={cn("text-sm font-bold tabular-nums", a.tipo === "Adicional" ? "text-emerald-600" : "text-red-600")}>
                                {a.tipo === "Adicional" ? "+" : "-"}{fmtMoneda(a.monto, monedaProyecto)}
                              </span>
                              <button onClick={() => abrirEditarAjuste(a)} className="text-slate-400 hover:text-[#2563EB] transition-colors p-1">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => eliminarAjuste(a.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={abrirNuevoAjuste}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-[8px] border border-dashed border-slate-300 text-slate-500 text-xs font-medium hover:border-[#2563EB] hover:text-[#2563EB] transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Agregar ajuste
                    </button>
                  </div>

                  {totalLiquidado != null && (
                    <div className="rounded-[10px] border-2 border-[#2563EB]/30 bg-[#EFF6FF] px-3.5 py-3 flex items-center justify-between">
                      <span className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">Total liquidado</span>
                      <span className="text-xl font-bold tabular-nums text-[#2563EB]">{fmtMoneda(totalLiquidado, monedaProyecto)}</span>
                    </div>
                  )}

                  {cruceCertificacion && (
                    <BloqueCruceCertificacion cruce={cruceCertificacion} moneda={monedaProyecto} />
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal — datos generales */}
      <AnimatePresence>
        {formularioGeneralAbierto && (
          <ModalBase titulo={liquidacion ? "Editar datos generales" : "Crear liquidación final"} onCerrar={() => setFormularioGeneralAbierto(false)}>
            <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Fecha de liquidación</label>
                <input
                  type="date"
                  value={formGeneral.fechaLiquidacion}
                  onChange={(e) => setFormGeneral((p) => ({ ...p, fechaLiquidacion: e.target.value }))}
                  className="w-full text-sm text-slate-700 bg-white border border-slate-200 rounded-[8px] px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Observaciones</label>
                <textarea
                  value={formGeneral.observaciones}
                  onChange={(e) => setFormGeneral((p) => ({ ...p, observaciones: e.target.value }))}
                  rows={3}
                  className="w-full text-sm text-slate-700 bg-white border border-slate-200 rounded-[8px] px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30 resize-y"
                />
              </div>
            </div>
            <FooterModal
              guardando={guardandoGeneral}
              esEdicion={!!liquidacion}
              onGuardar={guardarGeneral}
              onCerrar={() => setFormularioGeneralAbierto(false)}
              textoCrear="Crear liquidación"
            />
          </ModalBase>
        )}
      </AnimatePresence>

      {/* Modal — ajuste */}
      <AnimatePresence>
        {ajusteAbierto && (
          <ModalBase titulo={ajusteAbierto !== "nuevo" ? "Editar ajuste" : "Agregar ajuste"} onCerrar={() => setAjusteAbierto(null)}>
            <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Concepto</label>
                <input
                  type="text"
                  value={formAjuste.concepto}
                  onChange={(e) => setFormAjuste((p) => ({ ...p, concepto: e.target.value }))}
                  placeholder="ej: Trabajos extra no previstos"
                  className="w-full text-sm text-slate-700 bg-white border border-slate-200 rounded-[8px] px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Monto</label>
                  <input
                    type="number"
                    value={formAjuste.monto}
                    onChange={(e) => setFormAjuste((p) => ({ ...p, monto: e.target.value }))}
                    placeholder="0"
                    className="w-full text-sm text-slate-700 bg-white border border-slate-200 rounded-[8px] px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Tipo</label>
                  <select
                    value={formAjuste.tipo}
                    onChange={(e) => setFormAjuste((p) => ({ ...p, tipo: e.target.value as TipoAjuste }))}
                    className="w-full text-sm text-slate-700 bg-white border border-slate-200 rounded-[8px] px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30"
                  >
                    {OPCIONES_TIPO.map((op) => (
                      <option key={op} value={op}>{op}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <FooterModal
              guardando={guardandoAjuste}
              esEdicion={ajusteAbierto !== "nuevo"}
              onGuardar={guardarAjuste}
              onCerrar={() => setAjusteAbierto(null)}
              textoCrear="Agregar ajuste"
              deshabilitado={!formAjuste.concepto.trim() || !formAjuste.monto.trim()}
            />
          </ModalBase>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Cruce contra Certificaciones ────────────────────────── */
const ESTILO_CRUCE: Record<EstadoCruce, { borde: string; fondo: string; texto: string; Icono: typeof AlertTriangle }> = {
  certificado_de_mas: { borde: "border-red-300", fondo: "bg-red-50", texto: "text-red-700", Icono: AlertTriangle },
  falta_certificar: { borde: "border-amber-300", fondo: "bg-amber-50", texto: "text-amber-700", Icono: AlertCircle },
  coincide: { borde: "border-emerald-300", fondo: "bg-emerald-50", texto: "text-emerald-700", Icono: CheckCircle2 },
};

function mensajeCruce(cruce: CruceCertificacion, moneda: string): string {
  if (cruce.estado === "certificado_de_mas") {
    return `Certificado de más: ${fmtMoneda(Math.abs(cruce.diferencia), moneda)}`;
  }
  if (cruce.estado === "falta_certificar") {
    return `Falta certificar: ${fmtMoneda(Math.abs(cruce.diferencia), moneda)}`;
  }
  return "Liquidación y certificación coinciden";
}

function BloqueCruceCertificacion({ cruce, moneda }: { cruce: CruceCertificacion; moneda: string }) {
  const estilo = ESTILO_CRUCE[cruce.estado];
  const Icono = estilo.Icono;
  return (
    <div className={cn("rounded-[10px] border px-3.5 py-3 space-y-2", estilo.borde, estilo.fondo)}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Total certificado</span>
        <span className="text-sm font-bold tabular-nums text-slate-700">{fmtMoneda(cruce.totalCertificado, moneda)}</span>
      </div>
      <div className={cn("flex items-center gap-1.5 text-xs font-semibold", estilo.texto)}>
        <Icono className="w-3.5 h-3.5 flex-shrink-0" />
        {mensajeCruce(cruce, moneda)}
      </div>
    </div>
  );
}

/* ─── Piezas compartidas de modal ──────────────────────────── */
function ModalBase({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3 md:p-6"
      onClick={onCerrar}
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-[16px] w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col shadow-xl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
          <h3 className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">{titulo}</h3>
          <button onClick={onCerrar} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4.5 h-4.5" />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

function FooterModal({
  guardando,
  esEdicion,
  onGuardar,
  onCerrar,
  textoCrear,
  deshabilitado,
}: {
  guardando: boolean;
  esEdicion: boolean;
  onGuardar: () => void;
  onCerrar: () => void;
  textoCrear: string;
  deshabilitado?: boolean;
}) {
  return (
    <div className="px-5 py-4 border-t border-slate-200 flex gap-2 flex-shrink-0">
      <button onClick={onCerrar} className="flex-1 py-2.5 rounded-[10px] border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors">
        Cancelar
      </button>
      <button
        onClick={onGuardar}
        disabled={guardando || deshabilitado}
        className="flex-1 py-2.5 rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-colors disabled:opacity-50"
      >
        {guardando ? "Guardando…" : esEdicion ? "Guardar cambios" : textoCrear}
      </button>
    </div>
  );
}
