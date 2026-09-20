"use client";

import { useState, useCallback, useMemo } from "react";
import { Handshake, ChevronDown, ChevronRight, Plus, Pencil, X, Phone, Mail, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

/* ─── Tipos ───────────────────────────────────────────────── */
const OPCIONES_ESTADO = ["En negociación", "Contratado", "En obra", "Finalizado", "Cancelado"] as const;
type Estado = (typeof OPCIONES_ESTADO)[number];

const ESTILO_ESTADO: Record<Estado, string> = {
  "En negociación": "bg-amber-50 text-amber-600 border-amber-200",
  "Contratado": "bg-amber-50 text-amber-600 border-amber-200",
  "En obra": "bg-emerald-50 text-emerald-600 border-emerald-200",
  "Finalizado": "bg-slate-100 text-slate-500 border-slate-200",
  "Cancelado": "bg-red-50 text-red-600 border-red-200",
};

interface CapituloVinculo {
  id: string;
  capituloId: string;
  capitulo?: { id: string; nombre: string; codigo: string };
}

interface Subcontratista {
  id: string;
  empresa: string;
  rut: string | null;
  rubro: string;
  personaContacto: string | null;
  telefono: string | null;
  email: string | null;
  montoContratado: number | null;
  moneda: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  estado: Estado;
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
  empresa: string;
  rut: string;
  rubro: string;
  personaContacto: string;
  telefono: string;
  email: string;
  montoContratado: string;
  moneda: "UYU" | "USD";
  fechaInicio: string;
  fechaFin: string;
  estado: Estado;
  capituloIds: string[];
};

function formVacio(): FormState {
  return {
    empresa: "",
    rut: "",
    rubro: "",
    personaContacto: "",
    telefono: "",
    email: "",
    montoContratado: "",
    moneda: "UYU",
    fechaInicio: "",
    fechaFin: "",
    estado: "En negociación",
    capituloIds: [],
  };
}

function formDesdeSubcontratista(s: Subcontratista): FormState {
  return {
    empresa: s.empresa,
    rut: s.rut ?? "",
    rubro: s.rubro,
    personaContacto: s.personaContacto ?? "",
    telefono: s.telefono ?? "",
    email: s.email ?? "",
    montoContratado: s.montoContratado != null ? String(s.montoContratado) : "",
    moneda: s.moneda === "USD" ? "USD" : "UYU",
    fechaInicio: s.fechaInicio ? s.fechaInicio.slice(0, 10) : "",
    fechaFin: s.fechaFin ? s.fechaFin.slice(0, 10) : "",
    estado: s.estado,
    capituloIds: s.capitulos.map((c) => c.capituloId),
  };
}

/* ─── Componente principal ────────────────────────────────── */
export default function SeccionSubcontratistas({ proyectoId }: Props) {
  const [expandido, setExpandido] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [subcontratistas, setSubcontratistas] = useState<Subcontratista[]>([]);

  const [formularioAbierto, setFormularioAbierto] = useState<"nuevo" | string | null>(null);
  const [form, setForm] = useState<FormState>(formVacio());
  const [guardando, setGuardando] = useState(false);

  const [capitulosDisponibles, setCapitulosDisponibles] = useState<CapituloDisponible[]>([]);
  const [cargandoCapitulos, setCargandoCapitulos] = useState(false);

  const cargarLista = useCallback(async () => {
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/subcontratistas`);
      const data = await res.json();
      setSubcontratistas(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("[subcontratistas] error cargando lista", err);
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
      console.error("[subcontratistas] error cargando capítulos", err);
    } finally {
      setCargandoCapitulos(false);
    }
  }, [proyectoId]);

  const abrirNuevo = () => {
    setForm(formVacio());
    setFormularioAbierto("nuevo");
    if (capitulosDisponibles.length === 0) cargarCapitulos();
  };

  const abrirEdicion = (sub: Subcontratista) => {
    setForm(formDesdeSubcontratista(sub));
    setFormularioAbierto(sub.id);
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
    if (!form.empresa.trim() || !form.rubro.trim()) return;
    setGuardando(true);
    try {
      const esEdicion = formularioAbierto !== "nuevo" && formularioAbierto != null;
      const url = esEdicion
        ? `/api/proyectos/${proyectoId}/subcontratistas/${formularioAbierto}`
        : `/api/proyectos/${proyectoId}/subcontratistas`;
      const body = {
        ...form,
        montoContratado: form.montoContratado.trim() ? Number(form.montoContratado) : null,
      };
      const res = await fetch(url, {
        method: esEdicion ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("No se pudo guardar");
      const data: Subcontratista = await res.json();
      setSubcontratistas((prev) => {
        if (esEdicion) return prev.map((s) => (s.id === data.id ? data : s));
        return [...prev, data];
      });
      setFormularioAbierto(null);
    } catch (err) {
      console.error("[subcontratistas] error guardando", err);
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
          <Handshake className="w-4 h-4 text-[#2563EB]" />
          <h2 className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">Subcontratistas y Gremios</h2>
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
                Directorio de subcontratistas y gremios de esta obra: quién es, qué rubro cubre, el monto
                contratado y el estado del contrato.
              </p>

              <button
                onClick={abrirNuevo}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-colors"
              >
                <Plus className="w-4 h-4" /> Agregar subcontratista
              </button>

              {subcontratistas.length === 0 ? (
                <p className="text-xs text-slate-400 italic px-1 py-3">
                  Todavía no hay subcontratistas registrados en este proyecto.
                </p>
              ) : (
                <div className="space-y-2">
                  {subcontratistas.map((sub) => (
                    <FilaSubcontratista key={sub.id} sub={sub} onEditar={() => abrirEdicion(sub)} />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {formularioAbierto && (
          <FormularioSubcontratista
            form={form}
            setForm={setForm}
            esEdicion={formularioAbierto !== "nuevo"}
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

/* ─── Fila de subcontratista ──────────────────────────────── */
function FilaSubcontratista({ sub, onEditar }: { sub: Subcontratista; onEditar: () => void }) {
  return (
    <div className="rounded-[10px] border border-slate-200 bg-white px-3.5 py-3">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-bold text-[#1A3A5C] truncate">{sub.empresa}</span>
            <span
              className={cn(
                "text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0",
                ESTILO_ESTADO[sub.estado]
              )}
            >
              {sub.estado}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{sub.rubro}</p>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5 text-[11px] text-slate-400">
            {sub.personaContacto && (
              <span className="inline-flex items-center gap-1">
                <User className="w-3 h-3" /> {sub.personaContacto}
              </span>
            )}
            {sub.telefono && (
              <span className="inline-flex items-center gap-1">
                <Phone className="w-3 h-3" /> {sub.telefono}
              </span>
            )}
            {sub.email && (
              <span className="inline-flex items-center gap-1">
                <Mail className="w-3 h-3" /> {sub.email}
              </span>
            )}
          </div>

          {(sub.fechaInicio || sub.fechaFin) && (
            <p className="text-[11px] text-slate-400 mt-1">
              {sub.fechaInicio ? fmtFecha(sub.fechaInicio) : "?"} — {sub.fechaFin ? fmtFecha(sub.fechaFin) : "?"}
            </p>
          )}

          {sub.capitulos.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {sub.capitulos.map((v) => (
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
          {sub.montoContratado != null && (
            <span className="text-sm font-bold text-[#1A3A5C]">{fmtMonto(sub.montoContratado, sub.moneda)}</span>
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

/* ─── Modal de formulario (nuevo / editar) ────────────────── */
function FormularioSubcontratista({
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
            {esEdicion ? "Editar subcontratista" : "Agregar subcontratista"}
          </h3>
          <button onClick={onCerrar} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Empresa / razón social</label>
              <input type="text" value={form.empresa} onChange={(e) => set("empresa", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>RUT (opcional)</label>
              <input type="text" value={form.rut} onChange={(e) => set("rut", e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Rubro / especialidad</label>
            <input
              type="text"
              value={form.rubro}
              onChange={(e) => set("rubro", e.target.value)}
              placeholder="ej: Instalación eléctrica"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Persona de contacto (opcional)</label>
              <input type="text" value={form.personaContacto} onChange={(e) => set("personaContacto", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Teléfono (opcional)</label>
              <input type="text" value={form.telefono} onChange={(e) => set("telefono", e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Email (opcional)</label>
            <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={inputCls} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>Monto contratado (opcional)</label>
              <input
                type="number"
                value={form.montoContratado}
                onChange={(e) => set("montoContratado", e.target.value)}
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
              <label className={labelCls}>Fecha de inicio prevista (opcional)</label>
              <input type="date" value={form.fechaInicio} onChange={(e) => set("fechaInicio", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Fecha de fin prevista (opcional)</label>
              <input type="date" value={form.fechaFin} onChange={(e) => set("fechaFin", e.target.value)} className={inputCls} />
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
            disabled={guardando || !form.empresa.trim() || !form.rubro.trim()}
            className="flex-1 py-2.5 rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {guardando ? "Guardando…" : esEdicion ? "Guardar cambios" : "Agregar subcontratista"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
