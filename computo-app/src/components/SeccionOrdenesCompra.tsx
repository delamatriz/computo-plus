"use client";

import { useState, useCallback, useMemo } from "react";
import { PackageCheck, ChevronDown, ChevronRight, Plus, Pencil, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

/* ─── Tipos ───────────────────────────────────────────────── */
const OPCIONES_ESTADO = ["Pedido", "En camino", "Recibido", "Cancelado"] as const;
type Estado = (typeof OPCIONES_ESTADO)[number];

const ESTILO_ESTADO: Record<Estado, string> = {
  "Pedido": "bg-slate-100 text-slate-500 border-slate-200",
  "En camino": "bg-amber-50 text-amber-600 border-amber-200",
  "Recibido": "bg-emerald-50 text-emerald-600 border-emerald-200",
  "Cancelado": "bg-red-50 text-red-600 border-red-200",
};

interface CapituloVinculo {
  id: string;
  capituloId: string;
  capitulo?: { id: string; nombre: string; codigo: string };
}

interface OrdenCompra {
  id: string;
  proveedor: string;
  descripcion: string;
  monto: number | null;
  moneda: string;
  fechaPedido: string | null;
  fechaEntregaPrevista: string | null;
  estado: Estado;
  fechaRecepcion: string | null;
  completo: boolean | null;
  observacionesRecepcion: string | null;
  capitulos: CapituloVinculo[];
}

interface CapituloDisponible {
  id: string;
  nombre: string;
  codigo: string;
}

interface Props {
  proyectoId: string;
}

/* ─── Formato ─────────────────────────────────────────────── */
function fmtFecha(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-UY", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

function fmtMonto(monto: number, moneda: string): string {
  const formateado = monto.toLocaleString("es-UY", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return `${moneda === "USD" ? "US$" : "$"} ${formateado}`;
}

type FormState = {
  proveedor: string;
  descripcion: string;
  monto: string;
  moneda: "UYU" | "USD";
  fechaPedido: string;
  fechaEntregaPrevista: string;
  estado: Estado;
  fechaRecepcion: string;
  completo: "si" | "no" | "";
  observacionesRecepcion: string;
  capituloIds: string[];
};

function formVacio(): FormState {
  return {
    proveedor: "",
    descripcion: "",
    monto: "",
    moneda: "UYU",
    fechaPedido: "",
    fechaEntregaPrevista: "",
    estado: "Pedido",
    fechaRecepcion: "",
    completo: "",
    observacionesRecepcion: "",
    capituloIds: [],
  };
}

function formDesdeOrden(o: OrdenCompra): FormState {
  return {
    proveedor: o.proveedor,
    descripcion: o.descripcion,
    monto: o.monto != null ? String(o.monto) : "",
    moneda: o.moneda === "USD" ? "USD" : "UYU",
    fechaPedido: o.fechaPedido ? o.fechaPedido.slice(0, 10) : "",
    fechaEntregaPrevista: o.fechaEntregaPrevista ? o.fechaEntregaPrevista.slice(0, 10) : "",
    estado: o.estado,
    fechaRecepcion: o.fechaRecepcion ? o.fechaRecepcion.slice(0, 10) : "",
    completo: o.completo === true ? "si" : o.completo === false ? "no" : "",
    observacionesRecepcion: o.observacionesRecepcion ?? "",
    capituloIds: o.capitulos.map((c) => c.capituloId),
  };
}

/* ─── Componente principal ────────────────────────────────── */
export default function SeccionOrdenesCompra({ proyectoId }: Props) {
  const [expandido, setExpandido] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);

  const [formularioAbierto, setFormularioAbierto] = useState<"nueva" | string | null>(null);
  const [form, setForm] = useState<FormState>(formVacio());
  const [guardando, setGuardando] = useState(false);

  const [capitulosDisponibles, setCapitulosDisponibles] = useState<CapituloDisponible[]>([]);
  const [cargandoCapitulos, setCargandoCapitulos] = useState(false);

  const cargarLista = useCallback(async () => {
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/ordenes-compra`);
      const data = await res.json();
      setOrdenes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("[ordenes-compra] error cargando lista", err);
    } finally {
      setCargado(true);
    }
  }, [proyectoId]);

  const abrirSeccion = () => {
    setExpandido((p) => !p);
    if (!cargado) cargarLista();
  };

  const cargarCapitulos = useCallback(async () => {
    setCargandoCapitulos(true);
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}`);
      const proyecto = await res.json();
      const caps: CapituloDisponible[] = (proyecto.capitulos ?? []).map(
        (cap: { id: string; nombre: string; codigo: string }) => ({ id: cap.id, nombre: cap.nombre, codigo: cap.codigo })
      );
      setCapitulosDisponibles(caps);
    } catch (err) {
      console.error("[ordenes-compra] error cargando capítulos", err);
    } finally {
      setCargandoCapitulos(false);
    }
  }, [proyectoId]);

  const abrirNueva = () => {
    setForm(formVacio());
    setFormularioAbierto("nueva");
    if (capitulosDisponibles.length === 0) cargarCapitulos();
  };

  const abrirEdicion = (orden: OrdenCompra) => {
    setForm(formDesdeOrden(orden));
    setFormularioAbierto(orden.id);
    if (capitulosDisponibles.length === 0) cargarCapitulos();
  };

  const cerrarFormulario = () => setFormularioAbierto(null);

  const toggleCapitulo = (capituloId: string) => {
    setForm((prev) => ({
      ...prev,
      capituloIds: prev.capituloIds.includes(capituloId)
        ? prev.capituloIds.filter((id) => id !== capituloId)
        : [...prev.capituloIds, capituloId],
    }));
  };

  const guardar = async () => {
    if (!form.proveedor.trim() || !form.descripcion.trim()) return;
    setGuardando(true);
    try {
      const esEdicion = formularioAbierto !== "nueva" && formularioAbierto != null;
      const url = esEdicion
        ? `/api/proyectos/${proyectoId}/ordenes-compra/${formularioAbierto}`
        : `/api/proyectos/${proyectoId}/ordenes-compra`;
      const body = {
        ...form,
        monto: form.monto.trim() ? Number(form.monto) : null,
        completo: form.estado === "Recibido" ? (form.completo === "si" ? true : form.completo === "no" ? false : null) : null,
        fechaRecepcion: form.estado === "Recibido" ? form.fechaRecepcion : "",
        observacionesRecepcion: form.estado === "Recibido" ? form.observacionesRecepcion : "",
      };
      const res = await fetch(url, {
        method: esEdicion ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("No se pudo guardar");
      const data: OrdenCompra = await res.json();
      setOrdenes((prev) => {
        if (esEdicion) return prev.map((o) => (o.id === data.id ? data : o));
        return [...prev, data];
      });
      setFormularioAbierto(null);
    } catch (err) {
      console.error("[ordenes-compra] error guardando", err);
    } finally {
      setGuardando(false);
    }
  };

  const capitulosOrdenados = useMemo(
    () => [...capitulosDisponibles].sort((a, b) => a.codigo.localeCompare(b.codigo)),
    [capitulosDisponibles]
  );

  return (
    <div className="mt-6 bg-white rounded-[16px] border border-slate-300 shadow-sm overflow-hidden">
      <button
        onClick={abrirSeccion}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors text-left group"
      >
        <div className="flex items-center gap-2.5">
          <PackageCheck className="w-4 h-4 text-[#2563EB]" />
          <h2 className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">Órdenes de Compra y Recepción</h2>
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
                Órdenes de compra a proveedores de esta obra: qué se pidió, a quién, por cuánto, y si ya llegó
                completo.
              </p>

              <button
                onClick={abrirNueva}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-colors"
              >
                <Plus className="w-4 h-4" /> Agregar orden
              </button>

              {ordenes.length === 0 ? (
                <p className="text-xs text-slate-400 italic px-1 py-3">
                  Todavía no hay órdenes de compra registradas en este proyecto.
                </p>
              ) : (
                <div className="space-y-2">
                  {ordenes.map((orden) => (
                    <FilaOrden key={orden.id} orden={orden} onEditar={() => abrirEdicion(orden)} />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {formularioAbierto && (
          <FormularioOrden
            form={form}
            setForm={setForm}
            esEdicion={formularioAbierto !== "nueva"}
            guardando={guardando}
            capitulos={capitulosOrdenados}
            cargandoCapitulos={cargandoCapitulos}
            onToggleCapitulo={toggleCapitulo}
            onGuardar={guardar}
            onCerrar={cerrarFormulario}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Fila de orden ────────────────────────────────────────── */
function FilaOrden({ orden, onEditar }: { orden: OrdenCompra; onEditar: () => void }) {
  return (
    <div className="rounded-[10px] border border-slate-200 bg-white px-3.5 py-3">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-bold text-[#1A3A5C] truncate">{orden.proveedor}</span>
            <span
              className={cn(
                "text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0",
                ESTILO_ESTADO[orden.estado]
              )}
            >
              {orden.estado}
            </span>
            {orden.estado === "Recibido" && orden.completo != null && (
              <span
                className={cn(
                  "text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0",
                  orden.completo
                    ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                    : "bg-amber-50 text-amber-600 border-amber-200"
                )}
              >
                {orden.completo ? "Completo" : "Incompleto"}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{orden.descripcion}</p>

          {orden.fechaPedido && (
            <p className="text-[11px] text-slate-400 mt-1">Pedido el {fmtFecha(orden.fechaPedido)}</p>
          )}

          {orden.estado === "Recibido" && orden.observacionesRecepcion && (
            <p className="text-[11px] text-slate-500 mt-1 italic">&quot;{orden.observacionesRecepcion}&quot;</p>
          )}

          {orden.capitulos.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {orden.capitulos.map((v) => (
                <span
                  key={v.id}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#2563EB] border border-blue-100"
                >
                  {v.capitulo?.codigo ? `${v.capitulo.codigo} · ` : ""}
                  {v.capitulo?.nombre ?? "(capítulo eliminado)"}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          {orden.monto != null && (
            <span className="text-sm font-bold text-[#1A3A5C]">{fmtMonto(orden.monto, orden.moneda)}</span>
          )}
          <button
            onClick={onEditar}
            className="flex items-center gap-1 text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
          >
            <Pencil className="w-3 h-3" /> Editar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Modal de formulario (nueva / editar) ────────────────── */
function FormularioOrden({
  form,
  setForm,
  esEdicion,
  guardando,
  capitulos,
  cargandoCapitulos,
  onToggleCapitulo,
  onGuardar,
  onCerrar,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  esEdicion: boolean;
  guardando: boolean;
  capitulos: CapituloDisponible[];
  cargandoCapitulos: boolean;
  onToggleCapitulo: (capituloId: string) => void;
  onGuardar: () => void;
  onCerrar: () => void;
}) {
  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const inputCls =
    "w-full text-sm text-slate-700 bg-white border border-slate-200 rounded-[8px] px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30";
  const labelCls = "text-xs font-semibold text-slate-500 mb-1 block";

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
        className="bg-white rounded-[16px] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
          <h3 className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">
            {esEdicion ? "Editar orden de compra" : "Agregar orden de compra"}
          </h3>
          <button onClick={onCerrar} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className={labelCls}>Proveedor</label>
            <input type="text" value={form.proveedor} onChange={(e) => set("proveedor", e.target.value)} className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Descripción de ítems solicitados</label>
            <textarea
              value={form.descripcion}
              onChange={(e) => set("descripcion", e.target.value)}
              rows={2}
              placeholder="ej: 200 bolsas de portland, varillas de hierro 8mm"
              className="w-full text-sm text-slate-700 bg-white border border-slate-200 rounded-[8px] px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30 resize-y"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>Monto (opcional)</label>
              <input
                type="number"
                value={form.monto}
                onChange={(e) => set("monto", e.target.value)}
                placeholder="0"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Moneda</label>
              <select value={form.moneda} onChange={(e) => set("moneda", e.target.value as "UYU" | "USD")} className={inputCls}>
                <option value="UYU">UYU</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Fecha de pedido (opcional)</label>
              <input type="date" value={form.fechaPedido} onChange={(e) => set("fechaPedido", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Fecha de entrega prevista (opcional)</label>
              <input type="date" value={form.fechaEntregaPrevista} onChange={(e) => set("fechaEntregaPrevista", e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Estado</label>
            <select value={form.estado} onChange={(e) => set("estado", e.target.value as Estado)} className={inputCls}>
              {OPCIONES_ESTADO.map((op) => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>
          </div>

          {form.estado === "Recibido" && (
            <div className="space-y-3 border-t border-slate-100 pt-3">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Datos de recepción</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Fecha de recepción real</label>
                  <input type="date" value={form.fechaRecepcion} onChange={(e) => set("fechaRecepcion", e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>¿Llegó completo?</label>
                  <select value={form.completo} onChange={(e) => set("completo", e.target.value as "si" | "no" | "")} className={inputCls}>
                    <option value="">Sin especificar</option>
                    <option value="si">Completo</option>
                    <option value="no">Incompleto</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Observaciones de recepción (opcional)</label>
                <textarea
                  value={form.observacionesRecepcion}
                  onChange={(e) => set("observacionesRecepcion", e.target.value)}
                  rows={2}
                  placeholder="ej: faltaron 20 bolsas de portland"
                  className="w-full text-sm text-slate-700 bg-white border border-slate-200 rounded-[8px] px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30 resize-y"
                />
              </div>
            </div>
          )}

          <div>
            <label className={labelCls}>Capítulos vinculados (opcional)</label>
            {cargandoCapitulos ? (
              <p className="text-xs text-slate-400 italic">Cargando capítulos…</p>
            ) : capitulos.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Este proyecto todavía no tiene capítulos cargados.</p>
            ) : (
              <div className="border border-slate-200 rounded-[8px] max-h-40 overflow-y-auto p-2 space-y-1">
                {capitulos.map((cap) => (
                  <label key={cap.id} className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer hover:text-slate-800">
                    <input
                      type="checkbox"
                      checked={form.capituloIds.includes(cap.id)}
                      onChange={() => onToggleCapitulo(cap.id)}
                      className="rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]/30"
                    />
                    <span className="truncate">{cap.codigo} — {cap.nombre}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-200 flex gap-2 flex-shrink-0">
          <button
            onClick={onCerrar}
            className="flex-1 py-2.5 rounded-[10px] border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onGuardar}
            disabled={guardando || !form.proveedor.trim() || !form.descripcion.trim()}
            className="flex-1 py-2.5 rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {guardando ? "Guardando…" : esEdicion ? "Guardar cambios" : "Agregar orden"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
