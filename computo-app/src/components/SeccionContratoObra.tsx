"use client";

import { useState, useCallback } from "react";
import {
  FileSignature,
  ChevronDown,
  ChevronRight,
  Pencil,
  X,
  FileText,
  Image as ImageIcon,
  File as FileIcon,
  Trash2,
  Plus,
  ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/* ─── Tipos ───────────────────────────────────────────────── */
interface Documento {
  id: string;
  nombre: string;
  nombreArchivoOriginal: string;
  tipoArchivo: string;
  tamano: number | null;
  createdAt: string;
}

interface Contrato {
  id: string;
  domicilioComitente: string | null;
  fechaFirma: string | null;
  monto: number | null;
  moneda: string;
  documentos: Documento[];
}

interface Partes {
  cliente: {
    nombre: string | null;
    rut: string | null;
    razonSocial: string | null;
    telefono: string | null;
    email: string | null;
  };
  empresa: {
    nombre: string;
    rut: string;
    matricula: string | null;
    direccion: string | null;
    telefono: string | null;
    email: string | null;
  } | null;
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

function fmtMonto(monto: number, moneda: string): string {
  const formateado = monto.toLocaleString("es-UY", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return `${moneda === "USD" ? "US$" : "$"} ${formateado}`;
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

type FormState = {
  domicilioComitente: string;
  fechaFirma: string;
  monto: string;
  moneda: "UYU" | "USD";
};

function formVacio(): FormState {
  return { domicilioComitente: "", fechaFirma: "", monto: "", moneda: "UYU" };
}

function formDesdeContrato(c: Contrato): FormState {
  return {
    domicilioComitente: c.domicilioComitente ?? "",
    fechaFirma: c.fechaFirma ? c.fechaFirma.slice(0, 10) : "",
    monto: c.monto != null ? String(c.monto) : "",
    moneda: c.moneda === "USD" ? "USD" : "UYU",
  };
}

/* ─── Componente principal ────────────────────────────────── */
export default function SeccionContratoObra({ proyectoId }: Props) {
  const [expandido, setExpandido] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [contrato, setContrato] = useState<Contrato | null>(null);
  const [partes, setPartes] = useState<Partes | null>(null);
  const [precioFinalSugerido, setPrecioFinalSugerido] = useState<number | null>(null);
  const [monedaProyecto, setMonedaProyecto] = useState<string>("UYU");

  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const [form, setForm] = useState<FormState>(formVacio());
  const [guardando, setGuardando] = useState(false);

  const [nombreDocNuevo, setNombreDocNuevo] = useState("");
  const [subiendoDoc, setSubiendoDoc] = useState(false);
  const [agregandoDoc, setAgregandoDoc] = useState(false);

  const cargarDatos = useCallback(async () => {
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/contrato`);
      const data = await res.json();
      setContrato(data.contrato);
      setPartes(data.partes);
      setPrecioFinalSugerido(data.precioFinalSugerido);
      setMonedaProyecto(data.monedaProyecto ?? "UYU");
    } catch (err) {
      console.error("[contrato] error cargando datos", err);
    } finally {
      setCargado(true);
    }
  }, [proyectoId]);

  const abrirSeccion = () => {
    setExpandido((p) => !p);
    if (!cargado) cargarDatos();
  };

  const abrirCrear = () => {
    setForm({
      ...formVacio(),
      monto: precioFinalSugerido != null ? String(Math.round(precioFinalSugerido)) : "",
      moneda: monedaProyecto === "USD" ? "USD" : "UYU",
    });
    setFormularioAbierto(true);
  };

  const abrirEditar = () => {
    if (!contrato) return;
    setForm(formDesdeContrato(contrato));
    setFormularioAbierto(true);
  };

  const cerrarFormulario = () => setFormularioAbierto(false);

  const guardar = async () => {
    setGuardando(true);
    try {
      const esEdicion = !!contrato;
      const body = { ...form, monto: form.monto.trim() ? Number(form.monto) : null };
      const res = await fetch(`/api/proyectos/${proyectoId}/contrato`, {
        method: esEdicion ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("No se pudo guardar");
      const data: Contrato = await res.json();
      setContrato(data);
      setFormularioAbierto(false);
    } catch (err) {
      console.error("[contrato] error guardando", err);
    } finally {
      setGuardando(false);
    }
  };

  const subirDocumento = async (file: File) => {
    if (!nombreDocNuevo.trim() || !contrato) return;
    setSubiendoDoc(true);
    try {
      const archivo = await fileToBase64(file);
      const res = await fetch(`/api/proyectos/${proyectoId}/contrato/documentos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombreDocNuevo.trim(), archivo, nombreArchivoOriginal: file.name }),
      });
      if (!res.ok) throw new Error("No se pudo subir");
      const data: Documento = await res.json();
      setContrato((prev) => (prev ? { ...prev, documentos: [...prev.documentos, data] } : prev));
      setNombreDocNuevo("");
      setAgregandoDoc(false);
    } catch (err) {
      console.error("[contrato] error subiendo documento", err);
    } finally {
      setSubiendoDoc(false);
    }
  };

  const eliminarDocumento = async (docId: string) => {
    setContrato((prev) => (prev ? { ...prev, documentos: prev.documentos.filter((d) => d.id !== docId) } : prev));
    try {
      await fetch(`/api/proyectos/${proyectoId}/contrato/documentos/${docId}`, { method: "DELETE" });
    } catch (err) {
      console.error("[contrato] error eliminando documento", err);
    }
  };

  return (
    <div className="mt-6 bg-white rounded-[16px] border border-slate-300 shadow-sm overflow-hidden">
      <button
        onClick={abrirSeccion}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors text-left group"
      >
        <div className="flex items-center gap-2.5">
          <FileSignature className="w-4 h-4 text-[#2563EB]" />
          <h2 className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">Contrato de Obra</h2>
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
                Subí acá el contrato ya firmado y cualquier anexo (como el presupuesto final) — CÓMPUTO+ no
                genera el contrato, solo lo organiza.
              </p>

              {partes && <SeccionPartes partes={partes} proyectoId={proyectoId} />}

              {!contrato ? (
                <button
                  onClick={abrirCrear}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-colors"
                >
                  <Plus className="w-4 h-4" /> Crear contrato
                </button>
              ) : (
                <>
                  <div className="rounded-[10px] border border-slate-200 bg-white px-3.5 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        Datos del contrato
                      </p>
                      <button
                        onClick={abrirEditar}
                        className="flex items-center gap-1 text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
                      >
                        <Pencil className="w-3 h-3" /> Editar
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <CampoValor label="Domicilio del comitente" valor={contrato.domicilioComitente} />
                      <CampoValor label="Fecha de firma" valor={contrato.fechaFirma ? fmtFecha(contrato.fechaFirma) : null} />
                      <CampoValor
                        label="Monto del contrato"
                        valor={contrato.monto != null ? fmtMonto(contrato.monto, contrato.moneda) : null}
                      />
                    </div>
                  </div>

                  <div className="rounded-[10px] border border-slate-200 bg-white px-3.5 py-3">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Documentos y anexos
                    </p>

                    {contrato.documentos.length === 0 ? (
                      <p className="text-xs text-slate-400 italic mb-2">Todavía no se subió ningún documento.</p>
                    ) : (
                      <div className="space-y-1.5 mb-2">
                        {contrato.documentos.map((doc) => (
                          <FilaDocumento
                            key={doc.id}
                            doc={doc}
                            proyectoId={proyectoId}
                            onEliminar={() => eliminarDocumento(doc.id)}
                          />
                        ))}
                      </div>
                    )}

                    {agregandoDoc ? (
                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        <input
                          type="text"
                          value={nombreDocNuevo}
                          onChange={(e) => setNombreDocNuevo(e.target.value)}
                          placeholder='ej: "Contrato firmado", "Presupuesto — Anexo económico"'
                          className="w-full text-sm text-slate-700 bg-white border border-slate-200 rounded-[8px] px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30"
                        />
                        <div className="flex items-center gap-2">
                          <label
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-[8px] text-sm font-semibold transition-colors cursor-pointer ${
                              nombreDocNuevo.trim() && !subiendoDoc
                                ? "bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
                                : "bg-slate-100 text-slate-400 cursor-not-allowed"
                            }`}
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

      <AnimatePresence>
        {formularioAbierto && (
          <FormularioContrato
            form={form}
            setForm={setForm}
            esEdicion={!!contrato}
            guardando={guardando}
            onGuardar={guardar}
            onCerrar={cerrarFormulario}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Sección "Partes" (solo lectura) ─────────────────────── */
function SeccionPartes({ partes, proyectoId }: { partes: Partes; proyectoId: string }) {
  const faltaCliente = !partes.cliente.nombre && !partes.cliente.rut;
  return (
    <div className="rounded-[10px] border border-slate-200 bg-white px-3.5 py-3">
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Partes</p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] font-semibold text-slate-400 mb-1">Comitente (cliente)</p>
          {faltaCliente ? (
            <p className="text-xs text-slate-400 italic">
              Sin datos cargados —{" "}
              <a href={`/proyectos/${proyectoId}/editar`} className="text-[#2563EB] hover:underline">
                completar en Editar proyecto
              </a>
            </p>
          ) : (
            <div className="space-y-0.5 text-xs text-slate-600">
              {partes.cliente.nombre && <p className="font-semibold text-slate-700">{partes.cliente.nombre}</p>}
              {partes.cliente.razonSocial && <p>{partes.cliente.razonSocial}</p>}
              {partes.cliente.rut && <p>RUT {partes.cliente.rut}</p>}
              {partes.cliente.telefono && <p>{partes.cliente.telefono}</p>}
              {partes.cliente.email && <p>{partes.cliente.email}</p>}
            </div>
          )}
        </div>
        <div>
          <p className="text-[10px] font-semibold text-slate-400 mb-1">Empresa constructora</p>
          {!partes.empresa ? (
            <p className="text-xs text-slate-400 italic">Sin datos de empresa cargados.</p>
          ) : (
            <div className="space-y-0.5 text-xs text-slate-600">
              <p className="font-semibold text-slate-700">{partes.empresa.nombre}</p>
              {partes.empresa.rut && <p>RUT {partes.empresa.rut}</p>}
              {partes.empresa.matricula && <p>Matrícula {partes.empresa.matricula}</p>}
              {partes.empresa.direccion && <p>{partes.empresa.direccion}</p>}
              {partes.empresa.telefono && <p>{partes.empresa.telefono}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CampoValor({ label, valor }: { label: string; valor: string | null }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-slate-400 mb-0.5">{label}</p>
      <p className={valor ? "text-slate-700 font-medium" : "text-slate-400 italic"}>{valor ?? "Sin definir"}</p>
    </div>
  );
}

function FilaDocumento({
  doc,
  proyectoId,
  onEliminar,
}: {
  doc: Documento;
  proyectoId: string;
  onEliminar: () => void;
}) {
  const Icono = iconoParaTipo(doc.tipoArchivo);
  const url = `/api/proyectos/${proyectoId}/contrato/documentos/${doc.id}/archivo`;
  return (
    <div className="flex items-center justify-between gap-2 rounded-[8px] border border-slate-100 px-2.5 py-2">
      <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 min-w-0 flex-1 group">
        <Icono className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-700 truncate group-hover:text-[#2563EB] transition-colors">
            {doc.nombre}
          </p>
          <p className="text-[10px] text-slate-400 truncate">
            {doc.nombreArchivoOriginal}
            {doc.tamano != null && ` · ${fmtTamano(doc.tamano)}`}
          </p>
        </div>
        <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-[#2563EB] transition-colors flex-shrink-0" />
      </a>
      <button
        onClick={onEliminar}
        className="text-slate-300 hover:text-red-500 transition-colors p-1 flex-shrink-0"
        title="Eliminar documento"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/* ─── Modal de formulario (crear / editar contrato) ───────── */
function FormularioContrato({
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
            {esEdicion ? "Editar contrato" : "Crear contrato"}
          </h3>
          <button onClick={onCerrar} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className={labelCls}>Domicilio del comitente</label>
            <input
              type="text"
              value={form.domicilioComitente}
              onChange={(e) => set("domicilioComitente", e.target.value)}
              placeholder="ej: Av. 18 de Julio 1234, Montevideo"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Fecha de firma</label>
            <input type="date" value={form.fechaFirma} onChange={(e) => set("fechaFirma", e.target.value)} className={inputCls} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>Monto del contrato</label>
              <input
                type="number"
                value={form.monto}
                onChange={(e) => set("monto", e.target.value)}
                placeholder="0"
                className={inputCls}
              />
              {!esEdicion && (
                <p className="text-[10px] text-slate-400 mt-1">
                  Prellenado con el Precio Final del presupuesto actual — editable.
                </p>
              )}
            </div>
            <div>
              <label className={labelCls}>Moneda</label>
              <select value={form.moneda} onChange={(e) => set("moneda", e.target.value as "UYU" | "USD")} className={inputCls}>
                <option value="UYU">UYU</option>
                <option value="USD">USD</option>
              </select>
            </div>
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
            disabled={guardando}
            className="flex-1 py-2.5 rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {guardando ? "Guardando…" : esEdicion ? "Guardar cambios" : "Crear contrato"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
