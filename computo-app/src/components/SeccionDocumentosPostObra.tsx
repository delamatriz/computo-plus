"use client";

import { useState, useCallback } from "react";
import { BookMarked, ChevronDown, ChevronRight, Plus, Trash2, FileText, Image as ImageIcon, File as FileIcon, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { PALETA } from "@/lib/paletaPresupuesto";
import { mensajeDeErrorSubida, motivoRechazoSubida } from "@/lib/motivoRechazoSubida";

/* ─── Tipos ───────────────────────────────────────────────── */
const CATEGORIAS = ["Manual de uso", "Plano As-Built", "Certificado de garantía", "Otro"] as const;
type Categoria = (typeof CATEGORIAS)[number];

interface Documento {
  id: string;
  nombre: string;
  categoria: Categoria;
  nombreArchivoOriginal: string;
  tipoArchivo: string;
  tamano: number | null;
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

function fmtTamano(bytes: number | null): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function iconoParaTipo(tipoArchivo: string) {
  const cls = "w-4 h-4 text-slate-400 flex-shrink-0";
  if (tipoArchivo === "application/pdf") return <FileText className={cls} />;
  if (tipoArchivo.startsWith("image/")) return <ImageIcon className={cls} />;
  return <FileIcon className={cls} />;
}

type FormState = { nombre: string; categoria: Categoria };
function formVacio(): FormState {
  return { nombre: "", categoria: "Manual de uso" };
}

/* ─── Componente principal ────────────────────────────────── */
export default function SeccionDocumentosPostObra({ proyectoId }: Props) {
  const [expandido, setExpandido] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [documentos, setDocumentos] = useState<Documento[]>([]);

  const [agregando, setAgregando] = useState(false);
  const [form, setForm] = useState<FormState>(formVacio());
  const [subiendo, setSubiendo] = useState(false);
  const [subiendoEn, setSubiendoEn] = useState<Categoria | null>(null);
  const [errorSubida, setErrorSubida] = useState<string | null>(null);

  const cargarLista = useCallback(async () => {
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/documentos-post-obra`);
      const data = await res.json();
      setDocumentos(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("[documentos-post-obra] error cargando lista", err);
    } finally {
      setCargado(true);
    }
  }, [proyectoId]);

  const abrirSeccion = () => {
    setExpandido((p) => !p);
    if (!cargado) cargarLista();
  };

  const subirDocumento = async (file: File) => {
    if (!form.nombre.trim()) return;
    setSubiendo(true);
    setErrorSubida(null);
    try {
      const archivo = await fileToBase64(file);
      const res = await fetch(`/api/proyectos/${proyectoId}/documentos-post-obra`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: form.nombre.trim(), categoria: form.categoria, archivo, nombreArchivoOriginal: file.name }),
      });
      // 400 con motivo (tipo no permitido, supera el tamaño): se muestra tal cual.
      if (!res.ok) throw new Error(await motivoRechazoSubida(res));
      const data: Documento = await res.json();
      setDocumentos((prev) => [...prev, data]);
      setForm(formVacio());
      setAgregando(false);
    } catch (err) {
      console.error("[documentos-post-obra] error subiendo documento", err);
      setErrorSubida(mensajeDeErrorSubida(err));
    } finally {
      setSubiendo(false);
    }
  };

  // "+" de cada categoría: sube directo a esa categoría, con el nombre del
  // archivo (sin extensión) como nombre del documento.
  const subirEnCategoria = async (cat: Categoria, file: File) => {
    setSubiendoEn(cat);
    setErrorSubida(null);
    try {
      const archivo = await fileToBase64(file);
      const res = await fetch(`/api/proyectos/${proyectoId}/documentos-post-obra`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: file.name.replace(/\.[^.]+$/, ""),
          categoria: cat,
          archivo,
          nombreArchivoOriginal: file.name,
        }),
      });
      // 400 con motivo (tipo no permitido, supera el tamaño): se muestra tal cual.
      if (!res.ok) throw new Error(await motivoRechazoSubida(res));
      const data: Documento = await res.json();
      setDocumentos((prev) => [...prev, data]);
    } catch (err) {
      console.error("[documentos-post-obra] error subiendo documento", err);
      setErrorSubida(mensajeDeErrorSubida(err));
    } finally {
      setSubiendoEn(null);
    }
  };

  const eliminarDocumento = async (docId: string) => {
    setDocumentos((prev) => prev.filter((d) => d.id !== docId));
    try {
      await fetch(`/api/proyectos/${proyectoId}/documentos-post-obra/${docId}`, { method: "DELETE" });
    } catch (err) {
      console.error("[documentos-post-obra] error eliminando documento", err);
    }
  };

  return (
    <div className="mt-6 bg-white rounded-[16px] border border-slate-300 shadow-sm overflow-hidden">
      <button
        onClick={abrirSeccion}
        className={`w-full flex items-center justify-between px-5 py-3.5 transition-colors text-left group ${PALETA.capituloFila}`}
      >
        <div className="flex items-center gap-2.5">
          <BookMarked className="w-4 h-4 text-[#1D4435]" />
          <h2 className="text-sm font-bold text-[#1D4435] uppercase tracking-wide">Manuales y Planos As-Built</h2>
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
                Archivo de manuales de uso, planos As-Built y certificados de garantía de la obra terminada.
              </p>
              {errorSubida && <p className="text-xs text-red-600">{errorSubida}</p>}

              {CATEGORIAS.map((cat) => {
                const docsDeCategoria = documentos.filter((d) => d.categoria === cat);
                return (
                  <div key={cat} className="rounded-[10px] border border-slate-200 bg-white px-3.5 py-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        {cat === "Manual de uso" ? "Manuales de uso" : cat === "Plano As-Built" ? "Planos As-Built" : cat === "Certificado de garantía" ? "Certificados de garantía" : "Otros"}
                        {" "}
                        <span className="font-normal normal-case text-slate-400">({docsDeCategoria.length})</span>
                      </p>
                      <label
                        className={cn(
                          "inline-flex items-center gap-1 text-[11px] font-semibold flex-shrink-0",
                          subiendoEn === cat ? "text-slate-400 cursor-wait" : "text-[#2563EB] hover:underline cursor-pointer"
                        )}
                        title={`Agregar a ${cat}`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {subiendoEn === cat ? "Subiendo…" : "Agregar"}
                        <input
                          type="file"
                          disabled={subiendoEn != null}
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files?.[0]) subirEnCategoria(cat, e.target.files[0]);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                    {docsDeCategoria.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">Sin documentos en esta categoría.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {docsDeCategoria.map((doc) => (
                          <FilaDocumento key={doc.id} doc={doc} proyectoId={proyectoId} onEliminar={() => eliminarDocumento(doc.id)} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {agregando ? (
                <div className="rounded-[10px] border border-slate-200 bg-white px-3.5 py-3 space-y-2">
                  <input
                    type="text"
                    value={form.nombre}
                    onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
                    placeholder="ej: Manual de uso caldera"
                    className="w-full text-sm text-slate-700 bg-white border border-slate-200 rounded-[8px] px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30"
                  />
                  <select
                    value={form.categoria}
                    onChange={(e) => setForm((p) => ({ ...p, categoria: e.target.value as Categoria }))}
                    className="w-full text-sm text-slate-700 bg-white border border-slate-200 rounded-[8px] px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30"
                  >
                    {CATEGORIAS.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2">
                    <label
                      className={cn(
                        "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-[8px] text-sm font-semibold transition-colors cursor-pointer",
                        form.nombre.trim() && !subiendo ? "bg-[#2563EB] hover:bg-[#1D4ED8] text-white" : "bg-slate-100 text-slate-400 cursor-not-allowed"
                      )}
                    >
                      {subiendo ? "Subiendo…" : "Elegir archivo"}
                      <input
                        type="file"
                        disabled={!form.nombre.trim() || subiendo}
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) subirDocumento(e.target.files[0]);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <button
                      onClick={() => { setAgregando(false); setForm(formVacio()); }}
                      className="px-3 py-2 rounded-[8px] border border-slate-200 text-slate-500 text-sm hover:bg-slate-50 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAgregando(true)}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-colors"
                >
                  <Plus className="w-4 h-4" /> Agregar documento
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Fila de documento ─────────────────────────────────────── */
function FilaDocumento({ doc, proyectoId, onEliminar }: { doc: Documento; proyectoId: string; onEliminar: () => void }) {
  const url = `/api/proyectos/${proyectoId}/documentos-post-obra/${doc.id}/archivo`;
  return (
    <div className="flex items-center justify-between gap-2 rounded-[8px] border border-slate-100 px-2.5 py-2">
      <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 min-w-0 flex-1 group">
        {iconoParaTipo(doc.tipoArchivo)}
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
