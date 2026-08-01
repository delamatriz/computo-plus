"use client";

import { useState } from "react";
import { Document, Page } from "react-pdf";
import {
  Upload,
  FileText,
  FileImage,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  Camera,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fileToBase64, PDF_OPTIONS, MAX_ARCHIVO_MB, MAX_ARCHIVO_BYTES } from "./planoArchivo";

export interface PlanoResumen {
  id: string;
  nombre: string;
  tipoArchivo: "PDF" | "IMAGEN";
  nombreArchivoOriginal: string;
  paginaPDF: number | null;
  tamano: number | null;
  createdAt: string;
  cantidadFotos: number;
}

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-UY", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtTamano(bytes: number | null): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Modal de subida — con selector de página si el PDF tiene varias ──────

function ModalSubirPlano({
  onClose,
  onGuardado,
  proyectoId,
}: {
  onClose: () => void;
  onGuardado: (planos: PlanoResumen[]) => void;
  proyectoId: string;
}) {
  const [nombre, setNombre] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [numPaginas, setNumPaginas] = useState<number | null>(null);
  const [paginaElegida, setPaginaElegida] = useState(1);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const esPDF = file?.type === "application/pdf";
  const puedeGuardar = nombre.trim().length > 0 && !!file && (!esPDF || numPaginas != null);

  const elegirArchivo = (f: File) => {
    setError(null);
    if (f.size > MAX_ARCHIVO_BYTES) {
      setError(
        `El archivo pesa ${(f.size / 1024 / 1024).toFixed(1)}MB — el máximo es ${MAX_ARCHIVO_MB}MB. Un PDF escaneado a alta resolución puede pesar mucho; probá reducir la resolución del escaneo o comprimirlo antes de subirlo.`
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
    setGuardando(true);
    setError(null);
    try {
      const archivo = await fileToBase64(file);
      const res = await fetch(`/api/proyectos/${proyectoId}/planos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          tipoArchivo: esPDF ? "PDF" : "IMAGEN",
          archivo,
          nombreArchivoOriginal: file.name,
          paginaPDF: esPDF ? paginaElegida : null,
          tamano: file.size,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Error del servidor (${res.status})`);
      }
      const data = await res.json();
      onGuardado(data.planos ?? []);
      onClose();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "No se pudo subir el plano. Probá de nuevo.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col" style={{ maxHeight: "90vh" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
          <h2 className="text-base font-bold text-[#1A3A5C]">Subir plano nuevo</h2>
          <button onClick={onClose} className="p-1.5 rounded-[6px] text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && <p className="text-xs text-red-600">{error}</p>}

          <div>
            <label className="block text-sm font-semibold text-[#1A3A5C] mb-1.5">Nombre del plano</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder='Ej. "Planta Baja", "Corte A-A"'
              className="w-full px-3 py-2 rounded-[10px] border border-slate-300 bg-[#F8FAFC] text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#1A3A5C] mb-1.5">Archivo (PDF o imagen)</label>
            {!file ? (
              <>
                <label className="flex items-center justify-center gap-2 w-full px-4 py-6 rounded-[10px] border border-dashed border-slate-300 text-sm font-medium text-slate-500 hover:border-[#2563EB] hover:text-[#2563EB] transition-colors cursor-pointer">
                  <Upload className="w-4 h-4" />
                  Elegir archivo
                  <input
                    type="file"
                    accept="application/pdf,image/*"
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
                {esPDF ? <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <FileImage className="w-4 h-4 text-slate-400 flex-shrink-0" />}
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
                Página a usar como plano ({numPaginas} en total)
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
        </div>

        <div className="px-5 py-4 border-t border-slate-200 flex-shrink-0 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-[8px] text-sm font-medium text-slate-500 hover:bg-slate-50 transition-colors"
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
            Guardar plano
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sección principal — lista de planos + subida. El visor (VisorPlano)
// ahora lo renderiza la página padre como panel lateral redimensionable,
// no esta sección — ver /proyectos/[id]/metrajes/page.tsx. ─────────────

export default function SeccionPlanos({
  proyectoId,
  planos,
  cargando,
  error,
  eliminandoIds,
  onPlanosActualizados,
  onAbrirPlano,
  onEliminarPlano,
}: {
  proyectoId: string;
  planos: PlanoResumen[];
  cargando: boolean;
  error: string | null;
  eliminandoIds: Set<string>;
  onPlanosActualizados: (planos: PlanoResumen[]) => void;
  onAbrirPlano: (id: string) => void;
  onEliminarPlano: (id: string) => void;
}) {
  const [modalSubirAbierto, setModalSubirAbierto] = useState(false);

  return (
    <div className="bg-white rounded-[16px] border border-slate-300 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
        <span className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">Planos</span>
        <button
          onClick={() => setModalSubirAbierto(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold transition-colors"
        >
          <Upload className="w-3.5 h-3.5" /> Subir plano
        </button>
      </div>

      <div className="p-4">
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

        {cargando ? (
          <p className="text-sm text-slate-400">Cargando…</p>
        ) : planos.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">
            Todavía no subiste ningún plano para este proyecto. Un proyecto puede tener varios (planta baja, alta,
            cortes, etc.).
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {planos.map((p) => {
              const seEliminando = eliminandoIds.has(p.id);
              const Icono = p.tipoArchivo === "PDF" ? FileText : FileImage;
              return (
                <div
                  key={p.id}
                  className={cn(
                    "flex flex-col gap-2 rounded-[10px] border border-slate-200 p-3.5 hover:border-[#2563EB] hover:shadow-sm transition-all cursor-pointer",
                    seEliminando && "opacity-40 pointer-events-none"
                  )}
                  onClick={() => onAbrirPlano(p.id)}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-9 h-9 rounded-[8px] bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <Icono className="w-4 h-4 text-[#2563EB]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-700 truncate">{p.nombre}</p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {fmtFecha(p.createdAt)}
                        {p.tamano != null && ` · ${fmtTamano(p.tamano)}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="flex items-center gap-2 text-[11px] text-slate-400">
                      {p.tipoArchivo === "PDF" && p.paginaPDF && <span>Pág. {p.paginaPDF}</span>}
                      {p.cantidadFotos > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Camera className="w-3 h-3" /> {p.cantidadFotos}
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAbrirPlano(p.id);
                        }}
                        title="Ver plano"
                        className="w-6.5 h-6.5 flex items-center justify-center rounded-[6px] text-slate-400 hover:text-[#2563EB] hover:bg-blue-50 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`¿Eliminar el plano "${p.nombre}"? Se borran también sus fotos complementarias.`)) {
                            onEliminarPlano(p.id);
                          }
                        }}
                        title="Eliminar"
                        className="w-6.5 h-6.5 flex items-center justify-center rounded-[6px] text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modalSubirAbierto && (
        <ModalSubirPlano
          proyectoId={proyectoId}
          onClose={() => setModalSubirAbierto(false)}
          onGuardado={onPlanosActualizados}
        />
      )}
    </div>
  );
}
