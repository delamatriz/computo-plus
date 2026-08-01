"use client";

import { useEffect, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { X, ZoomIn, ZoomOut, Maximize2, Loader2, Camera, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { obtenerArchivoCacheado } from "@/lib/archivoCache";
import { PDF_OPTIONS, MAX_ARCHIVO_MB, MAX_ARCHIVO_BYTES, type PlanoDetalle } from "./planoArchivo";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

// El proxy de archivo (ver .../archivo/route.ts) manda la respuesta en
// streaming sin Content-Length, así que la descarga (ver obtenerArchivoCacheado)
// no siempre puede calcular un % exacto — cuando el total es conocido se
// muestra el %, si no, los MB bajados.
function textoProgresoCarga(loaded: number, total: number): string {
  if (total > 0) {
    return `Cargando plano — ${Math.min(100, Math.round((loaded / total) * 100))}%`;
  }
  if (loaded > 0) {
    return `Cargando plano — ${(loaded / 1024 / 1024).toFixed(1)} MB`;
  }
  return "Cargando plano…";
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

  // Estado de carga del archivo principal (PDF o imagen) — el visor abre
  // antes de que el archivo esté disponible localmente, así que hay que
  // mostrar feedback en vez de una pantalla en blanco. La descarga (con
  // progreso) y el cacheo entre aperturas del mismo plano los maneja
  // obtenerArchivoCacheado — ver ese archivo para el motivo (el Cache-
  // Control/ETag del proxy no alcanza por un header Vary que agrega
  // Next.js a todo Route Handler bajo app/api).
  const [cargandoArchivo, setCargandoArchivo] = useState(true);
  const [progresoArchivo, setProgresoArchivo] = useState({ loaded: 0, total: 0 });
  const [archivoBlob, setArchivoBlob] = useState<Blob | null>(null);
  const [imgObjectUrl, setImgObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    setCargandoArchivo(true);
    setProgresoArchivo({ loaded: 0, total: 0 });
    setErrorCarga(null);
    setArchivoBlob(null);
    setImgObjectUrl(null);

    const controller = new AbortController();
    let objectUrl: string | null = null;
    let cancelado = false;

    (async () => {
      try {
        const blob = await obtenerArchivoCacheado(plano.archivo, {
          signal: controller.signal,
          onProgress: (loaded, total) => setProgresoArchivo({ loaded, total }),
        });
        if (cancelado) return;
        if (plano.tipoArchivo === "IMAGEN") {
          objectUrl = URL.createObjectURL(blob);
          setImgObjectUrl(objectUrl);
        }
        setArchivoBlob(blob);
        setCargandoArchivo(false);
      } catch (err) {
        if (cancelado || (err instanceof DOMException && err.name === "AbortError")) return;
        setErrorCarga(plano.tipoArchivo === "PDF" ? "No se pudo cargar el PDF." : "No se pudo cargar la imagen.");
        setCargandoArchivo(false);
      }
    })();

    return () => {
      cancelado = true;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [plano.id, plano.tipoArchivo, plano.archivo]);

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
            {cargandoArchivo && !errorCarga && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-slate-100/90">
                <Loader2 className="w-6 h-6 text-[#2563EB] animate-spin" />
                <p className="text-sm text-slate-500">
                  {textoProgresoCarga(progresoArchivo.loaded, progresoArchivo.total)}
                </p>
                {progresoArchivo.total > 0 && (
                  <div className="w-40 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-[#2563EB] transition-[width] duration-150"
                      style={{ width: `${Math.min(100, Math.round((progresoArchivo.loaded / progresoArchivo.total) * 100))}%` }}
                    />
                  </div>
                )}
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
                      archivoBlob && (
                        <Document
                          file={archivoBlob}
                          options={PDF_OPTIONS}
                          onLoadError={() => setErrorCarga("No se pudo cargar el PDF.")}
                          loading={null}
                        >
                          <Page
                            pageNumber={plano.paginaPDF ?? 1}
                            width={900}
                            renderTextLayer={false}
                            renderAnnotationLayer={false}
                          />
                        </Document>
                      )
                    ) : (
                      imgObjectUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={imgObjectUrl}
                          alt={plano.nombre}
                          className="max-w-none select-none"
                          onError={() => setErrorCarga("No se pudo cargar la imagen.")}
                        />
                      )
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
