"use client";

import { useState, useCallback, useMemo } from "react";
import {
  NotebookPen,
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
  X,
  ImagePlus,
  Cloud,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

/* ─── Tipos ───────────────────────────────────────────────── */
const OPCIONES_CLIMA = ["Soleado", "Nublado", "Lluvia", "Tormenta", "Viento fuerte", "Otro"] as const;

interface RubroVinculo {
  id: string;
  rubroId: string;
  rubro?: {
    id: string;
    codigo: string;
    descripcion: string;
    capitulo?: { nombre: string };
  };
}

interface FotoBitacora {
  id: string;
  url: string;
}

interface EntradaBitacora {
  id: string;
  numero: number;
  fecha: string;
  clima: string;
  climaDetalle: string | null;
  personalPresente: string;
  trabajosRealizados: string;
  materialesRecibidos: string;
  incidentes: string;
  instruccionesDadas: string;
  visitas: string;
  editadoEn: string | null;
  rubros: RubroVinculo[];
  _count: { fotos: number };
}

interface RubroDisponible {
  id: string;
  codigo: string;
  descripcion: string;
  capituloId: string;
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
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// timeZone: "UTC" — fecha es una fecha "solo día" (YYYY-MM-DD desde un
// <input type="date">), que new Date() parsea como medianoche UTC.
// Mismo criterio que fmtFecha en SeccionCertificaciones.tsx.
function fmtFecha(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-UY", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

function fmtFechaHora(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-UY", { day: "2-digit", month: "short", year: "numeric" }) +
    " " + d.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" });
}

type FormState = {
  fecha: string;
  clima: string;
  climaDetalle: string;
  personalPresente: string;
  trabajosRealizados: string;
  materialesRecibidos: string;
  incidentes: string;
  instruccionesDadas: string;
  visitas: string;
  rubroIds: string[];
};

function formVacio(): FormState {
  return {
    fecha: new Date().toISOString().slice(0, 10),
    clima: "Soleado",
    climaDetalle: "",
    personalPresente: "",
    trabajosRealizados: "",
    materialesRecibidos: "",
    incidentes: "",
    instruccionesDadas: "",
    visitas: "",
    rubroIds: [],
  };
}

function formDesdeEntrada(e: EntradaBitacora): FormState {
  return {
    fecha: e.fecha.slice(0, 10),
    clima: e.clima,
    climaDetalle: e.climaDetalle ?? "",
    personalPresente: e.personalPresente,
    trabajosRealizados: e.trabajosRealizados,
    materialesRecibidos: e.materialesRecibidos,
    incidentes: e.incidentes,
    instruccionesDadas: e.instruccionesDadas,
    visitas: e.visitas,
    rubroIds: e.rubros.map((r) => r.rubroId),
  };
}

/* ─── Componente principal ────────────────────────────────── */
export default function SeccionBitacora({ proyectoId }: Props) {
  const [expandido, setExpandido] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [entradas, setEntradas] = useState<EntradaBitacora[]>([]);
  const [entradaAbiertaId, setEntradaAbiertaId] = useState<string | null>(null);
  const [fotosPorEntrada, setFotosPorEntrada] = useState<Record<string, FotoBitacora[]>>({});
  const [subiendoFotos, setSubiendoFotos] = useState<Record<string, boolean>>({});

  const [formularioAbierto, setFormularioAbierto] = useState<"nueva" | string | null>(null);
  const [form, setForm] = useState<FormState>(formVacio());
  const [guardando, setGuardando] = useState(false);

  const [capitulosDisponibles, setCapitulosDisponibles] = useState<CapituloDisponible[]>([]);
  const [rubrosDisponibles, setRubrosDisponibles] = useState<RubroDisponible[]>([]);
  const [cargandoRubros, setCargandoRubros] = useState(false);

  /* ── Carga de entradas ─────────────────────────────────── */
  const cargarLista = useCallback(async () => {
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/bitacora`);
      const data = await res.json();
      setEntradas(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("[bitacora] error cargando lista", err);
    } finally {
      setCargado(true);
    }
  }, [proyectoId]);

  const abrirSeccion = () => {
    setExpandido((p) => !p);
    if (!cargado) cargarLista();
  };

  /* ── Capítulos/rubros disponibles para vincular (mismo patrón
      de carga/aplanado que SeccionComparativoOfertas.tsx) ──── */
  const cargarCapitulosYRubros = useCallback(async () => {
    setCargandoRubros(true);
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}`);
      const proyecto = await res.json();
      const caps: CapituloDisponible[] = [];
      const rubs: RubroDisponible[] = [];
      for (const cap of proyecto.capitulos ?? []) {
        caps.push({ id: cap.id, nombre: cap.nombre, codigo: cap.codigo });
        for (const r of cap.rubros ?? []) {
          rubs.push({ id: r.id, codigo: r.codigo, descripcion: r.descripcion, capituloId: cap.id });
        }
      }
      setCapitulosDisponibles(caps);
      setRubrosDisponibles(rubs);
    } catch (err) {
      console.error("[bitacora] error cargando capítulos/rubros", err);
    } finally {
      setCargandoRubros(false);
    }
  }, [proyectoId]);

  /* ── Abrir formulario (nueva / editar) ─────────────────── */
  const abrirNuevaEntrada = () => {
    setForm(formVacio());
    setFormularioAbierto("nueva");
    if (capitulosDisponibles.length === 0) cargarCapitulosYRubros();
  };

  const abrirEdicion = (entrada: EntradaBitacora) => {
    setForm(formDesdeEntrada(entrada));
    setFormularioAbierto(entrada.id);
    if (capitulosDisponibles.length === 0) cargarCapitulosYRubros();
  };

  const cerrarFormulario = () => setFormularioAbierto(null);

  const toggleRubro = (rubroId: string) => {
    setForm((prev) => ({
      ...prev,
      rubroIds: prev.rubroIds.includes(rubroId)
        ? prev.rubroIds.filter((id) => id !== rubroId)
        : [...prev.rubroIds, rubroId],
    }));
  };

  /* ── Guardar (crear o editar) ──────────────────────────── */
  const guardar = async () => {
    if (!form.clima.trim()) return;
    setGuardando(true);
    try {
      const esEdicion = formularioAbierto !== "nueva" && formularioAbierto != null;
      const url = esEdicion
        ? `/api/proyectos/${proyectoId}/bitacora/${formularioAbierto}`
        : `/api/proyectos/${proyectoId}/bitacora`;
      const res = await fetch(url, {
        method: esEdicion ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("No se pudo guardar");
      const data: EntradaBitacora = await res.json();
      setEntradas((prev) => {
        if (esEdicion) return prev.map((e) => (e.id === data.id ? data : e));
        return [data, ...prev];
      });
      setFormularioAbierto(null);
    } catch (err) {
      console.error("[bitacora] error guardando entrada", err);
    } finally {
      setGuardando(false);
    }
  };

  /* ── Expandir entrada / fotos ──────────────────────────── */
  const toggleEntrada = useCallback(
    async (entradaId: string) => {
      if (entradaAbiertaId === entradaId) {
        setEntradaAbiertaId(null);
        return;
      }
      setEntradaAbiertaId(entradaId);
      if (fotosPorEntrada[entradaId]) return;
      try {
        const res = await fetch(`/api/proyectos/${proyectoId}/bitacora/${entradaId}/fotos`);
        const data = await res.json();
        setFotosPorEntrada((prev) => ({ ...prev, [entradaId]: Array.isArray(data.fotos) ? data.fotos : [] }));
      } catch (err) {
        console.error("[bitacora] error cargando fotos", err);
      }
    },
    [entradaAbiertaId, fotosPorEntrada, proyectoId]
  );

  const subirFotos = async (entradaId: string, files: FileList) => {
    if (files.length === 0) return;
    setSubiendoFotos((prev) => ({ ...prev, [entradaId]: true }));
    try {
      const fotos = await Promise.all(Array.from(files).map(fileToBase64));
      const res = await fetch(`/api/proyectos/${proyectoId}/bitacora/${entradaId}/fotos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fotos }),
      });
      if (!res.ok) throw new Error("No se pudo subir");
      const data = await res.json();
      setFotosPorEntrada((prev) => ({ ...prev, [entradaId]: data.fotos }));
      setEntradas((prev) =>
        prev.map((e) => (e.id === entradaId ? { ...e, _count: { fotos: data.fotos.length } } : e))
      );
    } catch (err) {
      console.error("[bitacora] error subiendo fotos", err);
    } finally {
      setSubiendoFotos((prev) => ({ ...prev, [entradaId]: false }));
    }
  };

  const eliminarFoto = async (entradaId: string, fotoId: string) => {
    setFotosPorEntrada((prev) => ({
      ...prev,
      [entradaId]: (prev[entradaId] ?? []).filter((f) => f.id !== fotoId),
    }));
    setEntradas((prev) =>
      prev.map((e) => (e.id === entradaId ? { ...e, _count: { fotos: Math.max(0, e._count.fotos - 1) } } : e))
    );
    try {
      await fetch(`/api/proyectos/${proyectoId}/bitacora/${entradaId}/fotos`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fotoId }),
      });
    } catch (err) {
      console.error("[bitacora] error eliminando foto", err);
    }
  };

  const rubrosPorCapitulo = useMemo(() => {
    const m = new Map<string, RubroDisponible[]>();
    rubrosDisponibles.forEach((r) => {
      if (!m.has(r.capituloId)) m.set(r.capituloId, []);
      m.get(r.capituloId)!.push(r);
    });
    return m;
  }, [rubrosDisponibles]);

  return (
    <div className="mt-6 bg-white rounded-[16px] border border-slate-300 shadow-sm overflow-hidden">
      {/* Header colapsable — mismo patrón que SeccionCertificaciones */}
      <button
        onClick={abrirSeccion}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors text-left group"
      >
        <div className="flex items-center gap-2.5">
          <NotebookPen className="w-4 h-4 text-[#2563EB]" />
          <h2 className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">Bitácora / Diario de Obra</h2>
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
                Registro diario de la obra: novedades, avances e incidentes, con fotos y rubros vinculados si
                corresponde.
              </p>
              <button
                onClick={abrirNuevaEntrada}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-colors"
              >
                <Plus className="w-4 h-4" /> Nueva entrada
              </button>

              {entradas.length === 0 ? (
                <p className="text-xs text-slate-400 italic px-1 py-3">
                  Todavía no hay entradas de bitácora para este proyecto.
                </p>
              ) : (
                <div className="space-y-2">
                  {entradas.map((entrada) => (
                    <TarjetaEntrada
                      key={entrada.id}
                      entrada={entrada}
                      abierta={entradaAbiertaId === entrada.id}
                      fotos={fotosPorEntrada[entrada.id] ?? []}
                      subiendo={subiendoFotos[entrada.id] ?? false}
                      onToggle={() => toggleEntrada(entrada.id)}
                      onEditar={() => abrirEdicion(entrada)}
                      onSubirFotos={(files) => subirFotos(entrada.id, files)}
                      onEliminarFoto={(fotoId) => eliminarFoto(entrada.id, fotoId)}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de formulario — nueva entrada / edición */}
      <AnimatePresence>
        {formularioAbierto && (
          <FormularioEntrada
            form={form}
            setForm={setForm}
            esEdicion={formularioAbierto !== "nueva"}
            guardando={guardando}
            capitulos={capitulosDisponibles}
            rubrosPorCapitulo={rubrosPorCapitulo}
            cargandoRubros={cargandoRubros}
            onToggleRubro={toggleRubro}
            onGuardar={guardar}
            onCerrar={cerrarFormulario}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Tarjeta de entrada (lista) ──────────────────────────── */
function TarjetaEntrada({
  entrada,
  abierta,
  fotos,
  subiendo,
  onToggle,
  onEditar,
  onSubirFotos,
  onEliminarFoto,
}: {
  entrada: EntradaBitacora;
  abierta: boolean;
  fotos: FotoBitacora[];
  subiendo: boolean;
  onToggle: () => void;
  onEditar: () => void;
  onSubirFotos: (files: FileList) => void;
  onEliminarFoto: (fotoId: string) => void;
}) {
  const resumen = entrada.trabajosRealizados.trim().slice(0, 90) || "(sin descripción de trabajos)";

  return (
    <div className="rounded-[10px] border border-slate-200 bg-white overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full text-left px-3.5 py-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-bold text-[#1A3A5C] flex-shrink-0">N.º{entrada.numero}</span>
            <span className="text-[11px] text-slate-400 flex-shrink-0">{fmtFecha(entrada.fecha)}</span>
            <span className="text-[11px] text-slate-300 flex-shrink-0">·</span>
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 flex-shrink-0">
              <Cloud className="w-3 h-3" /> {entrada.clima}
            </span>
          </div>
          {entrada.editadoEn && (
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 flex-shrink-0"
              title={`Editado el ${fmtFechaHora(entrada.editadoEn)}`}
            >
              Editado el {fmtFecha(entrada.editadoEn)}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-600 mt-1 truncate">{resumen}</p>
        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400">
          <span>{entrada.rubros.length} rubro{entrada.rubros.length !== 1 ? "s" : ""} vinculado{entrada.rubros.length !== 1 ? "s" : ""}</span>
          <span>{entrada._count.fotos} foto{entrada._count.fotos !== 1 ? "s" : ""}</span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {abierta && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden border-t border-slate-100"
          >
            <div className="px-3.5 py-3 space-y-3">
              <div className="flex justify-end">
                <button
                  onClick={onEditar}
                  className="flex items-center gap-1 text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
                >
                  <Pencil className="w-3 h-3" /> Editar
                </button>
              </div>

              <CampoDetalle label="Personal presente" valor={entrada.personalPresente} />
              <CampoDetalle label="Trabajos realizados" valor={entrada.trabajosRealizados} />
              <CampoDetalle label="Materiales recibidos" valor={entrada.materialesRecibidos} />
              <CampoDetalle label="Incidentes" valor={entrada.incidentes} />
              <CampoDetalle label="Instrucciones dadas" valor={entrada.instruccionesDadas} />
              <CampoDetalle label="Visitas" valor={entrada.visitas} />
              {entrada.climaDetalle && <CampoDetalle label="Detalle del clima" valor={entrada.climaDetalle} />}

              {entrada.rubros.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Rubros vinculados
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {entrada.rubros.map((v) => (
                      <span
                        key={v.id}
                        className="text-[11px] px-2 py-1 rounded-full bg-[#EFF6FF] text-[#2563EB] border border-blue-100"
                      >
                        {v.rubro?.capitulo?.nombre ? `${v.rubro.capitulo.nombre} · ` : ""}
                        {v.rubro?.descripcion ?? "(rubro eliminado)"}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Fotos</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {fotos.map((foto) => (
                    <a
                      key={foto.id}
                      href={foto.url}
                      target="_blank"
                      rel="noreferrer"
                      className="relative group w-16 h-16 rounded-[6px] overflow-hidden border border-slate-200 flex-shrink-0"
                    >
                      <img src={foto.url} alt="Foto de bitácora" className="w-full h-full object-cover" />
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          onEliminarFoto(foto.id);
                        }}
                        className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Eliminar foto"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </a>
                  ))}
                  <label className="flex flex-col items-center justify-center gap-1 w-16 h-16 rounded-[6px] border border-dashed border-slate-300 text-slate-400 hover:text-[#2563EB] hover:border-[#2563EB] transition-colors cursor-pointer flex-shrink-0">
                    <ImagePlus className="w-4 h-4" />
                    <span className="text-[9px] font-medium">{subiendo ? "…" : "Agregar"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={subiendo}
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) onSubirFotos(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CampoDetalle({ label, valor }: { label: string; valor: string }) {
  if (!valor.trim()) return null;
  return (
    <div>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{valor}</p>
    </div>
  );
}

/* ─── Modal de formulario (nueva / editar) ────────────────── */
function FormularioEntrada({
  form,
  setForm,
  esEdicion,
  guardando,
  capitulos,
  rubrosPorCapitulo,
  cargandoRubros,
  onToggleRubro,
  onGuardar,
  onCerrar,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  esEdicion: boolean;
  guardando: boolean;
  capitulos: CapituloDisponible[];
  rubrosPorCapitulo: Map<string, RubroDisponible[]>;
  cargandoRubros: boolean;
  onToggleRubro: (rubroId: string) => void;
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
            {esEdicion ? "Editar entrada" : "Nueva entrada de bitácora"}
          </h3>
          <button onClick={onCerrar} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Fecha</label>
              <input
                type="date"
                value={form.fecha}
                onChange={(e) => set("fecha", e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Clima</label>
              <select value={form.clima} onChange={(e) => set("clima", e.target.value)} className={inputCls}>
                {OPCIONES_CLIMA.map((op) => (
                  <option key={op} value={op}>{op}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Detalle del clima (opcional)</label>
            <input
              type="text"
              value={form.climaDetalle}
              onChange={(e) => set("climaDetalle", e.target.value)}
              placeholder="ej: llovizna al final de la tarde"
              className={inputCls}
            />
          </div>

          <CampoTextarea label="Personal presente" value={form.personalPresente} onChange={(v) => set("personalPresente", v)} placeholder="ej: 2 oficiales albañiles, 3 peones" />
          <CampoTextarea label="Trabajos realizados" value={form.trabajosRealizados} onChange={(v) => set("trabajosRealizados", v)} />
          <CampoTextarea label="Materiales recibidos" value={form.materialesRecibidos} onChange={(v) => set("materialesRecibidos", v)} />
          <CampoTextarea label="Incidentes" value={form.incidentes} onChange={(v) => set("incidentes", v)} />
          <CampoTextarea label="Instrucciones dadas" value={form.instruccionesDadas} onChange={(v) => set("instruccionesDadas", v)} />
          <CampoTextarea label="Visitas" value={form.visitas} onChange={(v) => set("visitas", v)} />

          <div>
            <label className={labelCls}>Rubros vinculados</label>
            {cargandoRubros ? (
              <p className="text-xs text-slate-400 italic">Cargando capítulos y rubros…</p>
            ) : capitulos.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Este proyecto todavía no tiene capítulos/rubros cargados.</p>
            ) : (
              <div className="border border-slate-200 rounded-[8px] max-h-56 overflow-y-auto divide-y divide-slate-100">
                {capitulos.map((cap) => {
                  const rubrosDelCap = rubrosPorCapitulo.get(cap.id) ?? [];
                  if (rubrosDelCap.length === 0) return null;
                  return (
                    <div key={cap.id} className="px-3 py-2">
                      <p className="text-[11px] font-bold text-[#1A3A5C] uppercase tracking-wide mb-1">
                        {cap.codigo ? `${cap.codigo} · ` : ""}{cap.nombre}
                      </p>
                      <div className="space-y-1">
                        {rubrosDelCap.map((r) => (
                          <label key={r.id} className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer hover:text-slate-800">
                            <input
                              type="checkbox"
                              checked={form.rubroIds.includes(r.id)}
                              onChange={() => onToggleRubro(r.id)}
                              className="rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]/30"
                            />
                            <span className="truncate">{r.codigo} — {r.descripcion}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
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
            disabled={guardando || !form.clima.trim()}
            className="flex-1 py-2.5 rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {guardando ? "Guardando…" : esEdicion ? "Guardar cambios" : "Crear entrada"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function CampoTextarea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-500 mb-1 block">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="w-full text-sm text-slate-700 bg-white border border-slate-200 rounded-[8px] px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30 resize-y"
      />
    </div>
  );
}
