"use client";

import { useState } from "react";
import { Document, Page } from "react-pdf";
import {
  Upload,
  FileText,
  FileImage,
  File as FileGenerico,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { postJSONConProgreso } from "@/lib/xhrJson";
import {
  fileToBase64,
  detectarTipoArchivo,
  PDF_OPTIONS,
  MAX_ARCHIVO_MB,
  MAX_ARCHIVO_BYTES,
  CATEGORIAS,
  type CategoriaDocumento,
  type DocumentoResumen,
} from "./documentoMetraje";

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-UY", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtTamano(bytes: number | null): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function iconoPorTipo(tipoArchivo: DocumentoResumen["tipoArchivo"]) {
  if (tipoArchivo === "PDF") return FileText;
  if (tipoArchivo === "IMAGEN") return FileImage;
  return FileGenerico; // DWG — sin ícono específico, solo metadata
}

// ── Modal de subida — genérico para las 3 categorías, con selector de
// página si el archivo es un PDF con varias hojas. ─────────────────────

function ModalSubirDocumento({
  categoria,
  onClose,
  onGuardado,
  proyectoId,
}: {
  categoria: CategoriaDocumento;
  onClose: () => void;
  onGuardado: (documentos: DocumentoResumen[]) => void;
  proyectoId: string;
}) {
  const config = CATEGORIAS.find((c) => c.value === categoria)!;
  const [nombre, setNombre] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [numPaginas, setNumPaginas] = useState<number | null>(null);
  const [paginaElegida, setPaginaElegida] = useState(1);
  const [guardando, setGuardando] = useState(false);
  const [progresoSubida, setProgresoSubida] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const esPDF = file?.type === "application/pdf";
  const puedeGuardar = nombre.trim().length > 0 && !!file && (!esPDF || numPaginas != null);

  const elegirArchivo = (f: File) => {
    setError(null);
    const tipo = detectarTipoArchivo(f);
    if (!tipo || !config.tiposPermitidos.includes(tipo)) {
      setError(`Tipo de archivo no permitido en "${config.label}" — aceptado: ${config.ayuda}`);
      return;
    }
    if (f.size > MAX_ARCHIVO_BYTES) {
      setError(
        `El archivo pesa ${(f.size / 1024 / 1024).toFixed(1)}MB — el máximo es ${MAX_ARCHIVO_MB}MB. Un escaneo a alta resolución puede pesar mucho; probá reducir la resolución o comprimirlo antes de subirlo.`
      );
      return;
    }
    setFile(f);
    setNumPaginas(null);
    setPaginaElegida(1);
    if (!nombre.trim()) {
      setNombre(f.name.replace(/\.[^.]+$/, ""));
    }
  };

  const guardar = async () => {
    if (!file) return;
    const tipoArchivo = detectarTipoArchivo(file);
    if (!tipoArchivo) return;
    setGuardando(true);
    setProgresoSubida(0);
    setError(null);
    try {
      const archivo = await fileToBase64(file);
      const res = await postJSONConProgreso<{ error?: string; documentos?: DocumentoResumen[] }>(
        `/api/proyectos/${proyectoId}/documentos-metraje`,
        {
          categoria,
          nombre: nombre.trim(),
          tipoArchivo,
          archivo,
          nombreArchivoOriginal: file.name,
          paginaPDF: esPDF ? paginaElegida : null,
          tamano: file.size,
        },
        setProgresoSubida
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Error del servidor (${res.status})`);
      }
      const data = await res.json();
      onGuardado(data.documentos ?? []);
      onClose();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "No se pudo subir el archivo. Probá de nuevo.");
    } finally {
      setGuardando(false);
      setProgresoSubida(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col" style={{ maxHeight: "90vh" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
          <h2 className="text-base font-bold text-[#1A3A5C]">Subir a &quot;{config.label}&quot;</h2>
          <button onClick={onClose} className="p-1.5 rounded-[6px] text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && <p className="text-xs text-red-600">{error}</p>}

          <div>
            <label className="block text-sm font-semibold text-[#1A3A5C] mb-1.5">Nombre</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder='Ej. "Planta Baja", "Detalle escalera"'
              className="w-full px-3 py-2 rounded-[10px] border border-slate-300 bg-[#F8FAFC] text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#1A3A5C] mb-1.5">Archivo ({config.ayuda})</label>
            {!file ? (
              <>
                <label className="flex items-center justify-center gap-2 w-full px-4 py-6 rounded-[10px] border border-dashed border-slate-300 text-sm font-medium text-slate-500 hover:border-[#2563EB] hover:text-[#2563EB] transition-colors cursor-pointer">
                  <Upload className="w-4 h-4" />
                  Elegir archivo
                  <input
                    type="file"
                    accept={config.accept}
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) elegirArchivo(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                <p className="text-[11px] text-slate-400 mt-1">Máximo {MAX_ARCHIVO_MB}MB por archivo.</p>
              </>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 rounded-[10px] border border-slate-200 bg-slate-50">
                {(() => {
                  const Icono = iconoPorTipo(detectarTipoArchivo(file) ?? "IMAGEN");
                  return <Icono className="w-4 h-4 text-slate-400 flex-shrink-0" />;
                })()}
                <span className="flex-1 min-w-0 text-sm text-slate-700 truncate">{file.name}</span>
                <button
                  onClick={() => {
                    setFile(null);
                    setNumPaginas(null);
                  }}
                  className="flex-shrink-0 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Detección de páginas — invisible, solo dispara onLoadSuccess */}
          {esPDF && file && numPaginas == null && (
            <div className="hidden">
              <Document file={file} options={PDF_OPTIONS} onLoadSuccess={({ numPages }) => setNumPaginas(numPages)} onLoadError={() => setError("No se pudo leer el PDF.")} />
            </div>
          )}

          {esPDF && numPaginas != null && numPaginas > 1 && (
            <div>
              <label className="block text-sm font-semibold text-[#1A3A5C] mb-1.5">
                Página a usar ({numPaginas} en total)
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPaginaElegida((p) => Math.max(1, p - 1))}
                  disabled={paginaElegida <= 1}
                  className="w-8 h-8 flex items-center justify-center rounded-[8px] border border-slate-300 text-slate-500 hover:bg-slate-50 disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-medium text-slate-700 w-16 text-center">
                  {paginaElegida} / {numPaginas}
                </span>
                <button
                  onClick={() => setPaginaElegida((p) => Math.min(numPaginas, p + 1))}
                  disabled={paginaElegida >= numPaginas}
                  className="w-8 h-8 flex items-center justify-center rounded-[8px] border border-slate-300 text-slate-500 hover:bg-slate-50 disabled:opacity-30 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-3 border border-slate-200 rounded-[10px] overflow-hidden flex justify-center bg-slate-50 p-2">
                <Document file={file} options={PDF_OPTIONS}>
                  <Page pageNumber={paginaElegida} width={320} renderTextLayer={false} renderAnnotationLayer={false} />
                </Document>
              </div>
            </div>
          )}

          {guardando && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-500">Subiendo archivo…</span>
                <span className="text-xs font-semibold text-[#2563EB]">{progresoSubida ?? 0}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-[#2563EB] transition-[width] duration-150"
                  style={{ width: `${progresoSubida ?? 0}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-200 flex-shrink-0 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={guardando}
            className="px-4 py-2 rounded-[8px] text-sm font-medium text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={!puedeGuardar || guardando}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-[8px] text-sm font-semibold text-white transition-colors",
              !puedeGuardar || guardando ? "bg-slate-300 cursor-not-allowed" : "bg-[#2563EB] hover:bg-[#1D4ED8]"
            )}
          >
            {guardando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {guardando ? `Subiendo… ${progresoSubida ?? 0}%` : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sub-sección — una de las 3 categorías dentro de "Documentación para
// metrar" (ver SeccionDocumentacionParaMetrar.tsx). Lista compacta en
// filas (mismo patrón que SeccionDocumentacionLlamado), no grilla de
// tarjetas — pensada para convivir 3 veces dentro de la misma card. ────

export default function SeccionDocumentoMetraje({
  proyectoId,
  categoria,
  documentos,
  cargando,
  error,
  eliminandoIds,
  onDocumentosActualizados,
  onAbrirDocumento,
  onEliminarDocumento,
}: {
  proyectoId: string;
  categoria: CategoriaDocumento;
  documentos: DocumentoResumen[];
  cargando: boolean;
  error: string | null;
  eliminandoIds: Set<string>;
  onDocumentosActualizados: (documentos: DocumentoResumen[]) => void;
  onAbrirDocumento: (id: string) => void;
  onEliminarDocumento: (id: string) => void;
}) {
  const [modalSubirAbierto, setModalSubirAbierto] = useState(false);
  const config = CATEGORIAS.find((c) => c.value === categoria)!;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">{config.label}</h3>
        <button
          onClick={() => setModalSubirAbierto(true)}
          className="flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
        >
          <Upload className="w-3 h-3" /> Subir
        </button>
      </div>

      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      {cargando ? (
        <p className="text-xs text-slate-400">Cargando…</p>
      ) : documentos.length === 0 ? (
        <p className="text-xs text-slate-400 py-2">Sin archivos todavía.</p>
      ) : (
        <ul className="space-y-1.5">
          {documentos.map((doc) => {
            const seEliminando = eliminandoIds.has(doc.id);
            const Icono = iconoPorTipo(doc.tipoArchivo);
            return (
              <li
                key={doc.id}
                className={cn(
                  "flex items-center gap-3 bg-white rounded-[10px] border border-slate-200 px-3.5 py-2.5",
                  seEliminando && "opacity-40 pointer-events-none"
                )}
              >
                <Icono className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="flex-1 min-w-0 text-sm text-slate-700 font-medium truncate">{doc.nombre}</span>
                <span className="flex-shrink-0 text-xs text-slate-400 whitespace-nowrap hidden sm:inline">
                  {fmtFecha(doc.createdAt)}
                  {doc.tamano != null && ` · ${fmtTamano(doc.tamano)}`}
                </span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => {
                      if (confirm(`¿Eliminar "${doc.nombre}"?`)) onEliminarDocumento(doc.id);
                    }}
                    title="Eliminar"
                    className="w-7 h-7 flex items-center justify-center rounded-[6px] text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onAbrirDocumento(doc.id)}
                    title="Abrir en el visor"
                    className="w-7 h-7 flex items-center justify-center rounded-[6px] text-slate-400 hover:text-[#2563EB] hover:bg-blue-50 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {modalSubirAbierto && (
        <ModalSubirDocumento
          proyectoId={proyectoId}
          categoria={categoria}
          onClose={() => setModalSubirAbierto(false)}
          onGuardado={onDocumentosActualizados}
        />
      )}
    </div>
  );
}
