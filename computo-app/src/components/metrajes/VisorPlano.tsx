"use client";

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { X, ZoomIn, ZoomOut, Maximize2, Loader2, Camera, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

// Sin esto, page.render() se queda colgado para siempre en PDFs con fuentes
// estándar (no embebidas) — pdf.js espera indefinidamente los datos de la
// fuente. Servidos como estáticos desde public/ (copiados de
// node_modules/pdfjs-dist), mismo criterio que el worker: self-hosted, sin
// depender de un CDN externo.
export const PDF_OPTIONS = { standardFontDataUrl: "/standard_fonts/", cMapUrl: "/cmaps/", cMapPacked: true };

// Límite de tamaño — el storage de planos/fotos es base64-en-Postgres
// (mismo patrón que DocumentoLlamado/FotoCertificacionItem). La base es
// remota (Render); confirmado con pruebas aisladas que un INSERT de un
// solo TEXT grande tarda demasiado sobre esa conexión y el driver termina
// cortándola ("Connection terminated unexpectedly") antes de completar —
// 20MB tardó 18s y pasó raspando, 25MB falló a los 12s, 30MB a los 28s. No
// es un límite de Next.js ni de validación: es la conexión a la DB. Hasta
// que esto migre a un storage tipo blob/S3, se limita la subida a un rango
// que probamos que anda rápido y confiable.
export const MAX_ARCHIVO_MB = 15;
export const MAX_ARCHIVO_BYTES = MAX_ARCHIVO_MB * 1024 * 1024;

export interface FotoComplementaria {
  id: string;
  archivo: string;
  nombreArchivoOriginal: string;
  descripcion: string | null;
  createdAt: string;
}

export interface PlanoDetalle {
  id: string;
  nombre: string;
  tipoArchivo: "PDF" | "IMAGEN";
  archivo: string;
  nombreArchivoOriginal: string;
  paginaPDF: number | null;
  notas: string | null;
  fotos: FotoComplementaria[];
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function VisorPlano({
  plano,
  onClose,
  onSubirFoto,
  subiendoFoto,
  onGuardarNotas,
  onAnalizarConIA,
  style,
}: {
  plano: PlanoDetalle;
  onClose: () => void;
  onSubirFoto: (file: File) => Promise<void> | void;
  subiendoFoto: boolean;
  onGuardarNotas: (notas: string) => Promise<void> | void;
  onAnalizarConIA: (imagenes: string[], contexto: string | null) => Promise<void> | void;
  /** Ancho en desktop (panel lateral redimensionable) — sin esto, usa el
   * ancho fijo de lg:w-[40%]. En mobile siempre ocupa toda la pantalla. */
  style?: React.CSSProperties;
}) {
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);

  const [notasLocal, setNotasLocal] = useState(plano.notas ?? "");
  const [guardandoNotas, setGuardandoNotas] = useState(false);
  const guardarNotasSiCambio = async () => {
    if (notasLocal === (plano.notas ?? "")) return;
    setGuardandoNotas(true);
    try {
      await onGuardarNotas(notasLocal);
    } finally {
      setGuardandoNotas(false);
    }
  };

  // Análisis por IA — lee cotas de la imagen del plano (si es tipo IMAGEN) +
  // sus fotos complementarias, y autocompleta la planilla. Absorbido de la
  // vieja card "Documentación", ahora atado a un plano persistido en vez de
  // un File efímero en memoria.
  const imagenesDisponibles = [
    ...(plano.tipoArchivo === "IMAGEN" ? [plano.archivo] : []),
    ...plano.fotos.map((f) => f.archivo),
  ];
  const [analizando, setAnalizando] = useState(false);
  const [errorAnalisis, setErrorAnalisis] = useState<string | null>(null);
  const handleAnalizar = async () => {
    if (imagenesDisponibles.length === 0 || analizando) return;
    setAnalizando(true);
    setErrorAnalisis(null);
    try {
      await onAnalizarConIA(imagenesDisponibles, notasLocal || null);
    } catch {
      setErrorAnalisis("No se pudo analizar. Probá de nuevo.");
    } finally {
      setAnalizando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-white flex flex-col lg:static lg:inset-auto lg:z-auto lg:h-full lg:flex-shrink-0 lg:border-l lg:border-slate-200 lg:flex-row overflow-hidden"
      style={style}
    >
      {/* Visor principal */}
      <div className="flex-1 min-w-0 flex flex-col bg-slate-100 relative">
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-white border-b border-slate-200 flex-shrink-0">
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-[#1A3A5C] truncate">{plano.nombre}</h2>
              <p className="text-xs text-slate-400 truncate">
                {plano.nombreArchivoOriginal}
                {plano.tipoArchivo === "PDF" && plano.paginaPDF ? ` · página ${plano.paginaPDF}` : ""}
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 p-1.5 rounded-[6px] text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 min-h-0 relative overflow-hidden">
            {errorCarga && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-sm text-red-500">{errorCarga}</p>
              </div>
            )}
            <TransformWrapper
              initialScale={1}
              minScale={0.3}
              maxScale={6}
              centerOnInit
              panning={{ disabled: false, velocityDisabled: false }}
            >
              {({ zoomIn, zoomOut, resetTransform }) => (
                <>
                  <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1 bg-white rounded-[10px] border border-slate-200 shadow-md p-1">
                    <button
                      onClick={() => zoomIn()}
                      title="Acercar"
                      className="w-8 h-8 flex items-center justify-center rounded-[6px] text-slate-500 hover:bg-slate-100 transition-colors"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => zoomOut()}
                      title="Alejar"
                      className="w-8 h-8 flex items-center justify-center rounded-[6px] text-slate-500 hover:bg-slate-100 transition-colors"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => resetTransform()}
                      title="Restablecer vista"
                      className="w-8 h-8 flex items-center justify-center rounded-[6px] text-slate-500 hover:bg-slate-100 transition-colors"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  </div>
                  {/* OJO: contentStyle NO debe forzar width/height/flex — la
                      librería centra vía centerOnInit midiendo el tamaño
                      NATURAL del contenido. Si el div de contenido se fuerza
                      a 100%x100% (igual al wrapper), esa medición se rompe
                      y el resultado visual del zoom queda impredecible. */}
                  <TransformComponent
                    wrapperStyle={{ width: "100%", height: "100%" }}
                    wrapperClass="cursor-grab active:cursor-grabbing select-none"
                  >
                    {plano.tipoArchivo === "PDF" ? (
                      <Document
                        file={plano.archivo}
                        options={PDF_OPTIONS}
                        onLoadError={() => setErrorCarga("No se pudo cargar el PDF.")}
                        loading={<div className="p-10 text-sm text-slate-400">Cargando plano…</div>}
                      >
                        <Page
                          pageNumber={plano.paginaPDF ?? 1}
                          width={900}
                          renderTextLayer={false}
                          renderAnnotationLayer={false}
                        />
                      </Document>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={plano.archivo}
                        alt={plano.nombre}
                        className="max-w-none select-none"
                        onError={() => setErrorCarga("No se pudo cargar la imagen.")}
                      />
                    )}
                  </TransformComponent>
                </>
              )}
            </TransformWrapper>
          </div>
        </div>

        {/* Panel lateral — notas, fotos complementarias, análisis IA */}
        <div className="w-full lg:w-[300px] flex-shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col bg-white">
          <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
            {/* Notas */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Notas</label>
                {guardandoNotas && <span className="text-[10px] text-slate-400">Guardando…</span>}
              </div>
              <textarea
                value={notasLocal}
                onChange={(e) => setNotasLocal(e.target.value)}
                onBlur={guardarNotasSiCambio}
                rows={3}
                placeholder="Observaciones del relevamiento, accesos, estado del lugar, etc."
                className="w-full px-2.5 py-2 rounded-[8px] border border-slate-200 bg-[#F8FAFC] text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all resize-none"
              />
            </div>

            {/* Fotos complementarias */}
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Fotos complementarias</h3>
              {plano.fotos.length === 0 ? (
                <p className="text-xs text-slate-400">Sin fotos complementarias todavía.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {plano.fotos.map((foto) => (
                    <div key={foto.id} className="rounded-[8px] overflow-hidden border border-slate-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={foto.archivo} alt={foto.descripcion ?? foto.nombreArchivoOriginal} className="w-full aspect-square object-cover" />
                      {foto.descripcion && (
                        <p className="text-[10px] text-slate-500 px-1.5 py-1 truncate" title={foto.descripcion}>
                          {foto.descripcion}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="p-3 border-t border-slate-200 flex-shrink-0 space-y-2">
            <label
              className={cn(
                "flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-[8px] border border-dashed border-slate-300 text-sm font-medium text-slate-500 hover:border-[#2563EB] hover:text-[#2563EB] transition-colors cursor-pointer",
                subiendoFoto && "opacity-60 pointer-events-none"
              )}
            >
              {subiendoFoto ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
              {subiendoFoto ? "Subiendo…" : "Agregar foto"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={subiendoFoto}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  if (file.size > MAX_ARCHIVO_BYTES) {
                    setErrorFoto(`La foto pesa ${(file.size / 1024 / 1024).toFixed(1)}MB — el máximo es ${MAX_ARCHIVO_MB}MB.`);
                    return;
                  }
                  setErrorFoto(null);
                  try {
                    await onSubirFoto(file);
                  } catch {
                    setErrorFoto("No se pudo subir la foto. Probá de nuevo.");
                  }
                }}
              />
            </label>
            {errorFoto && <p className="text-xs text-red-500">{errorFoto}</p>}

            <button
              type="button"
              onClick={handleAnalizar}
              disabled={imagenesDisponibles.length === 0 || analizando}
              title={
                imagenesDisponibles.length === 0
                  ? "Sin imágenes para analizar — el plano tiene que ser una imagen, o necesitás al menos una foto complementaria"
                  : "Leer cotas con IA y autocompletar la planilla de cómputo"
              }
              className={cn(
                "flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-[8px] text-sm font-semibold transition-colors",
                imagenesDisponibles.length === 0 || analizando
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                  : "bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
              )}
            >
              {analizando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {analizando ? "Analizando…" : "Analizar con IA"}
            </button>
            {errorAnalisis && <p className="text-xs text-red-500">{errorAnalisis}</p>}
          </div>
        </div>
    </div>
  );
}

export { fileToBase64 };
