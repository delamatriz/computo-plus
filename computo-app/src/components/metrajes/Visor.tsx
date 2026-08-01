"use client";

import { useEffect, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import {
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Expand,
  Shrink,
  Loader2,
  Sparkles,
  FileText,
  FileImage,
  File as FileGenerico,
  Download,
  GripHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { obtenerArchivoCacheado } from "@/lib/archivoCache";
import { PDF_OPTIONS, type DocumentoDetalle, type DocumentoResumen } from "./documentoMetraje";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

function iconoPorTipo(tipoArchivo: DocumentoResumen["tipoArchivo"]) {
  if (tipoArchivo === "PDF") return FileText;
  if (tipoArchivo === "IMAGEN") return FileImage;
  return FileGenerico;
}

function textoProgresoCarga(loaded: number, total: number): string {
  if (total > 0) {
    return `Cargando — ${Math.min(100, Math.round((loaded / total) * 100))}%`;
  }
  if (loaded > 0) {
    return `Cargando — ${(loaded / 1024 / 1024).toFixed(1)} MB`;
  }
  return "Cargando…";
}

// Descarga (con progreso + caché) del contenido de un documento — mismo
// hook para el visor principal y la ventana flotante.
function useArchivoBlob(doc: DocumentoDetalle | null) {
  const [cargando, setCargando] = useState(true);
  const [progreso, setProgreso] = useState({ loaded: 0, total: 0 });
  const [blob, setBlob] = useState<Blob | null>(null);
  const [imgObjectUrl, setImgObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!doc || doc.tipoArchivo === "DWG") {
      setCargando(false);
      return;
    }
    setCargando(true);
    setProgreso({ loaded: 0, total: 0 });
    setError(null);
    setBlob(null);
    setImgObjectUrl(null);

    const controller = new AbortController();
    let objectUrl: string | null = null;
    let cancelado = false;

    (async () => {
      try {
        const b = await obtenerArchivoCacheado(doc.archivo, {
          signal: controller.signal,
          onProgress: (loaded, total) => setProgreso({ loaded, total }),
        });
        if (cancelado) return;
        if (doc.tipoArchivo === "IMAGEN") {
          objectUrl = URL.createObjectURL(b);
          setImgObjectUrl(objectUrl);
        }
        setBlob(b);
        setCargando(false);
      } catch (err) {
        if (cancelado || (err instanceof DOMException && err.name === "AbortError")) return;
        setError(doc.tipoArchivo === "PDF" ? "No se pudo cargar el PDF." : "No se pudo cargar la imagen.");
        setCargando(false);
      }
    })();

    return () => {
      cancelado = true;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id, doc?.tipoArchivo, doc?.archivo]);

  return { cargando, progreso, blob, imgObjectUrl, error, setError };
}

// Documento sin vista previa (DWG) — solo metadata + descarga, sin parseo
// (ver UI_UX_REDESIGN.md sección 6 "Fuera de alcance — fase futura").
function SinVistaPrevia({ doc }: { doc: DocumentoDetalle }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
      <FileGenerico className="w-10 h-10 text-slate-300" />
      <p className="text-sm text-slate-500 max-w-xs">
        Sin vista previa disponible para archivos DWG todavía.
      </p>
      <a
        href={doc.archivo}
        download={doc.nombreArchivoOriginal}
        className="flex items-center gap-1.5 px-3 py-2 rounded-[8px] border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
      >
        <Download className="w-3.5 h-3.5" /> Descargar archivo
      </a>
    </div>
  );
}

// ── Visor principal — documento fijo y grande, con zoom/pan ────────────

function VisorPrincipal({ doc }: { doc: DocumentoDetalle }) {
  const { cargando, progreso, blob, imgObjectUrl, error, setError } = useArchivoBlob(doc);

  if (doc.tipoArchivo === "DWG") return <SinVistaPrevia doc={doc} />;

  return (
    <>
      {error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}
      {cargando && !error && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-slate-100/90">
          <Loader2 className="w-6 h-6 text-[#2563EB] animate-spin" />
          <p className="text-sm text-slate-500">{textoProgresoCarga(progreso.loaded, progreso.total)}</p>
          {progreso.total > 0 && (
            <div className="w-40 h-1.5 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full bg-[#2563EB] transition-[width] duration-150"
                style={{ width: `${Math.min(100, Math.round((progreso.loaded / progreso.total) * 100))}%` }}
              />
            </div>
          )}
        </div>
      )}
      <TransformWrapper initialScale={1} minScale={0.3} maxScale={6} centerOnInit panning={{ disabled: false, velocityDisabled: false }}>
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1 bg-white rounded-[10px] border border-slate-200 shadow-md p-1">
              <button onClick={() => zoomIn()} title="Acercar" className="w-8 h-8 flex items-center justify-center rounded-[6px] text-slate-500 hover:bg-slate-100 transition-colors">
                <ZoomIn className="w-4 h-4" />
              </button>
              <button onClick={() => zoomOut()} title="Alejar" className="w-8 h-8 flex items-center justify-center rounded-[6px] text-slate-500 hover:bg-slate-100 transition-colors">
                <ZoomOut className="w-4 h-4" />
              </button>
              <button onClick={() => resetTransform()} title="Restablecer vista" className="w-8 h-8 flex items-center justify-center rounded-[6px] text-slate-500 hover:bg-slate-100 transition-colors">
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
            {/* OJO: contentStyle NO debe forzar width/height/flex — la librería
                centra vía centerOnInit midiendo el tamaño NATURAL del
                contenido. Ver comentario histórico en el visor anterior. */}
            <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }} wrapperClass="cursor-grab active:cursor-grabbing select-none">
              {doc.tipoArchivo === "PDF" ? (
                blob && (
                  <Document file={blob} options={PDF_OPTIONS} onLoadError={() => setError("No se pudo cargar el PDF.")} loading={null}>
                    <Page pageNumber={doc.paginaPDF ?? 1} width={900} renderTextLayer={false} renderAnnotationLayer={false} />
                  </Document>
                )
              ) : (
                imgObjectUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imgObjectUrl} alt={doc.nombre} className="max-w-none select-none" onError={() => setError("No se pudo cargar la imagen.")} />
                )
              )}
            </TransformComponent>
          </>
        )}
      </TransformWrapper>
    </>
  );
}

// ── Ventana flotante — Foto/Detalle abierto desde la lista, overlay
// liviano encima del visor principal (que sigue fijo detrás). Movible
// (drag por el header) y cerrable, sin fondo oscuro de pantalla completa. ─

function VentanaFlotante({
  doc,
  onClose,
}: {
  doc: DocumentoDetalle;
  onClose: () => void;
}) {
  const { cargando, blob, imgObjectUrl, error } = useArchivoBlob(doc);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setOffset({ x: 0, y: 0 });
  }, [doc.id]);

  const iniciarArrastre = (e: React.MouseEvent) => {
    e.preventDefault();
    const inicio = { x: e.clientX, y: e.clientY };
    const offsetInicial = offset;
    const onMove = (ev: MouseEvent) => {
      setOffset({ x: offsetInicial.x + (ev.clientX - inicio.x), y: offsetInicial.y + (ev.clientY - inicio.y) });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div
      className="absolute top-4 right-4 z-20 w-[min(360px,80%)] max-h-[70%] bg-white rounded-[12px] border border-slate-300 shadow-xl flex flex-col overflow-hidden"
      style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
    >
      <div
        onMouseDown={iniciarArrastre}
        className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200 cursor-move flex-shrink-0"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <GripHorizontal className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span className="text-xs font-semibold text-[#1A3A5C] truncate">{doc.nombre}</span>
        </div>
        <button onClick={onClose} className="flex-shrink-0 p-1 rounded-[6px] text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-1 min-h-[160px] relative bg-slate-100 overflow-auto flex items-center justify-center p-2">
        {doc.tipoArchivo === "DWG" ? (
          <SinVistaPrevia doc={doc} />
        ) : (
          <>
            {error && <p className="text-sm text-red-500 p-4">{error}</p>}
            {cargando && !error && <Loader2 className="w-5 h-5 text-[#2563EB] animate-spin" />}
            {!cargando && !error && doc.tipoArchivo === "IMAGEN" && imgObjectUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imgObjectUrl} alt={doc.nombre} className="max-w-full max-h-full object-contain" />
            )}
            {!cargando && !error && doc.tipoArchivo === "PDF" && blob && (
              <Document file={blob} options={PDF_OPTIONS} loading={null}>
                <Page pageNumber={doc.paginaPDF ?? 1} width={320} renderTextLayer={false} renderAnnotationLayer={false} />
              </Document>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Lista de todos los documentos (las 3 categorías juntas) ────────────

function ListaDocumentos({
  documentos,
  documentoPrincipalId,
  onSeleccionar,
}: {
  documentos: DocumentoResumen[];
  documentoPrincipalId: string;
  onSeleccionar: (doc: DocumentoResumen) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-1">
      {documentos.map((doc) => {
        const Icono = iconoPorTipo(doc.tipoArchivo);
        const activo = doc.id === documentoPrincipalId;
        return (
          <button
            key={doc.id}
            onClick={() => onSeleccionar(doc)}
            className={cn(
              "w-full flex items-center gap-2 px-2.5 py-2 rounded-[8px] text-left transition-colors",
              activo ? "bg-blue-50 text-[#2563EB]" : "text-slate-600 hover:bg-slate-100"
            )}
          >
            <Icono className={cn("w-3.5 h-3.5 flex-shrink-0", activo ? "text-[#2563EB]" : "text-slate-400")} />
            <span className="flex-1 min-w-0 text-xs font-medium truncate">{doc.nombre}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Componente principal del Visor ──────────────────────────────────────

export default function Visor({
  documentoPrincipal,
  todosLosDocumentos,
  onSeleccionarDocumento,
  ventanaFlotante,
  onCerrarVentanaFlotante,
  onClose,
  expandido,
  onToggleExpandir,
  notas,
  onGuardarNotas,
  imagenesParaIA,
  onAnalizarConIA,
  style,
}: {
  documentoPrincipal: DocumentoDetalle;
  todosLosDocumentos: DocumentoResumen[];
  onSeleccionarDocumento: (doc: DocumentoResumen) => void;
  ventanaFlotante: DocumentoDetalle | null;
  onCerrarVentanaFlotante: () => void;
  onClose: () => void;
  expandido: boolean;
  onToggleExpandir: () => void;
  notas: string;
  onGuardarNotas: (notas: string) => Promise<void> | void;
  imagenesParaIA: string[];
  onAnalizarConIA: (imagenes: string[], contexto: string | null) => Promise<void> | void;
  style?: React.CSSProperties;
}) {
  const [notasLocal, setNotasLocal] = useState(notas);
  const [guardandoNotas, setGuardandoNotas] = useState(false);
  useEffect(() => setNotasLocal(notas), [notas]);

  const guardarNotasSiCambio = async () => {
    if (notasLocal === notas) return;
    setGuardandoNotas(true);
    try {
      await onGuardarNotas(notasLocal);
    } finally {
      setGuardandoNotas(false);
    }
  };

  const [analizando, setAnalizando] = useState(false);
  const [errorAnalisis, setErrorAnalisis] = useState<string | null>(null);
  const handleAnalizar = async () => {
    if (imagenesParaIA.length === 0 || analizando) return;
    setAnalizando(true);
    setErrorAnalisis(null);
    try {
      await onAnalizarConIA(imagenesParaIA, notasLocal || null);
    } catch {
      setErrorAnalisis("No se pudo analizar. Probá de nuevo.");
    } finally {
      setAnalizando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-white flex flex-col lg:static lg:inset-auto lg:z-auto lg:h-full lg:flex-shrink-0 lg:border-l lg:border-slate-200 overflow-hidden"
      style={style}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-white border-b border-slate-200 flex-shrink-0">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-[#1A3A5C] truncate">{documentoPrincipal.nombre}</h2>
          <p className="text-xs text-slate-400 truncate">
            {documentoPrincipal.nombreArchivoOriginal}
            {documentoPrincipal.tipoArchivo === "PDF" && documentoPrincipal.paginaPDF ? ` · página ${documentoPrincipal.paginaPDF}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onToggleExpandir}
            title={expandido ? "Volver a vista de 3 columnas" : "Expandir visor a pantalla completa"}
            className="p-1.5 rounded-[6px] text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            {expandido ? <Shrink className="w-4 h-4" /> : <Expand className="w-4 h-4" />}
          </button>
          <button onClick={onClose} className="p-1.5 rounded-[6px] text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Documento principal + lista */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <div className="flex-1 min-w-0 relative bg-slate-100">
          <VisorPrincipal doc={documentoPrincipal} />
          {ventanaFlotante && <VentanaFlotante doc={ventanaFlotante} onClose={onCerrarVentanaFlotante} />}
        </div>

        {!expandido && (
          <div className="w-full lg:w-[240px] flex-shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col bg-white max-h-[220px] lg:max-h-none">
            <div className="px-3 pt-3 pb-1.5 flex-shrink-0">
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Documentos</h3>
            </div>
            <ListaDocumentos
              documentos={todosLosDocumentos}
              documentoPrincipalId={documentoPrincipal.id}
              onSeleccionar={onSeleccionarDocumento}
            />
            <div className="p-2.5 border-t border-slate-200 flex-shrink-0">
              <button
                type="button"
                onClick={handleAnalizar}
                disabled={imagenesParaIA.length === 0 || analizando}
                title={
                  imagenesParaIA.length === 0
                    ? "Sin imágenes para analizar — el documento principal tiene que ser una imagen, o necesitás al menos una foto de relevamiento"
                    : "Leer cotas con IA y autocompletar la planilla de cómputo"
                }
                className={cn(
                  "flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-[8px] text-sm font-semibold transition-colors",
                  imagenesParaIA.length === 0 || analizando
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
                )}
              >
                {analizando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {analizando ? "Analizando…" : "Analizar con IA"}
              </button>
              {errorAnalisis && <p className="text-xs text-red-500 mt-1.5">{errorAnalisis}</p>}
            </div>
          </div>
        )}
      </div>

      {/* Notas — única por proyecto, debajo del visor */}
      <div className="border-t border-slate-200 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Notas</label>
          {guardandoNotas && <span className="text-[10px] text-slate-400">Guardando…</span>}
        </div>
        <textarea
          value={notasLocal}
          onChange={(e) => setNotasLocal(e.target.value)}
          onBlur={guardarNotasSiCambio}
          rows={2}
          placeholder="Observaciones del relevamiento, accesos, estado del lugar, etc."
          className="w-full px-2.5 py-2 rounded-[8px] border border-slate-200 bg-[#F8FAFC] text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all resize-none"
        />
      </div>
    </div>
  );
}
