"use client";

import { useEffect, useState } from "react";
import { FolderOpen, Upload, FileText, FileImage, Download, Trash2, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface Props {
  proyectoId: string;
}

interface DocumentoLlamado {
  id: string;
  nombreArchivo: string;
  url: string;
  etiqueta: string;
  tamano: number | null;
  createdAt: string;
}

const ETIQUETAS = [
  { value: "PLIEGO", label: "Pliego" },
  { value: "MEMORIA", label: "Memoria" },
  { value: "FOTOS", label: "Fotos" },
  { value: "PLANOS", label: "Planos" },
  { value: "OTRO", label: "Otro" },
] as const;

const ESTILO_ETIQUETA: Record<string, string> = {
  PLIEGO: "bg-blue-50 text-blue-600 border-blue-200",
  MEMORIA: "bg-purple-50 text-purple-600 border-purple-200",
  FOTOS: "bg-emerald-50 text-emerald-600 border-emerald-200",
  PLANOS: "bg-amber-50 text-amber-600 border-amber-200",
  OTRO: "bg-slate-100 text-slate-500 border-slate-200",
};

function labelEtiqueta(etiqueta: string): string {
  return ETIQUETAS.find((e) => e.value === etiqueta)?.label ?? etiqueta;
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
  return d.toLocaleDateString("es-UY", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtTamano(bytes: number | null): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SeccionDocumentacionLlamado({ proyectoId }: Props) {
  const [documentos, setDocumentos] = useState<DocumentoLlamado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [etiquetaElegida, setEtiquetaElegida] = useState<string>("PLIEGO");
  const [error, setError] = useState<string | null>(null);
  const [expandido, setExpandido] = useState(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const res = await fetch(`/api/proyectos/${proyectoId}/documentos`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!cancelado) setDocumentos(data.documentos ?? []);
      } catch {
        if (!cancelado) setError("No se pudo cargar la documentación del llamado.");
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [proyectoId]);

  async function subirArchivo(file: File) {
    setSubiendo(true);
    setError(null);
    try {
      const url = await fileToBase64(file);
      const res = await fetch(`/api/proyectos/${proyectoId}/documentos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombreArchivo: file.name,
          url,
          etiqueta: etiquetaElegida,
          tamano: file.size,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setDocumentos(data.documentos ?? []);
    } catch {
      setError("No se pudo subir el archivo. Probá de nuevo.");
    } finally {
      setSubiendo(false);
    }
  }

  async function eliminarDocumento(docId: string) {
    const anterior = documentos;
    setDocumentos((prev) => prev.filter((d) => d.id !== docId));
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/documentos/${docId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      setDocumentos(anterior);
      setError("No se pudo eliminar el archivo.");
    }
  }

  return (
    <div
      className="rounded-[16px] border border-blue-200 shadow-sm overflow-hidden mb-6"
      style={{ background: "#F0F7FF" }}
    >
      <button
        onClick={() => setExpandido((p) => !p)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-blue-100/30 transition-colors text-left group"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 mb-1">
            <FolderOpen className="w-4 h-4 text-[#2563EB] flex-shrink-0" />
            <h2 className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">Documentación del llamado</h2>
            {documentos.length > 0 && (
              <span className="flex-shrink-0 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#2563EB] text-white text-[10px] font-bold">
                {documentos.length}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Pliego de Condiciones, Memoria del pliego, fotos y planos de referencia — para consultar y archivar.
          </p>
        </div>
        <span className="text-slate-400 group-hover:text-slate-600 transition-colors flex-shrink-0">
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
            className="overflow-hidden border-t border-blue-100"
          >
            <div className="px-5 py-4">
              {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

              {/* Subida */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <select
                  value={etiquetaElegida}
                  onChange={(e) => setEtiquetaElegida(e.target.value)}
                  className="rounded-[8px] border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                >
                  {ETIQUETAS.map((et) => (
                    <option key={et.value} value={et.value}>
                      {et.label}
                    </option>
                  ))}
                </select>

                <label
                  className={cn(
                    "flex items-center gap-1.5 px-3.5 py-2 rounded-[8px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-medium transition-colors cursor-pointer",
                    subiendo && "opacity-60 pointer-events-none"
                  )}
                >
                  {subiendo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {subiendo ? "Subiendo..." : "Subir archivo"}
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    disabled={subiendo}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) subirArchivo(file);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>

              {/* Lista */}
              {cargando ? (
                <p className="text-sm text-slate-400">Cargando…</p>
              ) : documentos.length === 0 ? (
                <p className="text-sm text-slate-400">Sin documentación cargada todavía.</p>
              ) : (
                <ul className="space-y-1.5">
                  {documentos.map((doc) => {
                    const esImagen = doc.url.startsWith("data:image/");
                    const Icono = esImagen ? FileImage : FileText;
                    return (
                      <li
                        key={doc.id}
                        className="flex items-center gap-3 bg-white rounded-[10px] border border-slate-200 px-3.5 py-2.5"
                      >
                        <Icono className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span className="flex-1 min-w-0 text-sm text-slate-700 font-medium truncate">
                          {doc.nombreArchivo}
                        </span>
                        <span
                          className={cn(
                            "flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-[4px] border uppercase tracking-wide whitespace-nowrap",
                            ESTILO_ETIQUETA[doc.etiqueta] ?? ESTILO_ETIQUETA.OTRO
                          )}
                        >
                          {labelEtiqueta(doc.etiqueta)}
                        </span>
                        <span className="flex-shrink-0 text-xs text-slate-400 whitespace-nowrap hidden sm:inline">
                          {fmtFecha(doc.createdAt)}
                          {doc.tamano != null && ` · ${fmtTamano(doc.tamano)}`}
                        </span>
                        <a
                          href={doc.url}
                          download={doc.nombreArchivo}
                          title="Descargar"
                          className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-[6px] text-slate-400 hover:text-[#2563EB] hover:bg-blue-50 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                        <button
                          onClick={() => eliminarDocumento(doc.id)}
                          title="Eliminar"
                          className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-[6px] text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
