"use client";

import { useState, useCallback } from "react";
import { HardHat, ChevronDown, ChevronRight, Plus, Pencil, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

/* ─── Tipos ───────────────────────────────────────────────── */
const OPCIONES_ESTADO = ["Pendiente", "En trámite", "Aprobado", "Rechazado"] as const;
type Estado = (typeof OPCIONES_ESTADO)[number];

const ESTILO_ESTADO: Record<Estado, string> = {
  "Pendiente": "bg-slate-100 text-slate-500 border-slate-200",
  "En trámite": "bg-amber-50 text-amber-600 border-amber-200",
  "Aprobado": "bg-emerald-50 text-emerald-600 border-emerald-200",
  "Rechazado": "bg-red-50 text-red-600 border-red-200",
};

interface Tramite {
  id: string;
  nombre: string;
  organismo: string | null;
  estado: Estado;
  fecha: string | null;
  observaciones: string | null;
}

interface Props {
  proyectoId: string;
}

/* ─── Formato ─────────────────────────────────────────────── */
function fmtFecha(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-UY", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

type FormState = {
  nombre: string;
  organismo: string;
  estado: Estado;
  fecha: string;
  observaciones: string;
};

function formVacio(): FormState {
  return { nombre: "", organismo: "", estado: "Pendiente", fecha: "", observaciones: "" };
}

function formDesdeTramite(t: Tramite): FormState {
  return {
    nombre: t.nombre,
    organismo: t.organismo ?? "",
    estado: t.estado,
    fecha: t.fecha ? t.fecha.slice(0, 10) : "",
    observaciones: t.observaciones ?? "",
  };
}

/* ─── Componente principal ────────────────────────────────── */
export default function SeccionTramitesLegales({ proyectoId }: Props) {
  const [expandido, setExpandido] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [tramites, setTramites] = useState<Tramite[]>([]);

  const [formularioAbierto, setFormularioAbierto] = useState<"nuevo" | string | null>(null);
  const [form, setForm] = useState<FormState>(formVacio());
  const [guardando, setGuardando] = useState(false);

  const cargarLista = useCallback(async () => {
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/tramites`);
      const data = await res.json();
      setTramites(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("[tramites] error cargando lista", err);
    } finally {
      setCargado(true);
    }
  }, [proyectoId]);

  const abrirSeccion = () => {
    setExpandido((p) => !p);
    if (!cargado) cargarLista();
  };

  const abrirNuevo = () => {
    setForm(formVacio());
    setFormularioAbierto("nuevo");
  };

  const abrirEdicion = (tramite: Tramite) => {
    setForm(formDesdeTramite(tramite));
    setFormularioAbierto(tramite.id);
  };

  const cerrarFormulario = () => setFormularioAbierto(null);

  const guardar = async () => {
    if (!form.nombre.trim()) return;
    setGuardando(true);
    try {
      const esEdicion = formularioAbierto !== "nuevo" && formularioAbierto != null;
      const url = esEdicion
        ? `/api/proyectos/${proyectoId}/tramites/${formularioAbierto}`
        : `/api/proyectos/${proyectoId}/tramites`;
      const res = await fetch(url, {
        method: esEdicion ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("No se pudo guardar");
      const data: Tramite = await res.json();
      setTramites((prev) => {
        if (esEdicion) return prev.map((t) => (t.id === data.id ? data : t));
        return [...prev, data];
      });
      setFormularioAbierto(null);
    } catch (err) {
      console.error("[tramites] error guardando", err);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="mt-6 bg-white rounded-[16px] border border-slate-300 shadow-sm overflow-hidden">
      <button
        onClick={abrirSeccion}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors text-left group"
      >
        <div className="flex items-center gap-2.5">
          <HardHat className="w-4 h-4 text-[#2563EB]" />
          <h2 className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">Inscripción y Trámites Legales</h2>
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
                Trámites e inscripciones de esta obra ante organismos (BPS, Intendencia, Bomberos, etc.) y su
                estado.
              </p>

              <button
                onClick={abrirNuevo}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-colors"
              >
                <Plus className="w-4 h-4" /> Agregar trámite
              </button>

              {tramites.length === 0 ? (
                <p className="text-xs text-slate-400 italic px-1 py-3">
                  Todavía no hay trámites registrados en este proyecto.
                </p>
              ) : (
                <div className="space-y-2">
                  {tramites.map((tramite) => (
                    <FilaTramite key={tramite.id} tramite={tramite} onEditar={() => abrirEdicion(tramite)} />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {formularioAbierto && (
          <FormularioTramite
            form={form}
            setForm={setForm}
            esEdicion={formularioAbierto !== "nuevo"}
            guardando={guardando}
            onGuardar={guardar}
            onCerrar={cerrarFormulario}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Fila de trámite ─────────────────────────────────────── */
function FilaTramite({ tramite, onEditar }: { tramite: Tramite; onEditar: () => void }) {
  return (
    <div className="rounded-[10px] border border-slate-200 bg-white px-3.5 py-3">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-bold text-[#1A3A5C] truncate">{tramite.nombre}</span>
            <span
              className={cn(
                "text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0",
                ESTILO_ESTADO[tramite.estado]
              )}
            >
              {tramite.estado}
            </span>
          </div>
          {tramite.organismo && <p className="text-xs text-slate-500 mt-0.5">{tramite.organismo}</p>}
          {tramite.fecha && <p className="text-[11px] text-slate-400 mt-1">{fmtFecha(tramite.fecha)}</p>}
          {tramite.observaciones && (
            <p className="text-[11px] text-slate-500 mt-1 italic">&quot;{tramite.observaciones}&quot;</p>
          )}
        </div>

        <button
          onClick={onEditar}
          className="flex items-center gap-1 text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors flex-shrink-0"
        >
          <Pencil className="w-3 h-3" /> Editar
        </button>
      </div>
    </div>
  );
}

/* ─── Modal de formulario (nuevo / editar) ────────────────── */
function FormularioTramite({
  form,
  setForm,
  esEdicion,
  guardando,
  onGuardar,
  onCerrar,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  esEdicion: boolean;
  guardando: boolean;
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
        className="bg-white rounded-[16px] w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col shadow-xl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
          <h3 className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">
            {esEdicion ? "Editar trámite" : "Agregar trámite"}
          </h3>
          <button onClick={onCerrar} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className={labelCls}>Nombre del trámite</label>
            <input
              type="text"
              value={form.nombre}
              onChange={(e) => set("nombre", e.target.value)}
              placeholder="ej: Permiso de construcción municipal"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Organismo (opcional)</label>
            <input
              type="text"
              value={form.organismo}
              onChange={(e) => set("organismo", e.target.value)}
              placeholder="ej: Intendencia de Montevideo, BPS"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Estado</label>
              <select value={form.estado} onChange={(e) => set("estado", e.target.value as Estado)} className={inputCls}>
                {OPCIONES_ESTADO.map((op) => (
                  <option key={op} value={op}>{op}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Fecha (opcional)</label>
              <input type="date" value={form.fecha} onChange={(e) => set("fecha", e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Observaciones (opcional)</label>
            <textarea
              value={form.observaciones}
              onChange={(e) => set("observaciones", e.target.value)}
              rows={2}
              className="w-full text-sm text-slate-700 bg-white border border-slate-200 rounded-[8px] px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30 resize-y"
            />
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
            disabled={guardando || !form.nombre.trim()}
            className="flex-1 py-2.5 rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {guardando ? "Guardando…" : esEdicion ? "Guardar cambios" : "Agregar trámite"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
