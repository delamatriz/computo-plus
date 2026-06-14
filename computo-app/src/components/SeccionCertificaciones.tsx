"use client";

import { Fragment, useEffect, useState, useCallback, useMemo } from "react";
import { ClipboardList, ChevronDown, ChevronRight, Plus, Trash2, Pencil, Camera, X, ImagePlus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

/* ─── Tipos ───────────────────────────────────────────────── */
interface RubroResumen {
  id: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  cantidad: number;
  precioUnit: number;
  capituloId: string;
}

interface FotoCert {
  id: string;
  url: string;
}

interface ItemCert {
  id: string;
  rubroId: string;
  porcentajeAvance: number;
  cantidadEjecutada: number | null;
  rubro?: RubroResumen;
}

interface CertificacionResumen {
  id: string;
  numero: number;
  nombre: string;
  fecha: string;
  observaciones: string;
  items: { id: string; rubroId: string; porcentajeAvance: number; cantidadEjecutada: number | null }[];
}

interface CertificacionDetalle extends Omit<CertificacionResumen, "items"> {
  items: ItemCert[];
}

interface CapituloInfo {
  id: string;
  nombre: string;
  codigo?: string;
}

interface Props {
  proyectoId: string;
  moneda: string;
  totalGeneral: number;
  capitulos: CapituloInfo[];
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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fmtFecha(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-UY", { day: "2-digit", month: "long", year: "numeric" });
}

function montoCertificadoDe(cert: CertificacionResumen, rubrosPorId: Map<string, RubroResumen>): number {
  return cert.items.reduce((acc, it) => {
    const r = rubrosPorId.get(it.rubroId);
    if (!r) return acc;
    return acc + (it.porcentajeAvance / 100) * r.cantidad * r.precioUnit;
  }, 0);
}

/* ─── Tarjeta de certificación (lista) ────────────────────── */
function TarjetaCertificacion({
  cert,
  activa,
  monto,
  pctDelTotal,
  moneda,
  onClick,
}: {
  cert: CertificacionResumen;
  activa: boolean;
  monto: number;
  pctDelTotal: number;
  moneda: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-[10px] border px-3.5 py-3 transition-colors",
        activa ? "border-[#2563EB] bg-[#EFF6FF]" : "border-slate-200 bg-white hover:border-slate-300"
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-[#1A3A5C]">
          Cert. Nº{cert.numero} {cert.nombre && cert.nombre !== `Certificado Nº${cert.numero}` ? `· ${cert.nombre}` : ""}
        </span>
      </div>
      <p className="text-[11px] text-slate-400 mt-0.5">{fmtFecha(cert.fecha)}</p>
      <div className="flex items-center justify-between mt-2">
        <span className="text-sm font-semibold tabular-nums text-[#2563EB]">{fmtMoneda(monto, moneda)}</span>
        <span className="text-[11px] text-slate-400 tabular-nums">{fmtNum(pctDelTotal, 1)}% del total</span>
      </div>
      <div className="mt-2 h-1 w-full rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-[#2563EB]"
          style={{ width: `${Math.min(100, pctDelTotal)}%` }}
        />
      </div>
    </button>
  );
}

/* ─── Componente principal ────────────────────────────────── */
export default function SeccionCertificaciones({ proyectoId, moneda, totalGeneral, capitulos }: Props) {
  const [expandido, setExpandido] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [certificaciones, setCertificaciones] = useState<CertificacionResumen[]>([]);
  const [activaId, setActivaId] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<CertificacionDetalle | null>(null);
  const [ediciones, setEdiciones] = useState<Record<string, number>>({});
  const [creando, setCreando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [editandoFecha, setEditandoFecha] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const [itemFotosAbierto, setItemFotosAbierto] = useState<string | null>(null);
  const [fotosPorItem, setFotosPorItem] = useState<Record<string, FotoCert[]>>({});
  const [subiendoFotos, setSubiendoFotos] = useState<Record<string, boolean>>({});

  const capPorId = useMemo(() => {
    const m = new Map<string, CapituloInfo>();
    capitulos.forEach((c) => m.set(c.id, c));
    return m;
  }, [capitulos]);

  /* ── Carga de certificaciones ──────────────────────────── */
  const cargarLista = useCallback(async () => {
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/certificaciones`);
      const data: CertificacionResumen[] = await res.json();
      setCertificaciones(Array.isArray(data) ? data : []);
      if (Array.isArray(data) && data.length > 0) {
        setActivaId((prev) => prev ?? data[data.length - 1].id);
      }
    } catch (err) {
      console.error("[certificaciones] error cargando lista", err);
    } finally {
      setCargado(true);
    }
  }, [proyectoId]);

  useEffect(() => {
    if (expandido && !cargado) cargarLista();
  }, [expandido, cargado, cargarLista]);

  /* ── Carga del detalle de la certificación activa ──────── */
  const cargarDetalle = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/proyectos/${proyectoId}/certificaciones/${id}`);
        const data: CertificacionDetalle = await res.json();
        setDetalle(data);
        const ed: Record<string, number> = {};
        data.items.forEach((it) => { ed[it.rubroId] = it.porcentajeAvance; });
        setEdiciones(ed);
      } catch (err) {
        console.error("[certificaciones] error cargando detalle", err);
      }
    },
    [proyectoId]
  );

  useEffect(() => {
    if (activaId) cargarDetalle(activaId);
    else setDetalle(null);
  }, [activaId, cargarDetalle]);

  /* ── Mapa de todos los rubros (desde el detalle activo) ─── */
  const rubrosPorId = useMemo(() => {
    const m = new Map<string, RubroResumen>();
    detalle?.items.forEach((it) => { if (it.rubro) m.set(it.rubroId, it.rubro); });
    return m;
  }, [detalle]);

  /* ── % acumulado anterior por rubro (certs con número menor) ── */
  const acumuladoAnterior = useMemo(() => {
    const m = new Map<string, number>();
    if (!detalle) return m;
    certificaciones
      .filter((c) => c.numero < detalle.numero)
      .forEach((c) => {
        c.items.forEach((it) => {
          m.set(it.rubroId, (m.get(it.rubroId) ?? 0) + it.porcentajeAvance);
        });
      });
    return m;
  }, [certificaciones, detalle]);

  /* ── Crear certificación ───────────────────────────────── */
  const crearCertificacion = async () => {
    setCreando(true);
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/certificaciones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("No se pudo crear");
      const nueva: CertificacionResumen = await res.json();
      setCertificaciones((prev) => [...prev, nueva]);
      setActivaId(nueva.id);
    } catch (err) {
      console.error("[certificaciones] error creando", err);
    } finally {
      setCreando(false);
    }
  };

  /* ── Editar nombre / fecha ─────────────────────────────── */
  const guardarCampo = async (campo: "nombre" | "fecha", valor: string) => {
    if (!detalle) return;
    setDetalle({ ...detalle, [campo]: campo === "fecha" ? new Date(valor).toISOString() : valor });
    try {
      await fetch(`/api/proyectos/${proyectoId}/certificaciones/${detalle.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [campo]: campo === "fecha" ? new Date(valor).toISOString() : valor }),
      });
      setCertificaciones((prev) =>
        prev.map((c) => (c.id === detalle.id ? { ...c, [campo]: campo === "fecha" ? new Date(valor).toISOString() : valor } : c))
      );
    } catch (err) {
      console.error("[certificaciones] error guardando campo", err);
    }
  };

  /* ── Eliminar certificación ────────────────────────────── */
  const eliminarCertificacion = async () => {
    if (!detalle) return;
    setEliminando(true);
    try {
      await fetch(`/api/proyectos/${proyectoId}/certificaciones/${detalle.id}`, { method: "DELETE" });
      const restantes = certificaciones.filter((c) => c.id !== detalle.id);
      setCertificaciones(restantes);
      setActivaId(restantes.length > 0 ? restantes[restantes.length - 1].id : null);
      setConfirmarEliminar(false);
    } catch (err) {
      console.error("[certificaciones] error eliminando", err);
    } finally {
      setEliminando(false);
    }
  };

  /* ── Guardar items (avances) ───────────────────────────── */
  const guardarItems = async () => {
    if (!detalle) return;
    setGuardando(true);
    try {
      const payload = detalle.items.map((it) => ({
        rubroId: it.rubroId,
        porcentajeAvance: ediciones[it.rubroId] ?? it.porcentajeAvance,
        cantidadEjecutada: it.rubro
          ? (it.rubro.cantidad * (ediciones[it.rubroId] ?? it.porcentajeAvance)) / 100
          : null,
      }));
      const res = await fetch(`/api/proyectos/${proyectoId}/certificaciones/${detalle.id}/items`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("No se pudo guardar");
      const data = await res.json();
      setDetalle(data.certificacion);
      setCertificaciones((prev) =>
        prev.map((c) => (c.id === detalle.id ? { ...c, items: data.certificacion.items } : c))
      );
    } catch (err) {
      console.error("[certificaciones] error guardando items", err);
    } finally {
      setGuardando(false);
    }
  };

  /* ── Cambiar % de avance de un rubro ───────────────────── */
  const cambiarPct = (rubroId: string, valor: number) => {
    const acumAnterior = acumuladoAnterior.get(rubroId) ?? 0;
    const max = Math.max(0, 100 - acumAnterior);
    const limitado = Math.min(Math.max(0, valor), max);
    setEdiciones((prev) => ({ ...prev, [rubroId]: limitado }));
  };

  /* ── Fotos de avance por item ──────────────────────────── */
  const toggleFotos = useCallback(
    async (itemId: string) => {
      if (itemFotosAbierto === itemId) {
        setItemFotosAbierto(null);
        return;
      }
      setItemFotosAbierto(itemId);
      if (!detalle || fotosPorItem[itemId]) return;
      try {
        const res = await fetch(`/api/proyectos/${proyectoId}/certificaciones/${detalle.id}/items/${itemId}/fotos`);
        const data = await res.json();
        setFotosPorItem((prev) => ({ ...prev, [itemId]: Array.isArray(data.fotos) ? data.fotos : [] }));
      } catch (err) {
        console.error("[certificaciones] error cargando fotos", err);
      }
    },
    [itemFotosAbierto, detalle, fotosPorItem, proyectoId]
  );

  const subirFotos = async (itemId: string, files: FileList) => {
    if (!detalle || files.length === 0) return;
    setSubiendoFotos((prev) => ({ ...prev, [itemId]: true }));
    try {
      const fotos = await Promise.all(Array.from(files).map(fileToBase64));
      const res = await fetch(`/api/proyectos/${proyectoId}/certificaciones/${detalle.id}/items/${itemId}/fotos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fotos }),
      });
      if (!res.ok) throw new Error("No se pudo subir");
      const data = await res.json();
      setFotosPorItem((prev) => ({ ...prev, [itemId]: data.fotos }));
    } catch (err) {
      console.error("[certificaciones] error subiendo fotos", err);
    } finally {
      setSubiendoFotos((prev) => ({ ...prev, [itemId]: false }));
    }
  };

  const eliminarFoto = async (itemId: string, fotoId: string) => {
    if (!detalle) return;
    setFotosPorItem((prev) => ({ ...prev, [itemId]: (prev[itemId] ?? []).filter((f) => f.id !== fotoId) }));
    try {
      await fetch(`/api/proyectos/${proyectoId}/certificaciones/${detalle.id}/items/${itemId}/fotos`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fotoId }),
      });
    } catch (err) {
      console.error("[certificaciones] error eliminando foto", err);
    }
  };

  /* ── Totales ───────────────────────────────────────────── */
  const subtotalEstaCert = useMemo(() => {
    if (!detalle) return 0;
    return detalle.items.reduce((acc, it) => {
      const pct = ediciones[it.rubroId] ?? it.porcentajeAvance;
      const r = it.rubro;
      if (!r) return acc;
      return acc + (pct / 100) * r.cantidad * r.precioUnit;
    }, 0);
  }, [detalle, ediciones]);

  const totalAcumulado = useMemo(() => {
    if (!detalle) return 0;
    return detalle.items.reduce((acc, it) => {
      const r = it.rubro;
      if (!r) return acc;
      const acumAnterior = acumuladoAnterior.get(it.rubroId) ?? 0;
      const pctEsta = ediciones[it.rubroId] ?? it.porcentajeAvance;
      const acumTotal = Math.min(100, acumAnterior + pctEsta);
      return acc + (acumTotal / 100) * r.cantidad * r.precioUnit;
    }, 0);
  }, [detalle, ediciones, acumuladoAnterior]);

  const saldoPendiente = totalGeneral - totalAcumulado;

  /* ── Agrupar items por capítulo, en orden ──────────────── */
  const gruposPorCapitulo = useMemo(() => {
    if (!detalle) return [];
    const grupos = new Map<string, ItemCert[]>();
    detalle.items.forEach((it) => {
      if (!it.rubro) return;
      const key = it.rubro.capituloId;
      if (!grupos.has(key)) grupos.set(key, []);
      grupos.get(key)!.push(it);
    });
    return capitulos
      .filter((c) => grupos.has(c.id))
      .map((c) => ({ capitulo: c, items: grupos.get(c.id)! }));
  }, [detalle, capitulos]);

  const thCls = "text-[10px] font-semibold text-slate-400 uppercase tracking-wider";

  return (
    <div className="mt-6 bg-white rounded-[16px] border border-slate-300 shadow-sm overflow-hidden">
      {/* Header colapsable */}
      <button
        onClick={() => setExpandido((p) => !p)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors text-left group"
      >
        <div className="flex items-center gap-2.5">
          <ClipboardList className="w-4 h-4 text-[#2563EB]" />
          <h2 className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">Certificaciones</h2>
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

                {/* ── Panel izquierdo — lista ────────────── */}
                <div className="w-full lg:w-1/3 flex-shrink-0 space-y-2.5">
                  <button
                    onClick={crearCertificacion}
                    disabled={creando}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" /> {creando ? "Creando…" : "Nueva certificación"}
                  </button>

                  {certificaciones.length === 0 ? (
                    <p className="text-xs text-slate-400 italic px-1 py-3">
                      Todavía no hay certificaciones para este proyecto.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {[...certificaciones].reverse().map((c) => {
                        const monto = montoCertificadoDe(c, rubrosPorId);
                        const pctDelTotal = totalGeneral > 0 ? (monto / totalGeneral) * 100 : 0;
                        return (
                          <TarjetaCertificacion
                            key={c.id}
                            cert={c}
                            activa={c.id === activaId}
                            monto={monto}
                            pctDelTotal={pctDelTotal}
                            moneda={moneda}
                            onClick={() => setActivaId(c.id)}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ── Panel derecho — detalle ────────────── */}
                <div className="flex-1 min-w-0 rounded-[10px] border border-slate-200 bg-white overflow-hidden">
                  {!detalle ? (
                    <div className="px-6 py-10 text-center text-sm text-slate-400 italic">
                      Seleccioná o creá una certificación para ver el detalle.
                    </div>
                  ) : (
                    <>
                      {/* Header del panel */}
                      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
                        <div className="flex items-center gap-3 min-w-0">
                          {editandoNombre ? (
                            <input
                              autoFocus
                              defaultValue={detalle.nombre}
                              onBlur={(e) => { guardarCampo("nombre", e.target.value); setEditandoNombre(false); }}
                              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                              className="text-sm font-bold text-[#1A3A5C] bg-white border border-slate-300 rounded-[6px] px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30"
                            />
                          ) : (
                            <button
                              onClick={() => setEditandoNombre(true)}
                              className="flex items-center gap-1.5 text-sm font-bold text-[#1A3A5C] hover:text-[#2563EB] transition-colors truncate group/edit"
                            >
                              <span className="truncate">Cert. Nº{detalle.numero} · {detalle.nombre}</span>
                              <Pencil className="w-3 h-3 text-slate-300 group-hover/edit:text-[#2563EB] flex-shrink-0" />
                            </button>
                          )}

                          {editandoFecha ? (
                            <input
                              type="date"
                              autoFocus
                              defaultValue={new Date(detalle.fecha).toISOString().slice(0, 10)}
                              onBlur={(e) => { guardarCampo("fecha", e.target.value); setEditandoFecha(false); }}
                              className="text-xs text-slate-600 bg-white border border-slate-300 rounded-[6px] px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30"
                            />
                          ) : (
                            <button
                              onClick={() => setEditandoFecha(true)}
                              className="text-xs text-slate-400 hover:text-[#2563EB] transition-colors flex-shrink-0"
                            >
                              {fmtFecha(detalle.fecha)}
                            </button>
                          )}
                        </div>

                        {confirmarEliminar ? (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs text-slate-500">¿Eliminar esta certificación?</span>
                            <button
                              onClick={eliminarCertificacion}
                              disabled={eliminando}
                              className="px-2.5 py-1 rounded-[6px] bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                            >
                              {eliminando ? "Eliminando…" : "Sí, eliminar"}
                            </button>
                            <button
                              onClick={() => setConfirmarEliminar(false)}
                              className="px-2.5 py-1 rounded-[6px] text-xs text-slate-500 hover:text-slate-700 transition-colors"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmarEliminar(true)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-[6px] text-xs font-medium text-red-500 hover:text-white hover:bg-red-600 border border-red-200 hover:border-red-600 transition-colors flex-shrink-0"
                          >
                            <Trash2 className="w-3 h-3" /> Eliminar
                          </button>
                        )}
                      </div>

                      {/* Tabla de rubros */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-100" style={{ background: "#F8FAFC", height: 30 }}>
                              <th className={cn(thCls, "text-left pl-4")}>Capítulo / Rubro</th>
                              <th className={cn(thCls, "text-center")} style={{ width: 56 }}>Unidad</th>
                              <th className={cn(thCls, "text-right pr-2")} style={{ width: 76 }}>Cant. total</th>
                              <th className={cn(thCls, "text-right pr-2")} style={{ width: 88 }}>Precio unit.</th>
                              <th className={cn(thCls, "text-right pr-2")} style={{ width: 96 }}>Monto total</th>
                              <th className={cn(thCls, "text-right pr-2")} style={{ width: 92 }} title="% ya certificado en certificaciones anteriores">% avance acum.</th>
                              <th className={cn(thCls, "text-right pr-2")} style={{ width: 84 }}>% esta cert.</th>
                              <th className={cn(thCls, "text-right pr-4")} style={{ width: 104 }}>Monto esta cert.</th>
                            </tr>
                          </thead>
                          <tbody>
                            {gruposPorCapitulo.map(({ capitulo, items }) => (
                              <FragmentoCapitulo
                                key={capitulo.id}
                                capitulo={capitulo}
                                items={items}
                                ediciones={ediciones}
                                acumuladoAnterior={acumuladoAnterior}
                                onCambiarPct={cambiarPct}
                                moneda={moneda}
                                itemFotosAbierto={itemFotosAbierto}
                                fotosPorItem={fotosPorItem}
                                subiendoFotos={subiendoFotos}
                                onToggleFotos={toggleFotos}
                                onSubirFotos={subirFotos}
                                onEliminarFoto={eliminarFoto}
                              />
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Footer de totales */}
                      <div className="border-t border-slate-200 bg-[#F8FAFC] px-4 py-3 space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500">Subtotal esta certificación</span>
                          <span className="font-semibold tabular-nums text-[#2563EB]">{fmtMoneda(subtotalEstaCert, moneda)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500">Total certificado acumulado</span>
                          <span className="font-semibold tabular-nums text-slate-700">{fmtMoneda(totalAcumulado, moneda)}</span>
                        </div>
                        <div className="flex items-center justify-between pt-1.5 border-t border-slate-200">
                          <span className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">Saldo pendiente</span>
                          <span className="text-base font-bold tabular-nums text-[#1A3A5C]">{fmtMoneda(saldoPendiente, moneda)}</span>
                        </div>
                      </div>

                      <div className="px-4 pb-4 pt-1">
                        <button
                          onClick={guardarItems}
                          disabled={guardando}
                          className="w-full py-2.5 rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-colors disabled:opacity-50"
                        >
                          {guardando ? "Guardando…" : "Guardar certificación"}
                        </button>
                      </div>
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

/* ─── Bloque de capítulo + sus rubros ─────────────────────── */
function FragmentoCapitulo({
  capitulo,
  items,
  ediciones,
  acumuladoAnterior,
  onCambiarPct,
  moneda,
  itemFotosAbierto,
  fotosPorItem,
  subiendoFotos,
  onToggleFotos,
  onSubirFotos,
  onEliminarFoto,
}: {
  capitulo: CapituloInfo;
  items: ItemCert[];
  ediciones: Record<string, number>;
  acumuladoAnterior: Map<string, number>;
  onCambiarPct: (rubroId: string, valor: number) => void;
  moneda: string;
  itemFotosAbierto: string | null;
  fotosPorItem: Record<string, FotoCert[]>;
  subiendoFotos: Record<string, boolean>;
  onToggleFotos: (itemId: string) => void;
  onSubirFotos: (itemId: string, files: FileList) => void;
  onEliminarFoto: (itemId: string, fotoId: string) => void;
}) {
  return (
    <>
      <tr>
        <td colSpan={8} className="px-4 py-1.5" style={{ background: "#1A3A5C" }}>
          <span className="text-[11px] font-bold text-white uppercase tracking-wider">
            {capitulo.codigo ? `${capitulo.codigo} · ` : ""}{capitulo.nombre}
          </span>
        </td>
      </tr>
      {items.map((it) => {
        const r = it.rubro!;
        const montoTotal = r.cantidad * r.precioUnit;
        const acumAnterior = acumuladoAnterior.get(it.rubroId) ?? 0;
        const pctEsta = ediciones[it.rubroId] ?? it.porcentajeAvance;
        const montoEstaCert = (pctEsta / 100) * montoTotal;
        const cantidadEquivalente = (r.cantidad * pctEsta) / 100;

        const fotosAbierto = itemFotosAbierto === it.id;
        const fotos = fotosPorItem[it.id] ?? [];
        const subiendo = subiendoFotos[it.id] ?? false;

        return (
          <Fragment key={it.id}>
            <tr className="border-b border-slate-50" style={{ height: 32 }}>
              <td className="pl-4 pr-2 text-slate-700 truncate max-w-[220px]">{r.descripcion}</td>
              <td className="text-center text-slate-500">{r.unidad}</td>
              <td className="text-right pr-2 tabular-nums text-slate-600">{fmtNum(r.cantidad)}</td>
              <td className="text-right pr-2 tabular-nums text-slate-500">{r.precioUnit ? fmtMoneda(r.precioUnit, moneda) : "—"}</td>
              <td className="text-right pr-2 tabular-nums font-medium text-slate-700">{montoTotal ? fmtMoneda(montoTotal, moneda) : "—"}</td>
              <td className="text-right pr-2 tabular-nums text-slate-400">{fmtNum(acumAnterior, 1)}%</td>
              <td className="text-right pr-2">
                <div className="flex items-center justify-end gap-1.5">
                  <button
                    onClick={() => onToggleFotos(it.id)}
                    className={cn(
                      "p-1 rounded-[5px] transition-colors flex-shrink-0",
                      fotosAbierto || fotos.length > 0
                        ? "text-[#2563EB] bg-[#EFF6FF]"
                        : "text-slate-300 hover:text-[#2563EB] hover:bg-[#EFF6FF]"
                    )}
                    title="Fotos de avance"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number"
                    min={0}
                    max={Math.max(0, 100 - acumAnterior)}
                    step="0.5"
                    value={pctEsta || ""}
                    onChange={(e) => onCambiarPct(it.rubroId, parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-14 text-right text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-[5px] px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30 tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-[11px] text-slate-400">%</span>
                </div>
                {pctEsta > 0 && (
                  <div className="text-[9px] text-slate-400 leading-tight text-right pr-1 mt-0.5">
                    {fmtNum(cantidadEquivalente)} {r.unidad}
                  </div>
                )}
              </td>
              <td className="text-right pr-4 tabular-nums font-semibold text-[#2563EB]">
                {montoEstaCert ? fmtMoneda(montoEstaCert, moneda) : "—"}
              </td>
            </tr>
            {fotosAbierto && (
              <tr className="border-b border-slate-50 bg-[#F8FAFC]">
                <td colSpan={8} className="px-4 py-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {fotos.map((foto) => (
                      <div key={foto.id} className="relative group w-14 h-14 rounded-[6px] overflow-hidden border border-slate-200 flex-shrink-0">
                        <img src={foto.url} alt="Foto de avance" className="w-full h-full object-cover" />
                        <button
                          onClick={() => onEliminarFoto(it.id, foto.id)}
                          className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Eliminar foto"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <label className="flex flex-col items-center justify-center gap-1 w-14 h-14 rounded-[6px] border border-dashed border-slate-300 text-slate-400 hover:text-[#2563EB] hover:border-[#2563EB] transition-colors cursor-pointer flex-shrink-0">
                      <ImagePlus className="w-4 h-4" />
                      <span className="text-[9px] font-medium">{subiendo ? "…" : "Agregar"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        disabled={subiendo}
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) onSubirFotos(it.id, e.target.files);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                </td>
              </tr>
            )}
          </Fragment>
        );
      })}
    </>
  );
}
