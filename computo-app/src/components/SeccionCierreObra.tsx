"use client";

import { useState, useCallback } from "react";
import {
  ClipboardCheck,
  ChevronDown,
  ChevronRight,
  Pencil,
  X,
  Plus,
  Trash2,
  FileText,
  Image as ImageIcon,
  File as FileIcon,
  ExternalLink,
  Download,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

/* ─── Tipos ───────────────────────────────────────────────── */
const OPCIONES_ESTADO_OBS = ["Aprobado sin observaciones", "Con observaciones pendientes"] as const;
type EstadoObs = (typeof OPCIONES_ESTADO_OBS)[number];

const OPCIONES_ROL = ["Director de obra", "Comitente", "Contratista", "Otro"] as const;
type Rol = (typeof OPCIONES_ROL)[number];

interface Observacion {
  id: string;
  rubroId: string;
  observacion: string;
  estado: EstadoObs;
  rubro: { id: string; codigo: string; descripcion: string; capitulo?: { nombre: string } };
}

interface FirmanteItem {
  id: string;
  nombre: string;
  rol: Rol;
  firmado: boolean;
}

interface Documento {
  id: string;
  nombre: string;
  nombreArchivoOriginal: string;
  tipoArchivo: string;
  tamano: number | null;
}

interface ActaCierre {
  id: string;
  fechaCierre: string | null;
  observacionesGenerales: string | null;
  observaciones: Observacion[];
  firmantes: FirmanteItem[];
  documentos: Documento[];
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

function fmtFecha(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-UY", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

function fmtTamano(bytes: number | null): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function iconoParaTipo(tipoArchivo: string) {
  if (tipoArchivo === "application/pdf") return FileText;
  if (tipoArchivo.startsWith("image/")) return ImageIcon;
  return FileIcon;
}

const ESTILO_ESTADO_OBS: Record<EstadoObs, string> = {
  "Aprobado sin observaciones": "bg-emerald-50 text-emerald-600 border-emerald-200",
  "Con observaciones pendientes": "bg-amber-50 text-amber-600 border-amber-200",
};

/* ─── Estados de formulario ────────────────────────────────── */
type FormGeneral = { fechaCierre: string; observacionesGenerales: string };
type FormObservacion = { rubroId: string; observacion: string; estado: EstadoObs };
type FormFirmante = { nombre: string; rol: Rol; firmado: boolean };

function formGeneralVacio(): FormGeneral {
  return { fechaCierre: "", observacionesGenerales: "" };
}
function formGeneralDesdeActa(a: ActaCierre): FormGeneral {
  return { fechaCierre: a.fechaCierre ? a.fechaCierre.slice(0, 10) : "", observacionesGenerales: a.observacionesGenerales ?? "" };
}
function formObsVacio(): FormObservacion {
  return { rubroId: "", observacion: "", estado: "Aprobado sin observaciones" };
}
function formObsDesde(o: Observacion): FormObservacion {
  return { rubroId: o.rubroId, observacion: o.observacion, estado: o.estado };
}
function formFirmanteVacio(): FormFirmante {
  return { nombre: "", rol: "Director de obra", firmado: false };
}
function formFirmanteDesde(f: FirmanteItem): FormFirmante {
  return { nombre: f.nombre, rol: f.rol, firmado: f.firmado };
}

/* ─── Componente principal ────────────────────────────────── */
export default function SeccionCierreObra({ proyectoId }: Props) {
  const [expandido, setExpandido] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [acta, setActa] = useState<ActaCierre | null>(null);

  const [capitulosDisponibles, setCapitulosDisponibles] = useState<CapituloDisponible[]>([]);
  const [rubrosDisponibles, setRubrosDisponibles] = useState<RubroDisponible[]>([]);
  const [cargandoRubros, setCargandoRubros] = useState(false);
  const [rubrosCargados, setRubrosCargados] = useState(false);

  const [formularioGeneralAbierto, setFormularioGeneralAbierto] = useState(false);
  const [formGeneral, setFormGeneral] = useState<FormGeneral>(formGeneralVacio());
  const [guardandoGeneral, setGuardandoGeneral] = useState(false);

  const [obsAbierta, setObsAbierta] = useState<"nueva" | string | null>(null);
  const [formObs, setFormObs] = useState<FormObservacion>(formObsVacio());
  const [guardandoObs, setGuardandoObs] = useState(false);

  const [firmanteAbierto, setFirmanteAbierto] = useState<"nuevo" | string | null>(null);
  const [formFirmante, setFormFirmante] = useState<FormFirmante>(formFirmanteVacio());
  const [guardandoFirmante, setGuardandoFirmante] = useState(false);

  const [nombreDocNuevo, setNombreDocNuevo] = useState("");
  const [subiendoDoc, setSubiendoDoc] = useState(false);
  const [agregandoDoc, setAgregandoDoc] = useState(false);

  const cargarActa = useCallback(async () => {
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/cierre-obra`);
      const data = await res.json();
      setActa(data ?? null);
    } catch (err) {
      console.error("[cierre-obra] error cargando acta", err);
    } finally {
      setCargado(true);
    }
  }, [proyectoId]);

  const abrirSeccion = () => {
    setExpandido((p) => !p);
    if (!cargado) cargarActa();
  };

  const cargarRubros = useCallback(async () => {
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
      console.error("[cierre-obra] error cargando rubros", err);
    } finally {
      setCargandoRubros(false);
      setRubrosCargados(true);
    }
  }, [proyectoId]);

  /* ── Datos generales ───────────────────────────────────── */
  const abrirCrearActa = () => {
    setFormGeneral(formGeneralVacio());
    setFormularioGeneralAbierto(true);
  };
  const abrirEditarGeneral = () => {
    if (!acta) return;
    setFormGeneral(formGeneralDesdeActa(acta));
    setFormularioGeneralAbierto(true);
  };
  const guardarGeneral = async () => {
    setGuardandoGeneral(true);
    try {
      const esEdicion = !!acta;
      const res = await fetch(`/api/proyectos/${proyectoId}/cierre-obra`, {
        method: esEdicion ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formGeneral),
      });
      if (!res.ok) throw new Error("No se pudo guardar");
      const data: ActaCierre = await res.json();
      setActa(data);
      setFormularioGeneralAbierto(false);
    } catch (err) {
      console.error("[cierre-obra] error guardando datos generales", err);
    } finally {
      setGuardandoGeneral(false);
    }
  };

  /* ── Observaciones por rubro ───────────────────────────── */
  const abrirNuevaObs = () => {
    setFormObs(formObsVacio());
    setObsAbierta("nueva");
    if (!rubrosCargados) cargarRubros();
  };
  const abrirEditarObs = (o: Observacion) => {
    setFormObs(formObsDesde(o));
    setObsAbierta(o.id);
    if (!rubrosCargados) cargarRubros();
  };
  const guardarObs = async () => {
    if (!formObs.rubroId || !formObs.observacion.trim()) return;
    setGuardandoObs(true);
    try {
      const esEdicion = obsAbierta !== "nueva" && obsAbierta != null;
      const url = esEdicion
        ? `/api/proyectos/${proyectoId}/cierre-obra/observaciones/${obsAbierta}`
        : `/api/proyectos/${proyectoId}/cierre-obra/observaciones`;
      const res = await fetch(url, {
        method: esEdicion ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formObs),
      });
      if (!res.ok) throw new Error("No se pudo guardar");
      const data: Observacion = await res.json();
      setActa((prev) => {
        if (!prev) return prev;
        const observaciones = esEdicion
          ? prev.observaciones.map((o) => (o.id === data.id ? data : o))
          : [...prev.observaciones, data];
        return { ...prev, observaciones };
      });
      setObsAbierta(null);
    } catch (err) {
      console.error("[cierre-obra] error guardando observación", err);
    } finally {
      setGuardandoObs(false);
    }
  };
  const eliminarObs = async (obsId: string) => {
    setActa((prev) => (prev ? { ...prev, observaciones: prev.observaciones.filter((o) => o.id !== obsId) } : prev));
    try {
      await fetch(`/api/proyectos/${proyectoId}/cierre-obra/observaciones/${obsId}`, { method: "DELETE" });
    } catch (err) {
      console.error("[cierre-obra] error eliminando observación", err);
    }
  };

  /* ── Firmantes ──────────────────────────────────────────── */
  const abrirNuevoFirmante = () => {
    setFormFirmante(formFirmanteVacio());
    setFirmanteAbierto("nuevo");
  };
  const abrirEditarFirmante = (f: FirmanteItem) => {
    setFormFirmante(formFirmanteDesde(f));
    setFirmanteAbierto(f.id);
  };
  const guardarFirmante = async () => {
    if (!formFirmante.nombre.trim()) return;
    setGuardandoFirmante(true);
    try {
      const esEdicion = firmanteAbierto !== "nuevo" && firmanteAbierto != null;
      const url = esEdicion
        ? `/api/proyectos/${proyectoId}/cierre-obra/firmantes/${firmanteAbierto}`
        : `/api/proyectos/${proyectoId}/cierre-obra/firmantes`;
      const res = await fetch(url, {
        method: esEdicion ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formFirmante),
      });
      if (!res.ok) throw new Error("No se pudo guardar");
      const data: FirmanteItem = await res.json();
      setActa((prev) => {
        if (!prev) return prev;
        const firmantes = esEdicion
          ? prev.firmantes.map((f) => (f.id === data.id ? data : f))
          : [...prev.firmantes, data];
        return { ...prev, firmantes };
      });
      setFirmanteAbierto(null);
    } catch (err) {
      console.error("[cierre-obra] error guardando firmante", err);
    } finally {
      setGuardandoFirmante(false);
    }
  };
  const eliminarFirmante = async (firmanteId: string) => {
    setActa((prev) => (prev ? { ...prev, firmantes: prev.firmantes.filter((f) => f.id !== firmanteId) } : prev));
    try {
      await fetch(`/api/proyectos/${proyectoId}/cierre-obra/firmantes/${firmanteId}`, { method: "DELETE" });
    } catch (err) {
      console.error("[cierre-obra] error eliminando firmante", err);
    }
  };
  const toggleFirmado = async (f: FirmanteItem) => {
    const anterior = f.firmado;
    setActa((prev) =>
      prev ? { ...prev, firmantes: prev.firmantes.map((x) => (x.id === f.id ? { ...x, firmado: !anterior } : x)) } : prev
    );
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/cierre-obra/firmantes/${f.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: f.nombre, rol: f.rol, firmado: !anterior }),
      });
      if (!res.ok) throw new Error("No se pudo actualizar");
      const data: FirmanteItem = await res.json();
      setActa((prev) => (prev ? { ...prev, firmantes: prev.firmantes.map((x) => (x.id === data.id ? data : x)) } : prev));
    } catch (err) {
      console.error("[cierre-obra] error marcando firmado", err);
      setActa((prev) =>
        prev ? { ...prev, firmantes: prev.firmantes.map((x) => (x.id === f.id ? { ...x, firmado: anterior } : x)) } : prev
      );
    }
  };

  /* ── Documentos ─────────────────────────────────────────── */
  const subirDocumento = async (file: File) => {
    if (!nombreDocNuevo.trim() || !acta) return;
    setSubiendoDoc(true);
    try {
      const archivo = await fileToBase64(file);
      const res = await fetch(`/api/proyectos/${proyectoId}/cierre-obra/documentos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombreDocNuevo.trim(), archivo, nombreArchivoOriginal: file.name }),
      });
      if (!res.ok) throw new Error("No se pudo subir");
      const data: Documento = await res.json();
      setActa((prev) => (prev ? { ...prev, documentos: [...prev.documentos, data] } : prev));
      setNombreDocNuevo("");
      setAgregandoDoc(false);
    } catch (err) {
      console.error("[cierre-obra] error subiendo documento", err);
    } finally {
      setSubiendoDoc(false);
    }
  };
  const eliminarDocumento = async (docId: string) => {
    setActa((prev) => (prev ? { ...prev, documentos: prev.documentos.filter((d) => d.id !== docId) } : prev));
    try {
      await fetch(`/api/proyectos/${proyectoId}/cierre-obra/documentos/${docId}`, { method: "DELETE" });
    } catch (err) {
      console.error("[cierre-obra] error eliminando documento", err);
    }
  };

  const rubrosPorCapitulo = new Map<string, RubroDisponible[]>();
  rubrosDisponibles.forEach((r) => {
    if (!rubrosPorCapitulo.has(r.capituloId)) rubrosPorCapitulo.set(r.capituloId, []);
    rubrosPorCapitulo.get(r.capituloId)!.push(r);
  });

  return (
    <div className="mt-6 bg-white rounded-[16px] border border-slate-300 shadow-sm overflow-hidden">
      <button
        onClick={abrirSeccion}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors text-left group"
      >
        <div className="flex items-center gap-2.5">
          <ClipboardCheck className="w-4 h-4 text-[#2563EB]" />
          <h2 className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">Cierre de Obra</h2>
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
            <div className="px-5 py-5 space-y-4" style={{ background: "#F8FAFC" }}>
              <p className="text-xs text-slate-500 -mt-1">
                Registro de la recepción de obra: observaciones por rubro, firmantes y el acta ya firmada
                adjunta — CÓMPUTO+ no genera ni captura firmas, solo organiza el registro.
              </p>

              {!acta ? (
                <button
                  onClick={abrirCrearActa}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-colors"
                >
                  <Plus className="w-4 h-4" /> Crear acta de cierre
                </button>
              ) : (
                <>
                  {/* Datos generales */}
                  <div className="rounded-[10px] border border-slate-200 bg-white px-3.5 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Datos generales</p>
                      <div className="flex items-center gap-3">
                        <a
                          href={`/api/proyectos/${proyectoId}/cierre-obra/pdf`}
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
                        <p className="text-[10px] font-semibold text-slate-400 mb-0.5">Fecha de cierre/recepción</p>
                        <p className={acta.fechaCierre ? "text-slate-700 font-medium" : "text-slate-400 italic"}>
                          {acta.fechaCierre ? fmtFecha(acta.fechaCierre) : "Sin definir"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-slate-400 mb-0.5">Observaciones generales</p>
                        <p className={acta.observacionesGenerales ? "text-slate-700 font-medium whitespace-pre-wrap" : "text-slate-400 italic"}>
                          {acta.observacionesGenerales || "Sin definir"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Observaciones por rubro */}
                  <div className="rounded-[10px] border border-slate-200 bg-white px-3.5 py-3">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Observaciones por rubro</p>
                    {acta.observaciones.length === 0 ? (
                      <p className="text-xs text-slate-400 italic mb-2">Todavía no hay observaciones cargadas.</p>
                    ) : (
                      <div className="space-y-1.5 mb-2">
                        {acta.observaciones.map((o) => (
                          <div key={o.id} className="rounded-[8px] border border-slate-100 px-2.5 py-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <span className="text-xs font-semibold text-[#1A3A5C]">
                                    {o.rubro.codigo} — {o.rubro.descripcion}
                                  </span>
                                  <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full border flex-shrink-0", ESTILO_ESTADO_OBS[o.estado])}>
                                    {o.estado}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-600 mt-0.5">{o.observacion}</p>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <button onClick={() => abrirEditarObs(o)} className="text-slate-400 hover:text-[#2563EB] transition-colors p-1">
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => eliminarObs(o.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={abrirNuevaObs}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-[8px] border border-dashed border-slate-300 text-slate-500 text-xs font-medium hover:border-[#2563EB] hover:text-[#2563EB] transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Agregar observación
                    </button>
                  </div>

                  {/* Firmantes */}
                  <div className="rounded-[10px] border border-slate-200 bg-white px-3.5 py-3">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Firmantes</p>
                    {acta.firmantes.length === 0 ? (
                      <p className="text-xs text-slate-400 italic mb-2">Todavía no hay firmantes cargados.</p>
                    ) : (
                      <div className="space-y-1.5 mb-2">
                        {acta.firmantes.map((f) => (
                          <div key={f.id} className="flex items-center justify-between gap-2 rounded-[8px] border border-slate-100 px-2.5 py-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-slate-700 truncate">{f.nombre}</p>
                              <p className="text-[11px] text-slate-400">{f.rol}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button
                                onClick={() => toggleFirmado(f)}
                                className={cn(
                                  "text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors",
                                  f.firmado ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"
                                )}
                              >
                                {f.firmado ? "Firmado" : "Falta firmar"}
                              </button>
                              <button onClick={() => abrirEditarFirmante(f)} className="text-slate-400 hover:text-[#2563EB] transition-colors p-1">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => eliminarFirmante(f.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={abrirNuevoFirmante}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-[8px] border border-dashed border-slate-300 text-slate-500 text-xs font-medium hover:border-[#2563EB] hover:text-[#2563EB] transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Agregar firmante
                    </button>
                  </div>

                  {/* Documentos */}
                  <div className="rounded-[10px] border border-slate-200 bg-white px-3.5 py-3">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Documentos y anexos</p>
                    {acta.documentos.length === 0 ? (
                      <p className="text-xs text-slate-400 italic mb-2">Todavía no se subió ningún documento.</p>
                    ) : (
                      <div className="space-y-1.5 mb-2">
                        {acta.documentos.map((doc) => (
                          <FilaDocumento key={doc.id} doc={doc} proyectoId={proyectoId} onEliminar={() => eliminarDocumento(doc.id)} />
                        ))}
                      </div>
                    )}

                    {agregandoDoc ? (
                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        <input
                          type="text"
                          value={nombreDocNuevo}
                          onChange={(e) => setNombreDocNuevo(e.target.value)}
                          placeholder='ej: "Acta de recepción firmada"'
                          className="w-full text-sm text-slate-700 bg-white border border-slate-200 rounded-[8px] px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30"
                        />
                        <div className="flex items-center gap-2">
                          <label
                            className={cn(
                              "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-[8px] text-sm font-semibold transition-colors cursor-pointer",
                              nombreDocNuevo.trim() && !subiendoDoc ? "bg-[#2563EB] hover:bg-[#1D4ED8] text-white" : "bg-slate-100 text-slate-400 cursor-not-allowed"
                            )}
                          >
                            {subiendoDoc ? "Subiendo…" : "Elegir archivo"}
                            <input
                              type="file"
                              disabled={!nombreDocNuevo.trim() || subiendoDoc}
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files?.[0]) subirDocumento(e.target.files[0]);
                                e.target.value = "";
                              }}
                            />
                          </label>
                          <button
                            onClick={() => { setAgregandoDoc(false); setNombreDocNuevo(""); }}
                            className="px-3 py-2 rounded-[8px] border border-slate-200 text-slate-500 text-sm hover:bg-slate-50 transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAgregandoDoc(true)}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-[8px] border border-dashed border-slate-300 text-slate-500 text-xs font-medium hover:border-[#2563EB] hover:text-[#2563EB] transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> Agregar documento
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal — datos generales */}
      <AnimatePresence>
        {formularioGeneralAbierto && (
          <FormularioGeneral
            form={formGeneral}
            setForm={setFormGeneral}
            esEdicion={!!acta}
            guardando={guardandoGeneral}
            onGuardar={guardarGeneral}
            onCerrar={() => setFormularioGeneralAbierto(false)}
          />
        )}
      </AnimatePresence>

      {/* Modal — observación de rubro */}
      <AnimatePresence>
        {obsAbierta && (
          <FormularioObservacion
            form={formObs}
            setForm={setFormObs}
            esEdicion={obsAbierta !== "nueva"}
            guardando={guardandoObs}
            capitulos={capitulosDisponibles}
            rubrosPorCapitulo={rubrosPorCapitulo}
            cargandoRubros={cargandoRubros}
            onGuardar={guardarObs}
            onCerrar={() => setObsAbierta(null)}
          />
        )}
      </AnimatePresence>

      {/* Modal — firmante */}
      <AnimatePresence>
        {firmanteAbierto && (
          <FormularioFirmante
            form={formFirmante}
            setForm={setFormFirmante}
            esEdicion={firmanteAbierto !== "nuevo"}
            guardando={guardandoFirmante}
            onGuardar={guardarFirmante}
            onCerrar={() => setFirmanteAbierto(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Documento — fila ─────────────────────────────────────── */
function FilaDocumento({ doc, proyectoId, onEliminar }: { doc: Documento; proyectoId: string; onEliminar: () => void }) {
  const Icono = iconoParaTipo(doc.tipoArchivo);
  const url = `/api/proyectos/${proyectoId}/cierre-obra/documentos/${doc.id}/archivo`;
  return (
    <div className="flex items-center justify-between gap-2 rounded-[8px] border border-slate-100 px-2.5 py-2">
      <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 min-w-0 flex-1 group">
        <Icono className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-700 truncate group-hover:text-[#2563EB] transition-colors">{doc.nombre}</p>
          <p className="text-[10px] text-slate-400 truncate">
            {doc.nombreArchivoOriginal}
            {doc.tamano != null && ` · ${fmtTamano(doc.tamano)}`}
          </p>
        </div>
        <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-[#2563EB] transition-colors flex-shrink-0" />
      </a>
      <button onClick={onEliminar} className="text-slate-300 hover:text-red-500 transition-colors p-1 flex-shrink-0" title="Eliminar documento">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/* ─── Modal — datos generales ──────────────────────────────── */
function FormularioGeneral({
  form,
  setForm,
  esEdicion,
  guardando,
  onGuardar,
  onCerrar,
}: {
  form: FormGeneral;
  setForm: React.Dispatch<React.SetStateAction<FormGeneral>>;
  esEdicion: boolean;
  guardando: boolean;
  onGuardar: () => void;
  onCerrar: () => void;
}) {
  const inputCls = "w-full text-sm text-slate-700 bg-white border border-slate-200 rounded-[8px] px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30";
  const labelCls = "text-xs font-semibold text-slate-500 mb-1 block";
  return (
    <ModalBase titulo={esEdicion ? "Editar datos generales" : "Crear acta de cierre"} onCerrar={onCerrar}>
      <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
        <div>
          <label className={labelCls}>Fecha de cierre/recepción</label>
          <input type="date" value={form.fechaCierre} onChange={(e) => setForm((p) => ({ ...p, fechaCierre: e.target.value }))} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Observaciones generales</label>
          <textarea
            value={form.observacionesGenerales}
            onChange={(e) => setForm((p) => ({ ...p, observacionesGenerales: e.target.value }))}
            rows={3}
            className="w-full text-sm text-slate-700 bg-white border border-slate-200 rounded-[8px] px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30 resize-y"
          />
        </div>
      </div>
      <FooterModal guardando={guardando} esEdicion={esEdicion} onGuardar={onGuardar} onCerrar={onCerrar} textoCrear="Crear acta" />
    </ModalBase>
  );
}

/* ─── Modal — observación de rubro ─────────────────────────── */
function FormularioObservacion({
  form,
  setForm,
  esEdicion,
  guardando,
  capitulos,
  rubrosPorCapitulo,
  cargandoRubros,
  onGuardar,
  onCerrar,
}: {
  form: FormObservacion;
  setForm: React.Dispatch<React.SetStateAction<FormObservacion>>;
  esEdicion: boolean;
  guardando: boolean;
  capitulos: CapituloDisponible[];
  rubrosPorCapitulo: Map<string, RubroDisponible[]>;
  cargandoRubros: boolean;
  onGuardar: () => void;
  onCerrar: () => void;
}) {
  const inputCls = "w-full text-sm text-slate-700 bg-white border border-slate-200 rounded-[8px] px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30";
  const labelCls = "text-xs font-semibold text-slate-500 mb-1 block";
  return (
    <ModalBase titulo={esEdicion ? "Editar observación" : "Agregar observación de rubro"} onCerrar={onCerrar}>
      <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
        <div>
          <label className={labelCls}>Rubro</label>
          {cargandoRubros ? (
            <p className="text-xs text-slate-400 italic">Cargando rubros…</p>
          ) : capitulos.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Este proyecto todavía no tiene rubros cargados.</p>
          ) : (
            <select value={form.rubroId} onChange={(e) => setForm((p) => ({ ...p, rubroId: e.target.value }))} className={inputCls}>
              <option value="">Seleccioná un rubro…</option>
              {capitulos.map((cap) => {
                const rubros = rubrosPorCapitulo.get(cap.id) ?? [];
                if (rubros.length === 0) return null;
                return (
                  <optgroup key={cap.id} label={`${cap.codigo ? cap.codigo + " · " : ""}${cap.nombre}`}>
                    {rubros.map((r) => (
                      <option key={r.id} value={r.id}>{r.codigo} — {r.descripcion}</option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          )}
        </div>
        <div>
          <label className={labelCls}>Observación</label>
          <textarea
            value={form.observacion}
            onChange={(e) => setForm((p) => ({ ...p, observacion: e.target.value }))}
            rows={2}
            className="w-full text-sm text-slate-700 bg-white border border-slate-200 rounded-[8px] px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30 resize-y"
          />
        </div>
        <div>
          <label className={labelCls}>Estado</label>
          <select value={form.estado} onChange={(e) => setForm((p) => ({ ...p, estado: e.target.value as EstadoObs }))} className={inputCls}>
            {OPCIONES_ESTADO_OBS.map((op) => (
              <option key={op} value={op}>{op}</option>
            ))}
          </select>
        </div>
      </div>
      <FooterModal
        guardando={guardando}
        esEdicion={esEdicion}
        onGuardar={onGuardar}
        onCerrar={onCerrar}
        textoCrear="Agregar observación"
        deshabilitado={!form.rubroId || !form.observacion.trim()}
      />
    </ModalBase>
  );
}

/* ─── Modal — firmante ──────────────────────────────────────── */
function FormularioFirmante({
  form,
  setForm,
  esEdicion,
  guardando,
  onGuardar,
  onCerrar,
}: {
  form: FormFirmante;
  setForm: React.Dispatch<React.SetStateAction<FormFirmante>>;
  esEdicion: boolean;
  guardando: boolean;
  onGuardar: () => void;
  onCerrar: () => void;
}) {
  const inputCls = "w-full text-sm text-slate-700 bg-white border border-slate-200 rounded-[8px] px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30";
  const labelCls = "text-xs font-semibold text-slate-500 mb-1 block";
  return (
    <ModalBase titulo={esEdicion ? "Editar firmante" : "Agregar firmante"} onCerrar={onCerrar}>
      <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
        <div>
          <label className={labelCls}>Nombre</label>
          <input type="text" value={form.nombre} onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Rol</label>
          <select value={form.rol} onChange={(e) => setForm((p) => ({ ...p, rol: e.target.value as Rol }))} className={inputCls}>
            {OPCIONES_ROL.map((op) => (
              <option key={op} value={op}>{op}</option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.firmado}
            onChange={(e) => setForm((p) => ({ ...p, firmado: e.target.checked }))}
            className="rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]/30"
          />
          Ya firmó
        </label>
      </div>
      <FooterModal guardando={guardando} esEdicion={esEdicion} onGuardar={onGuardar} onCerrar={onCerrar} textoCrear="Agregar firmante" deshabilitado={!form.nombre.trim()} />
    </ModalBase>
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
