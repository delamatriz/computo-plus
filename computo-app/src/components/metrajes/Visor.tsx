"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Document, Page, pdfjs } from "react-pdf";
import { TransformWrapper, TransformComponent, type ReactZoomPanPinchRef } from "react-zoom-pan-pinch";
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
  Trash2,
  Ruler,
  AlertTriangle,
  Slash,
  Hexagon,
  Pencil,
  Type as TypeIcon,
  Info,
  Plus,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { obtenerArchivoCacheado } from "@/lib/archivoCache";
import { PDF_OPTIONS, parsearEscala, type DocumentoDetalle, type DocumentoResumen, type MedicionDocumento, type Anotacion } from "./documentoMetraje";

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

// ── Calibración de escala — Etapa 2 de "Metrajes con plano"
// (UI_UX_REDESIGN.md sección 6). Solo aplica a categoria=PLANO. Principio
// no negociable del diseño: sin calibrar no se puede medir — por ahora
// esta ronda solo guarda el factor de escala, no lo usa todavía (eso es
// la Etapa 3, herramientas de dibujo/medición, ronda futura). Método B
// (escala declarada, ej. "1:100") implementado acá; Método A (por cota)
// queda pendiente. ───────────────────────────────────────────────────

function ModalCalibrarEscala({
  escalaActual,
  onClose,
  onGuardar,
}: {
  escalaActual: string | null;
  onClose: () => void;
  onGuardar: (escalaDeclarada: string, factorEscala: number) => Promise<void>;
}) {
  const [valor, setValor] = useState(escalaActual ?? "");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    const parseada = parsearEscala(valor);
    if (!parseada) {
      setError('Escribí la escala en formato 1:100');
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await onGuardar(parseada.normalizada, parseada.factor);
      onClose();
    } catch {
      setError("No se pudo guardar la calibración. Probá de nuevo.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-[16px] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-base font-bold text-[#1A3A5C]">Calibrar escala</h2>
          <button onClick={onClose} className="p-1.5 rounded-[6px] text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-2.5">
          <label className="block text-sm font-semibold text-[#1A3A5C]">Escala del plano</label>
          <input
            type="text"
            value={valor}
            onChange={(e) => {
              setValor(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && guardar()}
            placeholder="Ej. 1:100"
            autoFocus
            className="w-full px-3 py-2 rounded-[10px] border border-slate-300 bg-[#F8FAFC] text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
          />
          {error ? (
            <p className="text-xs text-red-600">{error}</p>
          ) : (
            <p className="text-xs text-slate-400">
              Ingresá la escala tal como figura en el plano (ej. &quot;1:50&quot;, &quot;1:100&quot;). Sin calibrar no se puede medir.
            </p>
          )}
        </div>
        <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={guardando}
            className="px-4 py-2 rounded-[8px] text-sm font-medium text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={!valor.trim() || guardando}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-[8px] text-sm font-semibold text-white transition-colors",
              !valor.trim() || guardando ? "bg-slate-300 cursor-not-allowed" : "bg-[#2563EB] hover:bg-[#1D4ED8]"
            )}
          >
            {guardando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// FILA 1 del Visor — indicador de calibración + botón para
// calibrar/cambiar escala. El rubro de una medición YA NO se elige
// acá ni en el modal de confirmación — se asocia después, directo en
// la columna "Rubro vinculado" de la Planilla de Cómputo, igual que
// cualquier otra fila tipeada a mano (ver investigación: el rubroId
// de una fila/medición nunca actualizó Rubro.cantidad en la base, es
// puramente informativo — no hay ninguna razón para forzar elegirlo
// ANTES de medir).
function FilaCalibracion({
  doc,
  onGuardarCalibracion,
}: {
  doc: DocumentoDetalle;
  onGuardarCalibracion: (escalaDeclarada: string, factorEscala: number) => Promise<void>;
}) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const calibrado = doc.factorEscala != null && doc.escalaDeclarada;

  return (
    <>
      <div
        className={cn(
          "flex-shrink-0 flex items-center gap-3 px-4 py-2 border-b flex-wrap",
          calibrado ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"
        )}
      >
        <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
          {calibrado ? (
            <Ruler className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          )}
          <span className={cn("text-xs font-semibold truncate", calibrado ? "text-emerald-700" : "text-amber-700")}>
            {calibrado
              ? `Calibrado — Escala ${doc.escalaDeclarada}`
              : "Sin calibrar — no se puede medir todavía"}
          </span>
          <span
            title="La escala le dice al sistema qué tan grande es tu plano en la realidad, para poder calcular medidas reales cuando midas sobre él."
            className="flex-shrink-0 cursor-help"
          >
            <Info className={cn("w-3.5 h-3.5", calibrado ? "text-emerald-500" : "text-amber-500")} />
          </span>
        </div>
        {calibrado ? (
          <button
            onClick={() => setModalAbierto(true)}
            title="Volver a declarar la escala de este plano — reemplaza la calibración actual"
            className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] border border-emerald-300 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold transition-colors"
          >
            <Ruler className="w-3.5 h-3.5" /> Cambiar escala
          </button>
        ) : (
          <button
            onClick={() => setModalAbierto(true)}
            className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold transition-colors"
          >
            <Ruler className="w-3.5 h-3.5" /> Calibrar escala
          </button>
        )}
      </div>
      {modalAbierto && (
        <ModalCalibrarEscala
          escalaActual={doc.escalaDeclarada}
          onClose={() => setModalAbierto(false)}
          onGuardar={onGuardarCalibracion}
        />
      )}
    </>
  );
}

// ── Herramienta de Línea — Etapa 3 de "Metrajes con plano"
// (UI_UX_REDESIGN.md sección 6, Modo A manual), primera ronda: solo
// tipo="LINEA". Área y Punto quedan para rondas futuras; Modo B (por
// IA) también.
//
// Mapeo de coordenadas: en vez de trackear scale/positionX/positionY de
// TransformWrapper (no expone ninguno de los dos hoy — ni ref ni
// callback), usamos SVGElement.getScreenCTM(). El <svg> vive DENTRO de
// TransformComponent, como hermano del documento, con
// viewBox="0 0 100 100" ocupando exactamente su misma caja — así hereda
// el pan/zoom automáticamente, sin recalcular nada a mano, y
// getScreenCTM().inverse() convierte cualquier click de pantalla a
// coordenadas 0-100% (%) del documento sin importar el zoom/pan actual.
//
// Restricción a PDF: convertir distancia-en-papel a metros reales
// necesita el tamaño FÍSICO del documento. Un PDF lo tiene (tamaño de
// página en puntos, 72pt = 1", dato embebido en el archivo). Una imagen
// (foto/escaneo) no tiene ningún tamaño físico confiable — calcular con
// un DPI supuesto daría medidas incorrectas. Por eso la herramienta
// solo se habilita para categoria=PLANO && tipoArchivo=PDF; para
// imágenes hace falta calibrar por cota (Método A, ronda futura).

export type NuevaMedicionInput =
  | {
      tipo: "LINEA";
      xInicio: number;
      yInicio: number;
      xFin: number;
      yFin: number;
      longitudReal: number;
      repeticiones: number;
      descripcion: string;
      rubroId: string | null;
    }
  | {
      tipo: "AREA";
      puntos: { x: number; y: number }[];
      areaReal: number;
      repeticiones: number;
      descripcion: string;
      rubroId: string | null;
    };

// Anotaciones libres — Trazo (mano alzada) y Texto, sin medida ni
// rubro asociado (ver comentario en prisma/schema.prisma).
export type NuevaAnotacionInput =
  | { tipo: "TRAZO"; puntos: { x: number; y: number }[] }
  | { tipo: "TEXTO"; x: number; y: number; texto: string; tamano: number };

function calcularLongitudReal(
  xInicio: number,
  yInicio: number,
  xFin: number,
  yFin: number,
  pageDimsMM: { width: number; height: number },
  factorEscala: number
): number {
  const dxMM = ((xFin - xInicio) / 100) * pageDimsMM.width;
  const dyMM = ((yFin - yInicio) / 100) * pageDimsMM.height;
  const distanciaPapelMM = Math.hypot(dxMM, dyMM);
  return (distanciaPapelMM * factorEscala) / 1000;
}

// Área real de un polígono — fórmula de polígono / shoelace sobre las
// coordenadas convertidas a mm de papel (mismo mecanismo que
// calcularLongitudReal), con un matiz importante: el área escala con
// el CUADRADO del factor de escala (no linealmente como la longitud),
// porque tanto el ancho como el alto del polígono se multiplican por
// ese factor. Último punto se conecta de vuelta al primero (% i+1 con
// wraparound) para cerrar el polígono sin necesidad de repetirlo en el
// array de entrada.
function calcularAreaReal(
  puntos: { x: number; y: number }[],
  pageDimsMM: { width: number; height: number },
  factorEscala: number
): number {
  const puntosMM = puntos.map((p) => ({
    x: (p.x / 100) * pageDimsMM.width,
    y: (p.y / 100) * pageDimsMM.height,
  }));
  let suma = 0;
  for (let i = 0; i < puntosMM.length; i++) {
    const a = puntosMM[i];
    const b = puntosMM[(i + 1) % puntosMM.length];
    suma += a.x * b.y - b.x * a.y;
  }
  const areaPapelMM2 = Math.abs(suma) / 2;
  const areaRealMM2 = areaPapelMM2 * factorEscala * factorEscala;
  return areaRealMM2 / 1_000_000;
}

function puntoDesdeEvento(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } | null {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const p = pt.matrixTransform(ctm.inverse());
  return { x: Math.min(100, Math.max(0, p.x)), y: Math.min(100, Math.max(0, p.y)) };
}

// Modal de confirmación compartido entre Línea y Área — mismo patrón
// de UX para ambas: valor calculado pre-cargado (editable a mano),
// descripción, repeticiones. Sin rubro acá — se asigna después, directo
// en la columna "Rubro vinculado" de la Planilla (ver comentario en
// FilaCalibracion). Solo cambia la etiqueta/unidad del valor numérico.
function ModalConfirmarMedicion({
  unidadLabel,
  valorInicial,
  onCancelar,
  onGuardar,
}: {
  unidadLabel: string;
  valorInicial: number;
  onCancelar: () => void;
  onGuardar: (descripcion: string, repeticiones: number, valor: number) => Promise<void>;
}) {
  const [descripcion, setDescripcion] = useState("");
  const [repeticiones, setRepeticiones] = useState("1");
  const [valor, setValor] = useState(valorInicial.toFixed(2));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async () => {
    const rep = parseFloat(repeticiones.replace(",", "."));
    const val = parseFloat(valor.replace(",", "."));
    if (!descripcion.trim()) {
      setError("Escribí una descripción.");
      return;
    }
    if (!isFinite(rep) || rep <= 0) {
      setError("Las repeticiones tienen que ser mayores a 0.");
      return;
    }
    if (!isFinite(val) || val <= 0) {
      setError(`${unidadLabel} tiene que ser mayor a 0.`);
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await onGuardar(descripcion.trim(), rep, val);
    } catch {
      setError("No se pudo guardar la medición. Probá de nuevo.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancelar} />
      <div className="relative w-full max-w-sm bg-white rounded-[16px] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-base font-bold text-[#1A3A5C]">Nueva medición</h2>
          <button onClick={onCancelar} className="p-1.5 rounded-[6px] text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-sm font-semibold text-[#1A3A5C] mb-1">Descripción</label>
            <input
              type="text"
              value={descripcion}
              onChange={(e) => {
                setDescripcion(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && guardar()}
              placeholder="Ej. Muro eje A"
              autoFocus
              className="w-full px-3 py-2 rounded-[10px] border border-slate-300 bg-[#F8FAFC] text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-[#1A3A5C] mb-1">{unidadLabel}</label>
              <input
                type="text"
                inputMode="decimal"
                value={valor}
                onChange={(e) => {
                  setValor(e.target.value);
                  if (error) setError(null);
                }}
                className="w-full px-3 py-2 rounded-[10px] border border-slate-300 bg-[#F8FAFC] text-sm text-slate-700 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold text-[#1A3A5C] mb-1">Repeticiones</label>
              <input
                type="text"
                inputMode="decimal"
                value={repeticiones}
                onChange={(e) => {
                  setRepeticiones(e.target.value);
                  if (error) setError(null);
                }}
                className="w-full px-3 py-2 rounded-[10px] border border-slate-300 bg-[#F8FAFC] text-sm text-slate-700 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={onCancelar}
            disabled={guardando}
            className="px-4 py-2 rounded-[8px] text-sm font-medium text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={guardando}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-[8px] text-sm font-semibold text-white transition-colors",
              guardando ? "bg-slate-300 cursor-not-allowed" : "bg-[#2563EB] hover:bg-[#1D4ED8]"
            )}
          >
            {guardando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal de la herramienta de Texto — texto libre (letra o palabra) más
// un control de tamaño con vista previa en vivo (el "agrandar o
// achicar el tamaño después de colocarlo" se resuelve acá: el punto ya
// quedó fijado en el plano al hacer click, y este paso deja ajustar el
// tamaño ANTES de confirmar, viendo el resultado real en vez de un
// número abstracto). Tamaño en px a escala 100% de zoom — el wrapper
// que envuelve el documento ya escala con el zoom/pan, así que el
// texto crece o achica junto con el plano sin ningún cálculo extra acá.
const TEXTO_TAMANO_MIN = 10;
const TEXTO_TAMANO_MAX = 48;
const TEXTO_TAMANO_INICIAL = 18;
const TEXTO_TAMANO_PASO = 4;

function ModalNuevoTexto({
  onCancelar,
  onGuardar,
}: {
  onCancelar: () => void;
  onGuardar: (texto: string, tamano: number) => Promise<void>;
}) {
  const [texto, setTexto] = useState("");
  const [tamano, setTamano] = useState(TEXTO_TAMANO_INICIAL);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async () => {
    if (!texto.trim()) {
      setError("Escribí un texto.");
      return;
    }
    if (texto.trim().length > 200) {
      setError("Máximo 200 caracteres.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await onGuardar(texto.trim(), tamano);
    } catch {
      setError("No se pudo guardar el texto. Probá de nuevo.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancelar} />
      <div className="relative w-full max-w-sm bg-white rounded-[16px] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-base font-bold text-[#1A3A5C]">Nuevo texto</h2>
          <button onClick={onCancelar} className="p-1.5 rounded-[6px] text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-sm font-semibold text-[#1A3A5C] mb-1">Texto</label>
            <input
              type="text"
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && guardar()}
              placeholder="Ej. A, Ver detalle 3, Revisar nivel"
              maxLength={200}
              autoFocus
              className="w-full px-3 py-2 rounded-[10px] border border-slate-300 bg-[#F8FAFC] text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#1A3A5C] mb-1">Tamaño</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTamano((t) => Math.max(TEXTO_TAMANO_MIN, t - TEXTO_TAMANO_PASO))}
                disabled={tamano <= TEXTO_TAMANO_MIN}
                className="p-1.5 rounded-[8px] border border-slate-300 text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setTamano((t) => Math.min(TEXTO_TAMANO_MAX, t + TEXTO_TAMANO_PASO))}
                disabled={tamano >= TEXTO_TAMANO_MAX}
                className="p-1.5 rounded-[8px] border border-slate-300 text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <div className="flex-1 min-w-0 flex items-center justify-center px-3 py-2 rounded-[10px] bg-[#F8FAFC] border border-slate-200 overflow-hidden">
                <span
                  style={{ fontSize: `${Math.min(tamano, 28)}px` }}
                  className="font-bold text-[#2563EB] whitespace-nowrap leading-none"
                >
                  {texto.trim() || "Vista previa"}
                </span>
              </div>
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={onCancelar}
            disabled={guardando}
            className="px-4 py-2 rounded-[8px] text-sm font-medium text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={guardando}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-[8px] text-sm font-semibold text-white transition-colors",
              guardando ? "bg-slate-300 cursor-not-allowed" : "bg-[#2563EB] hover:bg-[#1D4ED8]"
            )}
          >
            {guardando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Mínimo de la forma de PDFPageProxy que usamos — evitar depender del
// tipo exacto exportado por pdfjs-dist/react-pdf.
type PaginaPDFCargada = { getViewport: (opts: { scale: number }) => { width: number; height: number } };

// ── Nitidez del PDF al hacer zoom ───────────────────────────────────────
// <Page width={900}> fija el tamaño EN PANTALLA (CSS) — el zoom de
// TransformWrapper es un transform CSS puro sobre ese render ya
// rasterizado, así que agrandarlo lo desenfoca. react-pdf ya separa
// "tamaño en pantalla" (width/scale) de "resolución interna del canvas"
// (prop devicePixelRatio, ver node_modules/react-pdf/src/Page/Canvas.tsx:
// canvas.width usa scale*devicePixelRatio, canvas.style.width usa solo
// scale) — así que re-renderizamos más nítido subiendo devicePixelRatio
// según el zoom actual, sin tocar el tamaño CSS ni pelear con el
// scale/pan de TransformWrapper.
//
// Cuantizado en escalones (no continuo) y solo al soltar el gesto
// (onZoomStop/onPanningStop, no onTransform) para no redibujar el canvas
// en cada frame de un pinch/wheel — page.render() no es gratis. Tope
// duro en dpr efectivo 4 (⇒ ~3600px de ancho de canvas sobre width=900)
// para no explotar memoria/límites de canvas en pantallas retina con
// planos grandes, aunque el multiplicador y el devicePixelRatio real de
// la pantalla ya sumen más que eso.
//
// "Queda en blanco" al re-renderizar: confirmado leyendo
// node_modules/react-pdf/src/Page/Canvas.tsx — cuando cambia
// devicePixelRatio, react-pdf hace `canvas.width = ...` /
// `canvas.height = ...` sobre el MISMO <canvas>, lo cual por spec del
// navegador borra el contenido ya dibujado al instante (no es algo que
// react-pdf elige, es cómo funciona <canvas> al cambiar su resolución
// interna) — y de paso pone `canvas.style.visibility = "hidden"`
// mientras corre `page.render()`, a propósito, para no mostrar un
// frame a medio dibujar. No hay forma de "mantener el canvas viejo
// visible" sin renderizar DOS <Page> en paralelo (una vieja, una
// nueva, swap al terminar) — bastante más complejo y el doble de
// carga de render por cada cambio de nitidez. En vez de eso, la
// solución de acá es más simple y honesta: reemplazar el blanco sin
// avisar por un indicador de carga breve, así se lee como "un
// momento, ajustando nitidez" en vez de "esto se rompió".
const DPR_MAXIMO = 4;

function multiplicadorParaEscala(scale: number): number {
  if (scale <= 1.3) return 1;
  if (scale <= 2.5) return 2;
  if (scale <= 4) return 3;
  return 4;
}

// ── Visor principal — documento fijo y grande, con zoom/pan ────────────

export interface ControlesZoom {
  zoomIn: () => void;
  zoomOut: () => void;
  resetTransform: () => void;
}

/** Expone el estado + acciones de las herramientas de medición/anotación
 * del VisorPrincipal hacia FILA 2 (botones "Medir"/"Área"/"Trazo"/
 * "Texto") del Visor — mismo patrón que ControlesZoom. Solo una
 * herramienta puede estar activa a la vez. Sin rubro acá — se elige
 * después en la Planilla. */
export interface ControlesMedicion {
  pageDimsListo: boolean;
  /** null tanto cuando no hay ninguna herramienta activa como cuando la
   * activa es Trazo o Texto (ver trazoActivo/textoActivo) — así los
   * botones de Línea/Área no se muestran "prendidos" con otra
   * herramienta puesta. */
  herramienta: "LINEA" | "AREA" | null;
  onToggleLinea: () => void;
  /** Click en el botón "Área" — arranca la herramienta si está
   * apagada; con la herramienta prendida y menos de 3 vértices puestos
   * la apaga (cancela); con 3+ vértices, cierra el polígono (mismo
   * botón hace de "Finalizar"). */
  onToggleArea: () => void;
  /** Vértices puestos del polígono en curso — FILA 2 lo usa para
   * decidir el texto del botón ("Dibujando…" vs "Finalizar (N)"). */
  puntosAreaCount: number;
  /** Trazo libre y Texto — anotaciones sin calibración/rubro/PDF de
   * por medio, así que se manejan aparte de herramienta (arriba). */
  trazoActivo: boolean;
  onToggleTrazo: () => void;
  textoActivo: boolean;
  onToggleTexto: () => void;
}

// Medición pendiente de confirmar en el modal — Línea o Área, cada
// una con su geometría propia además del valor calculado (editable a
// mano en el modal antes de guardar).
type MedicionPendiente =
  | { tipo: "LINEA"; xInicio: number; yInicio: number; xFin: number; yFin: number; valor: number }
  | { tipo: "AREA"; puntos: { x: number; y: number }[]; valor: number };

function VisorPrincipal({
  doc,
  mediciones,
  anotaciones,
  onGuardarMedicion,
  onEliminarMedicion,
  onGuardarAnotacion,
  onEliminarAnotacion,
  onControlesZoomListos,
  onControlesMedicionListos,
}: {
  doc: DocumentoDetalle;
  mediciones: MedicionDocumento[];
  anotaciones: Anotacion[];
  onGuardarMedicion: (input: NuevaMedicionInput) => Promise<void>;
  /** Borra una marca de medición ya guardada (corrección de un trazo mal
   * hecho) — también saca la fila que había generado en la Planilla. */
  onEliminarMedicion: (medicionId: string) => Promise<void>;
  onGuardarAnotacion: (input: NuevaAnotacionInput) => Promise<void>;
  onEliminarAnotacion: (anotacionId: string) => Promise<void>;
  /** Expone zoomIn/zoomOut/resetTransform del TransformWrapper hacia el
   * header del Visor (fuera de este árbol) — los botones de zoom viven
   * ahí, junto a expandir/cerrar, en vez de flotando sobre el documento. */
  onControlesZoomListos: (controles: ControlesZoom | null) => void;
  /** Expone el estado de las herramientas de medición hacia FILA 2 del
   * Visor (fuera de este árbol). */
  onControlesMedicionListos: (controles: ControlesMedicion | null) => void;
}) {
  const { cargando, progreso, blob, imgObjectUrl, error, setError } = useArchivoBlob(doc);
  const [eliminandoMedicionIds, setEliminandoMedicionIds] = useState<Set<string>>(new Set());
  const handleEliminarMedicion = async (medicionId: string) => {
    setEliminandoMedicionIds((prev) => new Set(prev).add(medicionId));
    try {
      await onEliminarMedicion(medicionId);
    } finally {
      setEliminandoMedicionIds((prev) => {
        const next = new Set(prev);
        next.delete(medicionId);
        return next;
      });
    }
  };

  const svgRef = useRef<SVGSVGElement | null>(null);
  const transformRef = useRef<ReactZoomPanPinchRef | null>(null);
  const [multiplicadorDPR, setMultiplicadorDPR] = useState(1);
  // true durante la ventana entre "el escalón de nitidez subió" y "el
  // canvas terminó de redibujarse" — ver comentario en DPR_MAXIMO.
  const [renderizandoPDF, setRenderizandoPDF] = useState(false);
  const actualizarDPRSegunZoom = (ref: ReactZoomPanPinchRef) => {
    const nuevoMultiplicador = multiplicadorParaEscala(ref.state.scale);
    if (nuevoMultiplicador !== multiplicadorDPR) setRenderizandoPDF(true);
    setMultiplicadorDPR(nuevoMultiplicador);
  };
  const dprRender = Math.min((typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1) * multiplicadorDPR, DPR_MAXIMO);
  const [pageDimsMM, setPageDimsMM] = useState<{ width: number; height: number } | null>(null);
  const [herramienta, setHerramienta] = useState<"LINEA" | "AREA" | "TRAZO" | "TEXTO" | null>(null);
  const [dibujoActual, setDibujoActual] = useState<{ xInicio: number; yInicio: number; xActual: number; yActual: number } | null>(null);
  const [puntosArea, setPuntosArea] = useState<{ x: number; y: number }[]>([]);
  const [cursorArea, setCursorArea] = useState<{ x: number; y: number } | null>(null);
  const [medicionPendiente, setMedicionPendiente] = useState<MedicionPendiente | null>(null);
  // Trazo libre — path en curso (mientras se arrastra) y path ya
  // terminado que se intenta guardar automáticamente al soltar el mouse
  // (sin modal — no hay ningún dato que pedirle al usuario). Si el
  // guardado falla, trazoPendiente se mantiene (banner de error con
  // Reintentar/Cancelar más abajo) en vez de perderse.
  const [trazoActual, setTrazoActual] = useState<{ x: number; y: number }[] | null>(null);
  const [trazoPendiente, setTrazoPendiente] = useState<{ x: number; y: number }[] | null>(null);
  const [guardandoTrazo, setGuardandoTrazo] = useState(false);
  const [errorTrazo, setErrorTrazo] = useState<string | null>(null);
  // Texto — punto ya clickeado, esperando que el usuario escriba el
  // texto y confirme en ModalNuevoTexto.
  const [textoPendientePunto, setTextoPendientePunto] = useState<{ x: number; y: number } | null>(null);

  const handlePaginaCargada = (page: PaginaPDFCargada) => {
    const viewport = page.getViewport({ scale: 1 });
    setPageDimsMM({ width: (viewport.width * 25.4) / 72, height: (viewport.height * 25.4) / 72 });
  };

  const onSvgMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const p = puntoDesdeEvento(svgRef.current, e.clientX, e.clientY);
    if (!p) return;
    if (herramienta === "LINEA" && !medicionPendiente) {
      setDibujoActual({ xInicio: p.x, yInicio: p.y, xActual: p.x, yActual: p.y });
    } else if (herramienta === "TRAZO" && !trazoPendiente) {
      setTrazoActual([p]);
    }
  };

  const onSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const p = puntoDesdeEvento(svgRef.current, e.clientX, e.clientY);
    if (!p) return;
    if (herramienta === "LINEA" && dibujoActual) {
      setDibujoActual((prev) => (prev ? { ...prev, xActual: p.x, yActual: p.y } : prev));
    } else if (herramienta === "AREA" && puntosArea.length > 0 && !medicionPendiente) {
      setCursorArea(p);
    } else if (herramienta === "TRAZO" && trazoActual) {
      // Umbral mínimo de distancia entre puntos capturados — mousemove
      // dispara mucho más seguido de lo que hace falta para representar
      // el trazo con fidelidad, y guardar cada evento infla el array de
      // puntos sin necesidad.
      setTrazoActual((prev) => {
        if (!prev) return prev;
        const ultimo = prev[prev.length - 1];
        if (Math.hypot(p.x - ultimo.x, p.y - ultimo.y) < 0.4) return prev;
        return [...prev, p];
      });
    }
  };

  const finalizarDibujoLinea = () => {
    if (herramienta !== "LINEA" || !dibujoActual) return;
    const { xInicio, yInicio, xActual: xFin, yActual: yFin } = dibujoActual;
    setDibujoActual(null);
    const distPercent = Math.hypot(xFin - xInicio, yFin - yInicio);
    if (distPercent < 0.5 || !pageDimsMM || doc.factorEscala == null) return;
    const valor = calcularLongitudReal(xInicio, yInicio, xFin, yFin, pageDimsMM, doc.factorEscala);
    setMedicionPendiente({ tipo: "LINEA", xInicio, yInicio, xFin, yFin, valor });
  };

  // Red de seguridad para el drag de Línea: el mouseup normal está atado
  // al <svg> (onMouseUp más abajo), pero si el usuario suelta el botón
  // fuera de sus límites (arrastra hacia la barra de herramientas, hacia
  // el panel lateral, etc.) ese evento nunca llega al <svg> y el trazo
  // gris de construcción se queda pegado en pantalla indefinidamente —
  // bug reportado por el usuario. Escuchar mouseup en window (que sí
  // recibe el evento sin importar sobre qué elemento se soltó) garantiza
  // que dibujoActual siempre se resuelva. Se re-suscribe en cada cambio
  // de dibujoActual (incluido cada mousemove del drag) a propósito: así
  // finalizarDibujoLinea siempre cierra sobre el punto más reciente.
  useEffect(() => {
    if (!dibujoActual) return;
    window.addEventListener("mouseup", finalizarDibujoLinea);
    return () => window.removeEventListener("mouseup", finalizarDibujoLinea);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dibujoActual]);

  const intentarGuardarTrazo = async (puntos: { x: number; y: number }[]) => {
    setGuardandoTrazo(true);
    setErrorTrazo(null);
    try {
      await onGuardarAnotacion({ tipo: "TRAZO", puntos });
      setTrazoPendiente(null);
    } catch {
      setErrorTrazo("No se pudo guardar el trazo.");
    } finally {
      setGuardandoTrazo(false);
    }
  };

  const finalizarTrazo = () => {
    if (herramienta !== "TRAZO" || !trazoActual) return;
    const puntos = trazoActual;
    setTrazoActual(null);
    if (puntos.length < 2) return;
    setTrazoPendiente(puntos);
    intentarGuardarTrazo(puntos);
  };

  // Misma red de seguridad que finalizarDibujoLinea (ver comentario
  // arriba) — el trazo a mano alzada también se dibuja con
  // mousedown+mousemove+mouseup, así que corre el mismo riesgo de que
  // el mouseup se suelte fuera del <svg>.
  useEffect(() => {
    if (!trazoActual) return;
    window.addEventListener("mouseup", finalizarTrazo);
    return () => window.removeEventListener("mouseup", finalizarTrazo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trazoActual]);

  // Click para AREA (agrega un vértice) y para TEXTO (abre el modal en
  // ese punto). mousedown/mouseup ya están ocupados por el drag de
  // Línea/Trazo, así que ambas usan onClick (un click "de verdad", sin
  // arrastre significativo de por medio) para no pisarse con esa lógica.
  const onSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    if (herramienta === "AREA" && !medicionPendiente) {
      const p = puntoDesdeEvento(svgRef.current, e.clientX, e.clientY);
      if (p) setPuntosArea((prev) => [...prev, p]);
    } else if (herramienta === "TEXTO" && !textoPendientePunto) {
      const p = puntoDesdeEvento(svgRef.current, e.clientX, e.clientY);
      if (p) setTextoPendientePunto(p);
    }
  };

  const onSvgMouseLeave = () => {
    if (herramienta === "LINEA") {
      finalizarDibujoLinea();
    } else if (herramienta === "AREA") {
      // Solo se limpia la línea de previsualización — los vértices ya
      // puestos se mantienen, perderlos porque el mouse salió un
      // instante del plano (ej. al ir a buscar la barra de zoom) sería
      // muy frustrante en un polígono de varios clicks.
      setCursorArea(null);
    } else if (herramienta === "TRAZO") {
      finalizarTrazo();
    }
  };

  const finalizarArea = () => {
    if (puntosArea.length < 3 || !pageDimsMM || doc.factorEscala == null) return;
    const valor = calcularAreaReal(puntosArea, pageDimsMM, doc.factorEscala);
    setMedicionPendiente({ tipo: "AREA", puntos: puntosArea, valor });
    setPuntosArea([]);
    setCursorArea(null);
  };

  const toggleLinea = () => {
    if (herramienta === "LINEA") {
      setHerramienta(null);
      setDibujoActual(null);
      return;
    }
    setHerramienta("LINEA");
    setPuntosArea([]);
    setCursorArea(null);
    setTrazoActual(null);
    setTextoPendientePunto(null);
  };

  const toggleArea = () => {
    if (herramienta !== "AREA") {
      setHerramienta("AREA");
      setPuntosArea([]);
      setCursorArea(null);
      setDibujoActual(null);
      setTrazoActual(null);
      setTextoPendientePunto(null);
      return;
    }
    if (puntosArea.length >= 3) {
      finalizarArea();
    } else {
      setHerramienta(null);
      setPuntosArea([]);
      setCursorArea(null);
    }
  };

  const toggleTrazo = () => {
    if (herramienta === "TRAZO") {
      setHerramienta(null);
      setTrazoActual(null);
      return;
    }
    setHerramienta("TRAZO");
    setDibujoActual(null);
    setPuntosArea([]);
    setCursorArea(null);
    setTextoPendientePunto(null);
  };

  const toggleTexto = () => {
    if (herramienta === "TEXTO") {
      setHerramienta(null);
      setTextoPendientePunto(null);
      return;
    }
    setHerramienta("TEXTO");
    setDibujoActual(null);
    setPuntosArea([]);
    setCursorArea(null);
    setTrazoActual(null);
  };

  const confirmarTexto = async (texto: string, tamano: number) => {
    if (!textoPendientePunto) return;
    await onGuardarAnotacion({ tipo: "TEXTO", x: textoPendientePunto.x, y: textoPendientePunto.y, texto, tamano });
    setTextoPendientePunto(null);
  };

  const eliminarAnotacionConConfirmacion = (anotacion: Anotacion) => {
    const etiqueta = anotacion.tipo === "TEXTO" ? `el texto "${anotacion.texto}"` : "el trazo";
    if (confirm(`¿Eliminar ${etiqueta}?`)) {
      onEliminarAnotacion(anotacion.id);
    }
  };

  const confirmarMedicion = async (descripcion: string, repeticiones: number, valor: number) => {
    if (!medicionPendiente) return;
    // Sin rubro acá — se elige después en la columna "Rubro vinculado"
    // de la Planilla, igual que cualquier otra fila.
    if (medicionPendiente.tipo === "LINEA") {
      await onGuardarMedicion({
        tipo: "LINEA",
        xInicio: medicionPendiente.xInicio,
        yInicio: medicionPendiente.yInicio,
        xFin: medicionPendiente.xFin,
        yFin: medicionPendiente.yFin,
        longitudReal: valor,
        repeticiones,
        descripcion,
        rubroId: null,
      });
    } else {
      await onGuardarMedicion({
        tipo: "AREA",
        puntos: medicionPendiente.puntos,
        areaReal: valor,
        repeticiones,
        descripcion,
        rubroId: null,
      });
    }
    setMedicionPendiente(null);
  };

  useEffect(() => {
    if (doc.tipoArchivo === "DWG") {
      onControlesZoomListos(null);
      return;
    }
    onControlesZoomListos({
      zoomIn: () => transformRef.current?.zoomIn(),
      zoomOut: () => transformRef.current?.zoomOut(),
      resetTransform: () => transformRef.current?.resetTransform(),
    });
    return () => onControlesZoomListos(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.tipoArchivo]);

  // Empuja el estado de las herramientas de medición hacia arriba en
  // cada cambio relevante (no solo al montar) — a diferencia del efecto
  // de zoom de arriba, FILA 2 necesita reflejar valores que cambian
  // todo el tiempo (qué herramienta está activa, cuántos vértices lleva
  // el polígono), no solo funciones estables. El unmount (doc.id
  // cambia, o se cierra el documento) se maneja aparte para no limpiar
  // y volver a setear en cada cambio.
  useEffect(() => {
    if (doc.tipoArchivo === "DWG") {
      onControlesMedicionListos(null);
      return;
    }
    onControlesMedicionListos({
      pageDimsListo: pageDimsMM != null,
      herramienta: herramienta === "LINEA" || herramienta === "AREA" ? herramienta : null,
      onToggleLinea: toggleLinea,
      onToggleArea: toggleArea,
      puntosAreaCount: puntosArea.length,
      trazoActivo: herramienta === "TRAZO",
      onToggleTrazo: toggleTrazo,
      textoActivo: herramienta === "TEXTO",
      onToggleTexto: toggleTexto,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.tipoArchivo, pageDimsMM, herramienta, puntosArea.length]);

  useEffect(() => {
    return () => onControlesMedicionListos(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      {renderizandoPDF && !cargando && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-white/95 rounded-full px-3 py-1.5 shadow-md border border-slate-200 pointer-events-none">
          <Loader2 className="w-3.5 h-3.5 text-[#2563EB] animate-spin" />
          <span className="text-xs text-slate-500">Ajustando nitidez…</span>
        </div>
      )}
      {errorTrazo && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-white rounded-[10px] px-3 py-2 shadow-lg border border-red-200">
          <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
          <p className="text-xs text-red-600">{errorTrazo}</p>
          <button
            onClick={() => trazoPendiente && intentarGuardarTrazo(trazoPendiente)}
            disabled={guardandoTrazo}
            className="text-xs font-semibold text-[#2563EB] hover:underline disabled:opacity-40"
          >
            Reintentar
          </button>
          <button
            onClick={() => {
              setTrazoPendiente(null);
              setErrorTrazo(null);
            }}
            className="text-xs font-semibold text-slate-500 hover:underline"
          >
            Cancelar
          </button>
        </div>
      )}
      <TransformWrapper
        ref={transformRef}
        initialScale={1}
        minScale={0.3}
        maxScale={6}
        centerOnInit
        panning={{ disabled: herramienta != null, velocityDisabled: false }}
        onZoomStop={actualizarDPRSegunZoom}
        onPanningStop={actualizarDPRSegunZoom}
      >
        {/* OJO: contentStyle NO debe forzar width/height/flex — la librería
            centra vía centerOnInit midiendo el tamaño NATURAL del
            contenido. Ver comentario histórico en el visor anterior. */}
        <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }} wrapperClass={cn("select-none", herramienta != null ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing")}>
          <div style={{ position: "relative", display: "inline-block" }}>
            {doc.tipoArchivo === "PDF" ? (
              blob && (
                <Document file={blob} options={PDF_OPTIONS} onLoadError={() => setError("No se pudo cargar el PDF.")} loading={null}>
                  <Page
                    pageNumber={doc.paginaPDF ?? 1}
                    width={900}
                    devicePixelRatio={dprRender}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    onLoadSuccess={handlePaginaCargada}
                    onRenderSuccess={() => setRenderizandoPDF(false)}
                    onRenderError={() => setRenderizandoPDF(false)}
                  />
                </Document>
              )
            ) : (
              imgObjectUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imgObjectUrl} alt={doc.nombre} className="max-w-none select-none" onError={() => setError("No se pudo cargar la imagen.")} />
              )
            )}
            {/* Overlay de medición — mismo tamaño exacto que el documento
                (wrapper de arriba shrink-wrappea al contenido), viewBox
                0-100 = porcentaje del ancho/alto. Hereda el pan/zoom del
                padre automáticamente por ser hermano dentro de
                TransformComponent. */}
            <svg
              ref={svgRef}
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 w-full h-full"
              style={{ pointerEvents: herramienta != null ? "auto" : "none" }}
              onMouseDown={onSvgMouseDown}
              onMouseMove={onSvgMouseMove}
              onMouseLeave={onSvgMouseLeave}
              onClick={onSvgClick}
            >
              {/* Tres estados, tres colores, sin ambigüedad posible entre
                  "lo que ya guardé" y "lo que estoy dibujando ahora":
                  gris (#64748B) = trazo activo, todavía dibujando/sin
                  cerrar; ámbar (#F59E0B) = ya cerrado, esperando
                  confirmación en el modal; azul (#2563EB) = guardado en
                  la base, permanente. Antes el trazo activo también
                  usaba azul (solo distinguido por el punteado), lo que
                  generaba confusión con la medición recién guardada al
                  arrancar la siguiente. Grosores más finos (1.25 en vez
                  de 2) para más precisión visual sobre planos con
                  detalle fino. */}
              {mediciones.map((m) => {
                if (m.tipo === "AREA" && m.puntos && m.puntos.length >= 3) {
                  return (
                    <polygon
                      key={m.id}
                      points={m.puntos.map((p) => `${p.x},${p.y}`).join(" ")}
                      fill="#2563EB"
                      fillOpacity={0.12}
                      stroke="#2563EB"
                      strokeWidth={1.25}
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                }
                if (m.xInicio == null || m.yInicio == null || m.xFin == null || m.yFin == null) return null;
                return (
                  <line
                    key={m.id}
                    x1={m.xInicio}
                    y1={m.yInicio}
                    x2={m.xFin}
                    y2={m.yFin}
                    stroke="#2563EB"
                    strokeWidth={1.25}
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
              {/* Trazos guardados — clickeables para borrar (mismo criterio
                  que tenía Marca de referencia: click sobre el trazo +
                  confirmación), a diferencia de Línea/Área que se borran
                  desde el panel de la derecha. pointerEvents:"auto"
                  explícito en el <g> para que funcione sin importar si
                  hay una herramienta activa (el <svg> en sí solo recibe
                  clicks cuando hay una activa — ver style más arriba). La
                  franja invisible más ancha (strokeWidth 3) existe solo
                  para hacer más fácil clickear un trazo fino de 1.25px. */}
              {anotaciones.map((a) => {
                if (a.tipo !== "TRAZO" || !a.puntos || a.puntos.length < 2) return null;
                const puntosStr = a.puntos.map((p) => `${p.x},${p.y}`).join(" ");
                return (
                  <g
                    key={a.id}
                    style={{ pointerEvents: "auto", cursor: "pointer" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      eliminarAnotacionConConfirmacion(a);
                    }}
                  >
                    <title>Trazo — click para eliminar</title>
                    <polyline points={puntosStr} fill="none" stroke="transparent" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                    <polyline points={puntosStr} fill="none" stroke="#2563EB" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                  </g>
                );
              })}
              {dibujoActual && (
                <line
                  x1={dibujoActual.xInicio}
                  y1={dibujoActual.yInicio}
                  x2={dibujoActual.xActual}
                  y2={dibujoActual.yActual}
                  stroke="#64748B"
                  strokeWidth={1.25}
                  strokeDasharray="5,3"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              )}
              {puntosArea.length > 0 && (
                <>
                  <polyline
                    points={[...puntosArea, ...(cursorArea ? [cursorArea] : [])].map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="none"
                    stroke="#64748B"
                    strokeWidth={1.25}
                    strokeDasharray="5,3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                  {puntosArea.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r={0.25} fill="#64748B" stroke="white" strokeWidth={0.12} vectorEffect="non-scaling-stroke" />
                  ))}
                </>
              )}
              {trazoActual && trazoActual.length > 0 && (
                <polyline
                  points={trazoActual.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  stroke="#64748B"
                  strokeWidth={1.25}
                  strokeDasharray="5,3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              )}
              {trazoPendiente && (
                <polyline
                  points={trazoPendiente.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              )}
              {medicionPendiente?.tipo === "LINEA" && (
                <line
                  x1={medicionPendiente.xInicio}
                  y1={medicionPendiente.yInicio}
                  x2={medicionPendiente.xFin}
                  y2={medicionPendiente.yFin}
                  stroke="#F59E0B"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              )}
              {medicionPendiente?.tipo === "AREA" && (
                <polygon
                  points={medicionPendiente.puntos.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="#F59E0B"
                  fillOpacity={0.15}
                  stroke="#F59E0B"
                  strokeWidth={1.75}
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </svg>
            {/* Anotaciones TEXTO — capa HTML aparte (no dentro del <svg>)
                a propósito: el viewBox de arriba usa
                preserveAspectRatio="none", que estira todo de forma NO
                uniforme según el aspecto del documento — el texto
                quedaría deformado (letras más anchas o más altas de lo
                que corresponde). Posicionado por % (left/top), así que
                sigue el pan/zoom del documento igual que el resto (mismo
                wrapper escalado por TransformComponent), pero se
                renderiza y mide en el sistema de coordenadas HTML
                normal, sin distorsión — mismo criterio que tenía Marca
                de referencia. El contenedor tiene pointer-events:none
                para que los clicks en el resto del plano sigan llegando
                al <svg> de abajo; cada texto reactiva
                pointer-events:auto individualmente para poder
                clickearlo y borrarlo en cualquier momento, sin importar
                qué herramienta esté activa. */}
            <div className="absolute inset-0" style={{ pointerEvents: "none" }}>
              {anotaciones.map((a) => {
                if (a.tipo !== "TEXTO" || a.x == null || a.y == null || !a.texto) return null;
                return (
                  <button
                    key={a.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      eliminarAnotacionConConfirmacion(a);
                    }}
                    title={`"${a.texto}" — click para eliminar`}
                    style={{
                      left: `${a.x}%`,
                      top: `${a.y}%`,
                      pointerEvents: "auto",
                      fontSize: `${a.tamano ?? 16}px`,
                    }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 font-bold text-[#2563EB] whitespace-nowrap leading-none hover:text-[#1D4ED8] transition-colors"
                  >
                    {a.texto}
                  </button>
                );
              })}
              {textoPendientePunto && (
                <div
                  style={{ left: `${textoPendientePunto.x}%`, top: `${textoPendientePunto.y}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-amber-500/70 border-2 border-white shadow-md animate-pulse"
                />
              )}
            </div>
          </div>
        </TransformComponent>
      </TransformWrapper>
      {medicionPendiente && (
        <ModalConfirmarMedicion
          unidadLabel={medicionPendiente.tipo === "LINEA" ? "Longitud (m)" : "Área (m²)"}
          valorInicial={medicionPendiente.valor}
          onCancelar={() => setMedicionPendiente(null)}
          onGuardar={confirmarMedicion}
        />
      )}
      {textoPendientePunto && (
        <ModalNuevoTexto onCancelar={() => setTextoPendientePunto(null)} onGuardar={confirmarTexto} />
      )}
      {mediciones.length > 0 && (
        <div className="absolute bottom-4 right-4 z-10 w-64 max-h-52 overflow-y-auto bg-white rounded-[10px] border border-slate-200 shadow-md p-1.5 space-y-0.5">
          {mediciones.map((m) => (
            <div key={m.id} className="flex items-center gap-1.5 px-2 py-1.5 rounded-[6px] hover:bg-slate-50 transition-colors">
              {m.tipo === "AREA" ? (
                <Hexagon className="w-3 h-3 text-[#2563EB] flex-shrink-0" />
              ) : (
                <Slash className="w-3 h-3 text-[#2563EB] flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-600 truncate">{m.descripcion}</p>
                <p className="text-[10px] text-slate-400">
                  {m.tipo === "AREA" ? `${(m.areaReal ?? 0).toFixed(2)} m²` : `${(m.longitudReal ?? 0).toFixed(2)} m`} × {m.repeticiones}
                </p>
              </div>
              <button
                onClick={() => handleEliminarMedicion(m.id)}
                disabled={eliminandoMedicionIds.has(m.id)}
                title="Eliminar medición"
                className="flex-shrink-0 p-1 rounded-[6px] text-slate-300 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ── Ventana flotante — Foto/Detalle abierto desde la lista, overlay
// liviano encima del visor principal (que sigue fijo detrás). Movible
// (drag por el header), redimensionable (drag por la esquina inferior
// derecha) y cerrable, sin fondo oscuro de pantalla completa.
//
// Se renderiza vía portal a document.body con position:fixed — así queda
// SIEMPRE por encima de todo (Planilla incluida) sin importar hacia dónde
// se la arrastre. Antes era position:absolute dentro del visor principal,
// así que al arrastrarla sobre la Planilla (un hermano fuera de ese
// contenedor) quedaba tapada: la comparación de z-index solo aplica
// dentro de un mismo stacking context, y ese absolute no podía "escapar"
// del suyo. Con position:fixed las coordenadas son siempre relativas al
// viewport, no a ningún contenedor del Visor. ──────────────────────────

const VENTANA_ANCHO_MIN = 280;
const VENTANA_ALTO_MIN = 220;
const VENTANA_TAMANO_INICIAL = { width: 380, height: 420 };

function clamp(valor: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, valor));
}

function VentanaFlotante({
  doc,
  onClose,
}: {
  doc: DocumentoDetalle;
  onClose: () => void;
}) {
  const { cargando, blob, imgObjectUrl, error } = useArchivoBlob(doc);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [tamano, setTamano] = useState(VENTANA_TAMANO_INICIAL);

  // Reposiciona cerca de la esquina superior derecha de la ventana del
  // navegador cada vez que se abre un documento nuevo.
  useEffect(() => {
    setPos({ x: Math.max(16, window.innerWidth - VENTANA_TAMANO_INICIAL.width - 24), y: 96 });
    setTamano(VENTANA_TAMANO_INICIAL);
  }, [doc.id]);

  const iniciarArrastre = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!pos) return;
    const inicio = { x: e.clientX, y: e.clientY };
    const posInicial = pos;
    const onMove = (ev: MouseEvent) => {
      // Clamp liviano — evita que se pueda arrastrar tan lejos que se
      // pierda de vista por completo (sin header/botón cerrar alcanzable).
      setPos({
        x: clamp(posInicial.x + (ev.clientX - inicio.x), -tamano.width + 80, window.innerWidth - 80),
        y: clamp(posInicial.y + (ev.clientY - inicio.y), 0, window.innerHeight - 40),
      });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const iniciarRedimension = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const inicio = { x: e.clientX, y: e.clientY };
    const tamanoInicial = tamano;
    const onMove = (ev: MouseEvent) => {
      setTamano({
        width: clamp(tamanoInicial.width + (ev.clientX - inicio.x), VENTANA_ANCHO_MIN, window.innerWidth - 32),
        height: clamp(tamanoInicial.height + (ev.clientY - inicio.y), VENTANA_ALTO_MIN, window.innerHeight - 32),
      });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  if (!pos) return null;

  return createPortal(
    <div
      className="fixed z-[100] bg-white rounded-[12px] border border-slate-300 shadow-xl flex flex-col overflow-hidden"
      style={{ left: pos.x, top: pos.y, width: tamano.width, height: tamano.height }}
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
      <div className="flex-1 min-h-0 relative bg-slate-100 overflow-auto flex items-center justify-center p-2">
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
                <Page pageNumber={doc.paginaPDF ?? 1} width={Math.max(160, tamano.width - 32)} renderTextLayer={false} renderAnnotationLayer={false} />
              </Document>
            )}
          </>
        )}
      </div>
      {/* Esquina de redimensionar */}
      <div
        onMouseDown={iniciarRedimension}
        title="Arrastrar para redimensionar"
        className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize flex items-end justify-end p-0.5 text-slate-300 hover:text-slate-500 transition-colors"
      >
        <svg viewBox="0 0 10 10" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
          <path d="M9 1L1 9M9 5L5 9M9 9L9 9" />
        </svg>
      </div>
    </div>,
    document.body
  );
}

// ── Lista de todos los documentos (las 3 categorías juntas) ────────────

function ListaDocumentos({
  documentos,
  documentoPrincipalId,
  onSeleccionar,
  onEliminar,
  eliminandoIds,
}: {
  documentos: DocumentoResumen[];
  documentoPrincipalId: string;
  onSeleccionar: (doc: DocumentoResumen) => void;
  onEliminar: (doc: DocumentoResumen) => void;
  eliminandoIds: Set<string>;
}) {
  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-1">
      {documentos.map((doc) => {
        const Icono = iconoPorTipo(doc.tipoArchivo);
        const activo = doc.id === documentoPrincipalId;
        const seEliminando = eliminandoIds.has(doc.id);
        return (
          <div
            key={doc.id}
            className={cn(
              "flex items-center gap-0.5 rounded-[8px] transition-colors",
              activo ? "bg-blue-50" : "hover:bg-slate-100",
              seEliminando && "opacity-40 pointer-events-none"
            )}
          >
            <button
              onClick={() => onSeleccionar(doc)}
              className={cn(
                "flex-1 min-w-0 flex items-center gap-2 px-2.5 py-2 text-left",
                activo ? "text-[#2563EB]" : "text-slate-600"
              )}
            >
              <Icono className={cn("w-3.5 h-3.5 flex-shrink-0", activo ? "text-[#2563EB]" : "text-slate-400")} />
              <span className="flex-1 min-w-0 text-xs font-medium truncate">{doc.nombre}</span>
            </button>
            <button
              onClick={() => onEliminar(doc)}
              title="Eliminar"
              className="flex-shrink-0 p-1.5 mr-1.5 rounded-[6px] text-slate-300 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
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
  onEliminarDocumento,
  eliminandoIds,
  ventanaFlotante,
  onCerrarVentanaFlotante,
  onClose,
  expandido,
  onToggleExpandir,
  notas,
  onGuardarNotas,
  imagenesParaIA,
  onAnalizarConIA,
  onGuardarCalibracion,
  mediciones,
  onGuardarMedicion,
  onEliminarMedicion,
  anotaciones,
  onGuardarAnotacion,
  onEliminarAnotacion,
  style,
}: {
  /** null cuando el usuario entra al Visor sin tener ningún documento
   * cargado todavía — se muestra un estado vacío, pero el resto del
   * Visor (lista, Notas) sigue disponible igual. */
  documentoPrincipal: DocumentoDetalle | null;
  todosLosDocumentos: DocumentoResumen[];
  onSeleccionarDocumento: (doc: DocumentoResumen) => void;
  /** Eliminar un documento directo desde la lista del visor — la página
   * que lo llama es responsable de limpiar documentoPrincipal/
   * ventanaFlotante si el documento eliminado era el que estaba abierto. */
  onEliminarDocumento: (doc: DocumentoResumen) => void;
  eliminandoIds: Set<string>;
  ventanaFlotante: DocumentoDetalle | null;
  onCerrarVentanaFlotante: () => void;
  onClose: () => void;
  expandido: boolean;
  onToggleExpandir: () => void;
  notas: string;
  onGuardarNotas: (notas: string) => Promise<void> | void;
  imagenesParaIA: string[];
  onAnalizarConIA: (imagenes: string[], contexto: string | null) => Promise<void> | void;
  /** Guarda la calibración de escala (Etapa 2 de "Metrajes con plano") del
   * documento principal — solo se llama/muestra cuando es categoria=PLANO. */
  onGuardarCalibracion: (escalaDeclarada: string, factorEscala: number) => Promise<void>;
  /** Marcas de medición ya persistidas del documento principal (se
   * recargan al abrir el documento) — se dibujan sobre el plano. */
  mediciones: MedicionDocumento[];
  /** Guarda una nueva marca de medición (Etapa 3, Línea o Área) del
   * documento principal — solo se llama/muestra cuando es
   * categoria=PLANO && tipoArchivo=PDF && ya calibrado. Sin rubro —
   * se asigna después en la Planilla. */
  onGuardarMedicion: (input: NuevaMedicionInput) => Promise<void>;
  /** Borra una marca de medición ya guardada — también saca la fila que
   * había generado en la Planilla. */
  onEliminarMedicion: (medicionId: string) => Promise<void>;
  /** Anotaciones (Trazo libre / Texto — no son medición) ya persistidas
   * del documento principal — se dibujan sobre el plano. */
  anotaciones: Anotacion[];
  /** Guarda una nueva anotación — sin rubro, sin fila en la Planilla,
   * solo se llama/muestra cuando es categoria=PLANO (no requiere
   * calibración, a diferencia de Línea/Área). */
  onGuardarAnotacion: (input: NuevaAnotacionInput) => Promise<void>;
  onEliminarAnotacion: (anotacionId: string) => Promise<void>;
  style?: React.CSSProperties;
}) {
  const [notasLocal, setNotasLocal] = useState(notas);
  const [guardandoNotas, setGuardandoNotas] = useState(false);
  useEffect(() => setNotasLocal(notas), [notas]);

  const [controlesZoom, setControlesZoom] = useState<ControlesZoom | null>(null);
  const [controlesMedicion, setControlesMedicion] = useState<ControlesMedicion | null>(null);
  const puedeActivarMedicion = documentoPrincipal?.tipoArchivo === "PDF" && !!controlesMedicion?.pageDimsListo;

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
      className="fixed inset-0 z-50 bg-white flex flex-col lg:static lg:inset-auto lg:z-auto lg:h-full lg:flex-shrink-0 lg:border lg:border-slate-300 lg:rounded-[16px] lg:shadow-sm overflow-hidden"
      style={style}
    >
      {/* Título */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-white border-b border-slate-200 flex-shrink-0">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-[#1A3A5C] truncate">{documentoPrincipal?.nombre ?? "Visor"}</h2>
          <p className="text-xs text-slate-400 truncate">
            {documentoPrincipal
              ? `${documentoPrincipal.nombreArchivoOriginal}${documentoPrincipal.tipoArchivo === "PDF" && documentoPrincipal.paginaPDF ? ` · página ${documentoPrincipal.paginaPDF}` : ""}`
              : "Sin documento seleccionado"}
          </p>
        </div>
      </div>

      {/* FILA 1 — estado de calibración */}
      {documentoPrincipal?.categoria === "PLANO" && (
        <FilaCalibracion doc={documentoPrincipal} onGuardarCalibracion={onGuardarCalibracion} />
      )}

      {/* FILA 2 — barra de herramientas única: zoom | expandir | medición | cerrar */}
      <div className="flex items-center gap-1 px-4 py-2 bg-white border-b border-slate-200 flex-shrink-0 flex-wrap">
        {controlesZoom && (
          <>
            <button onClick={controlesZoom.zoomOut} title="Alejar" className="p-1.5 rounded-[6px] bg-brand-pale text-brand-deep hover:bg-brand-muted transition-colors">
              <ZoomOut className="w-4 h-4" />
            </button>
            <button onClick={controlesZoom.zoomIn} title="Acercar" className="p-1.5 rounded-[6px] bg-brand-pale text-brand-deep hover:bg-brand-muted transition-colors">
              <ZoomIn className="w-4 h-4" />
            </button>
            <button onClick={controlesZoom.resetTransform} title="Ajustar a vista" className="p-1.5 rounded-[6px] bg-brand-pale text-brand-deep hover:bg-brand-muted transition-colors">
              <Maximize2 className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-slate-200 mx-1" />
          </>
        )}
        <button
          onClick={onToggleExpandir}
          title={expandido ? "Volver a vista de 3 columnas" : "Expandir visor a pantalla completa"}
          className="p-1.5 rounded-[6px] bg-brand-pale text-brand-deep hover:bg-brand-muted transition-colors"
        >
          {expandido ? <Shrink className="w-4 h-4" /> : <Expand className="w-4 h-4" />}
        </button>
        {documentoPrincipal?.categoria === "PLANO" && documentoPrincipal.factorEscala != null && (
          <>
            <div className="w-px h-4 bg-slate-200 mx-1" />
            {/* Herramientas de medición — Línea y Área hoy; deja lugar en
                este mismo grupo para Punto cuando se implemente (Etapa 3,
                ronda futura). */}
            <button
              onClick={controlesMedicion?.onToggleLinea}
              disabled={!puedeActivarMedicion}
              title={
                documentoPrincipal.tipoArchivo !== "PDF"
                  ? "Medición disponible solo para planos en PDF por ahora — para fotos hace falta calibrar por cota (próxima ronda)"
                  : controlesMedicion?.herramienta === "LINEA"
                  ? "Midiendo — clic y arrastre para dibujar una línea"
                  : "Medir una distancia trazando una línea sobre el plano"
              }
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] border text-xs font-semibold transition-colors",
                !puedeActivarMedicion
                  ? "border-transparent bg-slate-100 text-slate-400 cursor-not-allowed"
                  : controlesMedicion?.herramienta === "LINEA"
                  ? "border-brand-light bg-brand-light text-white"
                  : "border-brand-muted bg-brand-pale text-brand-deep hover:bg-brand-muted hover:border-brand-light"
              )}
            >
              <Ruler className="w-3.5 h-3.5" /> {controlesMedicion?.herramienta === "LINEA" ? "Midiendo…" : "Medir"}
            </button>
            <button
              onClick={controlesMedicion?.onToggleArea}
              disabled={!puedeActivarMedicion}
              title={
                documentoPrincipal.tipoArchivo !== "PDF"
                  ? "Medición disponible solo para planos en PDF por ahora — para fotos hace falta calibrar por cota (próxima ronda)"
                  : controlesMedicion?.herramienta !== "AREA"
                  ? "Medir una superficie dibujando un polígono sobre el plano — clic para cada vértice"
                  : controlesMedicion.puntosAreaCount < 3
                  ? "Agregá al menos 3 vértices — clic en el plano (volvé a clickear acá para cancelar)"
                  : "Cerrar el polígono y calcular el área"
              }
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] border text-xs font-semibold transition-colors",
                !puedeActivarMedicion
                  ? "border-transparent bg-slate-100 text-slate-400 cursor-not-allowed"
                  : controlesMedicion?.herramienta === "AREA"
                  ? "border-brand-light bg-brand-light text-white"
                  : "border-brand-muted bg-brand-pale text-brand-deep hover:bg-brand-muted hover:border-brand-light"
              )}
            >
              <Hexagon className="w-3.5 h-3.5" />
              {controlesMedicion?.herramienta === "AREA"
                ? controlesMedicion.puntosAreaCount >= 3
                  ? `Finalizar (${controlesMedicion.puntosAreaCount})`
                  : `Dibujando… (${controlesMedicion.puntosAreaCount})`
                : "Área"}
            </button>
          </>
        )}
        {documentoPrincipal?.categoria === "PLANO" && (
          <>
            <div className="w-px h-4 bg-slate-200 mx-1" />
            {/* Trazo libre y Texto — herramientas de ANOTACIÓN, no de
                medición: a diferencia de Línea/Área no requieren
                calibración (no miden nada), así que su gate es solo
                categoria=PLANO, independiente de factorEscala. */}
            <button
              onClick={controlesMedicion?.onToggleTrazo}
              disabled={!controlesMedicion}
              title={
                controlesMedicion?.trazoActivo
                  ? "Dibujando — clic y arrastre para trazar a mano alzada"
                  : "Trazo libre — dibujá a mano alzada sobre el plano (flecha, círculo, subrayado, etc.)"
              }
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] border text-xs font-semibold transition-colors",
                !controlesMedicion
                  ? "border-transparent bg-slate-100 text-slate-400 cursor-not-allowed"
                  : controlesMedicion.trazoActivo
                  ? "border-brand-light bg-brand-light text-white"
                  : "border-brand-muted bg-brand-pale text-brand-deep hover:bg-brand-muted hover:border-brand-light"
              )}
            >
              <Pencil className="w-3.5 h-3.5" /> {controlesMedicion?.trazoActivo ? "Dibujando…" : "Trazo libre"}
            </button>
            <button
              onClick={controlesMedicion?.onToggleTexto}
              disabled={!controlesMedicion}
              title={
                controlesMedicion?.textoActivo
                  ? "Poniendo texto — clic en el plano"
                  : "Texto — dejá una letra o palabra en un punto del plano, con tamaño ajustable"
              }
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] border text-xs font-semibold transition-colors",
                !controlesMedicion
                  ? "border-transparent bg-slate-100 text-slate-400 cursor-not-allowed"
                  : controlesMedicion.textoActivo
                  ? "border-brand-light bg-brand-light text-white"
                  : "border-brand-muted bg-brand-pale text-brand-deep hover:bg-brand-muted hover:border-brand-light"
              )}
            >
              <TypeIcon className="w-3.5 h-3.5" /> {controlesMedicion?.textoActivo ? "Marcando…" : "Texto"}
            </button>
          </>
        )}
        <div className="flex-1" />
        <div className="w-px h-4 bg-slate-200 mx-1" />
        <button onClick={onClose} title="Cerrar" className="p-1.5 rounded-[6px] text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Documento principal + lista */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <div className="flex-1 min-w-0 flex flex-col bg-slate-100">
          <div className="flex-1 min-h-0 relative">
            {documentoPrincipal ? (
              <VisorPrincipal
                key={documentoPrincipal.id}
                doc={documentoPrincipal}
                mediciones={mediciones}
                anotaciones={anotaciones}
                onGuardarMedicion={onGuardarMedicion}
                onEliminarMedicion={onEliminarMedicion}
                onGuardarAnotacion={onGuardarAnotacion}
                onEliminarAnotacion={onEliminarAnotacion}
                onControlesZoomListos={setControlesZoom}
                onControlesMedicionListos={setControlesMedicion}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6">
                <FileGenerico className="w-10 h-10 text-slate-300" />
                <p className="text-sm text-slate-500 max-w-xs">
                  Todavía no hay ningún documento — subí uno desde &quot;Documentación para metrar&quot;.
                </p>
              </div>
            )}
            {ventanaFlotante && <VentanaFlotante doc={ventanaFlotante} onClose={onCerrarVentanaFlotante} />}
          </div>
        </div>

        {!expandido && (
          <div className="w-full lg:w-[240px] flex-shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col bg-white max-h-[220px] lg:max-h-none">
            <div className="px-3 pt-3 pb-1.5 flex-shrink-0">
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Documentos</h3>
            </div>
            <ListaDocumentos
              documentos={todosLosDocumentos}
              documentoPrincipalId={documentoPrincipal?.id ?? ""}
              onSeleccionar={onSeleccionarDocumento}
              eliminandoIds={eliminandoIds}
              onEliminar={(doc) => {
                if (confirm(`¿Eliminar "${doc.nombre}"?`)) onEliminarDocumento(doc);
              }}
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
