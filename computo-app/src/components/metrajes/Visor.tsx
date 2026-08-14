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
  Hexagon,
  Pencil,
  Slash,
  Type as TypeIcon,
  Info,
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
  | { tipo: "TRAZO"; puntos: { x: number; y: number }[]; color: string }
  | { tipo: "RECTA"; puntos: [{ x: number; y: number }, { x: number; y: number }]; color: string }
  | { tipo: "TEXTO"; x: number; y: number; texto: string; tamano: number };

export type CambiosAnotacion = { x?: number; y?: number; tamano?: number };

// Paleta cerrada de colores para Trazo libre — 6 opciones alcanzan
// para diferenciar visualmente sin la complejidad de un color picker
// completo. Misma lista (mismos hex) que COLORES_TRAZO_VALIDOS en la
// ruta API — si se agrega un color acá hay que agregarlo ahí también.
const COLORES_TRAZO = [
  { nombre: "Azul", valor: "#2563EB" },
  { nombre: "Rojo", valor: "#DC2626" },
  { nombre: "Verde", valor: "#16A34A" },
  { nombre: "Negro", valor: "#1E293B" },
  { nombre: "Naranja", valor: "#F97316" },
  { nombre: "Violeta", valor: "#7C3AED" },
] as const;

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

// Convierte el path crudo de Trazo libre (puntos capturados en
// mousemove) en un <path> suave — spline Catmull-Rom pasada a curvas
// Bézier cúbicas (tensión 1/6, la conversión estándar). Sin esto, el
// trazo se ve como una sucesión de segmentos rectos angulosos (un
// polígono, no un dibujo a mano) porque <polyline> solo sabe unir
// puntos con líneas rectas — la curva no agrega puntos nuevos, solo
// interpola una curva suave que PASA por los mismos puntos capturados.
// Catmull-Rom CENTRÍPETA (alpha=0.5), no uniforme. La primera versión
// (tension fija 1/6, "uniforme") asume que los puntos están más o
// menos parejo espaciados — en una prueba automatizada con puntos
// generados a mano eso era cierto y se veía bien, pero un trazo real
// con mouse NO tiene espaciado uniforme (la mano acelera y frena todo
// el tiempo). Con espaciado irregular, la variante uniforme genera
// sobrepasos/loops visibles en las curvas — exactamente el "cortado"
// que reportó el usuario pese al suavizado. La parametrización
// centrípeta usa la distancia real entre puntos (raíz cuadrada de la
// distancia, de ahí "centrípeta") para las tangentes, lo que la hace
// robusta a espaciado desparejo — es el estándar para suavizar trazos
// de mouse/lápiz óptico. Fuente: Catmull-Rom-a-Bézier no uniforme,
// misma familia de fórmulas que usan la mayoría de los editores
// vectoriales para "freehand smoothing".
// Ventana del promedio móvil (puntos a cada lado) y tensión de la
// curva — ver comentario completo en puntosASuavePath más abajo.
const SUAVIZADO_VENTANA = 2;
const SUAVIZADO_TENSION = 0.8;

// Promedio móvil sobre los puntos CRUDOS, antes de interpolar. Por qué
// hace falta además de Catmull-Rom centrípeta (que ya soluciona el
// problema de espaciado irregular): un mouse real nunca entrega una
// posición perfectamente limpia — hay ruido/jitter de un par de
// centésimas todo el tiempo, más el temblor natural de la mano. Una
// curva que INTERPOLA (pasa exacto por cada punto) se ve obligada a
// desviarse para tocar cada micro-ruido, y esas correcciones
// constantes de rumbo son justamente lo que se percibe como "cortado"
// aunque la curva sea matemáticamente suave. Promediar cada punto con
// sus vecinos antes de interpolar borra ese ruido de alta frecuencia
// sin perder la forma real del trazo. El primer y último punto NO se
// promedian — así el trazo sigue empezando/terminando exacto donde el
// usuario apretó/soltó el mouse.
function promedioMovil(puntos: { x: number; y: number }[], ventana: number): { x: number; y: number }[] {
  if (puntos.length <= 2) return puntos;
  const resultado = puntos.map((_, i) => {
    let sx = 0, sy = 0, n = 0;
    for (let k = -ventana; k <= ventana; k++) {
      const idx = i + k;
      if (idx >= 0 && idx < puntos.length) {
        sx += puntos[idx].x;
        sy += puntos[idx].y;
        n++;
      }
    }
    return { x: sx / n, y: sy / n };
  });
  resultado[0] = puntos[0];
  resultado[resultado.length - 1] = puntos[puntos.length - 1];
  return resultado;
}

// Catmull-Rom CENTRÍPETA (alpha=0.5, no uniforme) sobre los puntos ya
// pre-suavizados por promedioMovil — la parametrización centrípeta
// (distancia real entre puntos, no un paso fijo) es lo que la hace
// robusta al espaciado desparejo de un trazo real; el promedio móvil
// de arriba es lo que le saca el ruido antes de interpolar. Fuente:
// Catmull-Rom-a-Bézier no uniforme, misma familia de fórmulas que usan
// la mayoría de los editores vectoriales para "freehand smoothing".
// SUAVIZADO_TENSION < 1 acorta un poco las tangentes de la curva
// (menos "tirón" hacia cada punto de control) para una interpolación
// más generosa/redondeada, con menos margen para sobrepasos visibles.
function puntosASuavePath(puntosCrudos: { x: number; y: number }[]): string {
  if (puntosCrudos.length < 2) return "";
  const puntos = promedioMovil(puntosCrudos, SUAVIZADO_VENTANA);
  if (puntos.length === 2) {
    return `M ${puntos[0].x},${puntos[0].y} L ${puntos[1].x},${puntos[1].y}`;
  }
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.max(Math.hypot(b.x - a.x, b.y - a.y), 0.0001);
  let d = `M ${puntos[0].x},${puntos[0].y}`;
  for (let i = 0; i < puntos.length - 1; i++) {
    const p0 = puntos[i - 1] ?? puntos[i];
    const p1 = puntos[i];
    const p2 = puntos[i + 1];
    const p3 = puntos[i + 2] ?? p2;

    const t0 = 0;
    const t1 = t0 + Math.sqrt(dist(p0, p1));
    const t2 = t1 + Math.sqrt(dist(p1, p2));
    const t3 = t2 + Math.sqrt(dist(p2, p3));

    const c1x = p1.x + (SUAVIZADO_TENSION * (p2.x - p0.x) * (t2 - t1)) / (3 * (t2 - t0));
    const c1y = p1.y + (SUAVIZADO_TENSION * (p2.y - p0.y) * (t2 - t1)) / (3 * (t2 - t0));
    const c2x = p2.x - (SUAVIZADO_TENSION * (p3.x - p1.x) * (t2 - t1)) / (3 * (t3 - t1));
    const c2y = p2.y - (SUAVIZADO_TENSION * (p3.y - p1.y) * (t2 - t1)) / (3 * (t3 - t1));

    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
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

// Modal de la herramienta de Texto — SOLO pide el texto (letra o
// palabra); el tamaño ya NO se ajusta acá. Antes tenía un stepper +/-
// con una vista previa aislada dentro del modal, sin relación real con
// el plano/zoom — el usuario reportó que hasta el tamaño "mínimo" del
// modal quedaba enorme una vez puesto en el plano real, sin ninguna
// referencia confiable mientras lo ajustaba. Ahora, al confirmar acá,
// el texto se guarda directo con un tamaño default (ver crearTexto en
// VisorPrincipal) y el tamaño se ajusta DESPUÉS arrastrando su propio
// handle en el plano — mismo patrón que la ventana flotante de fotos/
// detalles — viendo el resultado real en contexto.
// Mínimo bajado a 4 (desde 8) — el usuario quiere poder achicar el
// texto hasta integrarse a la escala real de las cotas/etiquetas ya
// impresas en el plano, que suelen ser bastante más chicas que 8px a
// como se renderiza el documento acá. El tamaño inicial también baja
// un poco (10, antes 14) para arrancar más cerca de esa escala.
const TEXTO_TAMANO_MIN = 4;
const TEXTO_TAMANO_MAX = 64;
const TEXTO_TAMANO_INICIAL = 10;

function ModalNuevoTexto({
  onCancelar,
  onContinuar,
}: {
  onCancelar: () => void;
  onContinuar: (texto: string) => void;
}) {
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);

  const continuar = () => {
    if (!texto.trim()) {
      setError("Escribí un texto.");
      return;
    }
    if (texto.trim().length > 200) {
      setError("Máximo 200 caracteres.");
      return;
    }
    onContinuar(texto.trim());
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
        <div className="px-5 py-4 space-y-2">
          <label className="block text-sm font-semibold text-[#1A3A5C]">Texto</label>
          <input
            type="text"
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && continuar()}
            placeholder="Ej. A, Ver detalle 3, Revisar nivel"
            maxLength={200}
            autoFocus
            className="w-full px-3 py-2 rounded-[10px] border border-slate-300 bg-[#F8FAFC] text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
          />
          {error ? (
            <p className="text-xs text-red-600">{error}</p>
          ) : (
            <p className="text-xs text-slate-400">
              Una vez puesto, arrastrá la esquina inferior derecha del texto (cursor de flechas) para cambiarle el tamaño directo sobre el plano.
            </p>
          )}
        </div>
        <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={onCancelar}
            className="px-4 py-2 rounded-[8px] text-sm font-medium text-slate-500 hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={continuar}
            className="px-4 py-2 rounded-[8px] text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] transition-colors"
          >
            Continuar
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
// en cada frame de un pinch/wheel — page.render() no es gratis.
//
// Tope duro en dpr efectivo — DISTINTO por dispositivo (ver esMobile más
// abajo, en VisorPrincipal): 6 en desktop (empareja maxScale={6} del
// TransformWrapper — a zoom máximo el canvas queda 1:1 con la pantalla,
// nítido de verdad, ~165MB pico entre canvas real+congelado, margen de
// sobra en desktop) vs. 4 en mobile (sin cambios — el límite de área de
// canvas de Safari/iOS ronda los 4096×4096px, y 6 ya lo supera; 4 se
// queda cómodo debajo). Antes era un único 4 para todos, que dejaba el
// tramo de zoom 4-6 cada vez más borroso cuanto más cerca del máximo —
// confirmado con el historial completo de este archivo que ese desajuste
// (maxScale=6 vs DPR_MAXIMO=4) estuvo así desde el commit que introdujo
// la nitidez dinámica, nunca estuvieron sincronizados.
//
// "Queda en blanco" al re-renderizar: confirmado leyendo
// node_modules/react-pdf/src/Page/Canvas.tsx — cuando cambia
// devicePixelRatio, react-pdf hace `canvas.width = ...` /
// `canvas.height = ...` sobre el MISMO <canvas>, lo cual por spec del
// navegador borra el contenido ya dibujado al instante (no es algo que
// react-pdf elige, es cómo funciona <canvas> al cambiar su resolución
// interna) — y de paso pone `canvas.style.visibility = "hidden"`
// mientras corre `page.render()`, a propósito, para no mostrar un
// frame a medio dibujar. Evitar el blanco sin recurrir a DOS <Page> en
// paralelo (una vieja, una nueva, swap al terminar — el doble de carga
// de render por cada cambio de nitidez): justo antes de disparar el
// cambio de devicePixelRatio, se copia el contenido actual del canvas
// real a un <canvas> "congelado" del mismo tamaño (drawImage, no
// toDataURL — no hace falta codificar nada, solo una copia de píxeles)
// y se lo muestra superpuesto mientras dura el re-render. Se ve
// pixelado un instante (es una copia de la resolución VIEJA, estirada
// al nuevo zoom) pero sigue siendo el plano, no una pantalla en blanco
// — ver canvasRef/canvasCongeladoRef y congelarCanvasActual().
const DPR_MAXIMO_DESKTOP = 6;
const DPR_MAXIMO_MOBILE = 4;

// Píldora de herramienta de la barra FILA 2 (Medir/Área/Trazo/Recta/
// Texto/Descargar PDF) — un solo lugar para las tres variantes en vez de
// repetir el mismo condicional largo en cada botón. Deshabilitada: gris
// plano, sin borde. Inactiva: píldora neutra (blanco + borde sutil),
// mismo lenguaje que "Cambiar escala"/"Exportar Excel" en el resto de
// la app — no el azul pálido de antes, que hacía que todos los botones
// (prendidos o no) pesaran igual. Activa: azul sólido #2563EB (el mismo
// accent que "Aplicar al presupuesto" y el resto de los CTA primarios
// de la plataforma, no el brand-light más clavado que tenía esta barra
// antes) — para que se identifique de un vistazo cuál está prendida.
function clasePildoraHerramienta(activa: boolean, habilitada: boolean): string {
  if (!habilitada) return "flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] border border-transparent bg-slate-100 text-slate-400 text-xs font-semibold cursor-not-allowed";
  if (activa) return "flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] border border-[#2563EB] bg-[#2563EB] text-white text-xs font-semibold transition-colors";
  return "flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] border border-slate-300 bg-white text-slate-600 text-xs font-semibold hover:bg-slate-50 hover:border-slate-400 transition-colors";
}

// Techo en 6 (antes 4) para emparejar maxScale={6} del TransformWrapper —
// en desktop (DPR_MAXIMO_DESKTOP=6) esto es lo que permite llegar a
// nitidez 1:1 real a zoom máximo. En mobile (DPR_MAXIMO_MOBILE=4) el
// Math.min(...) de dprRender lo recorta de vuelta a 4 igual que antes —
// esta función no necesita saber de dispositivo, el tope por dispositivo
// ya lo aplica dprRender más abajo.
function multiplicadorParaEscala(scale: number): number {
  if (scale <= 1.3) return 1;
  if (scale <= 2.5) return 2;
  if (scale <= 4) return 3;
  if (scale <= 5) return 5;
  return 6;
}

// ── Visor principal — documento fijo y grande, con zoom/pan ────────────

export interface ControlesZoom {
  zoomIn: () => void;
  zoomOut: () => void;
  resetTransform: () => void;
  /** Nodo DOM del wrapper de react-zoom-pan-pinch (overflow:hidden) — el
   * límite real de "lo que se ve" con el zoom/pan actual, sin el resto
   * del contenido que quede fuera de vista. Usado por "Descargar PDF"
   * para capturar exactamente el viewport visible, no el documento
   * completo. null si el documento no tiene TransformWrapper montado
   * (categoria DWG, sin vista previa). */
  obtenerContenedorCaptura: () => HTMLElement | null;
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
  rectaActiva: boolean;
  onToggleRecta: () => void;
  textoActivo: boolean;
  onToggleTexto: () => void;
  /** Modo "medir ANCHO hacia una fila existente" (ver ícono de regla en
   * PlanillaComputo.tsx) — no null mientras dura: fuerza herramienta a
   * LINEA, deshabilita el resto, y el próximo trazo confirmado no crea
   * una fila nueva, completa el ANCHO de esta. ESC lo cancela igual que
   * cualquier otra herramienta (ver cancelarHerramienta). */
  medicionObjetivo: { filaId: string; descripcion: string } | null;
  onIniciarAsignacionAncho: (filaId: string, descripcion: string) => void;
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
  onAsignarAncho,
  onEliminarMedicion,
  onGuardarAnotacion,
  onEliminarAnotacion,
  onActualizarAnotacion,
  onControlesZoomListos,
  onControlesMedicionListos,
}: {
  doc: DocumentoDetalle;
  mediciones: MedicionDocumento[];
  anotaciones: Anotacion[];
  onGuardarMedicion: (input: NuevaMedicionInput) => Promise<void>;
  /** Modo asignación (ver ControlesMedicion.medicionObjetivo) — el trazo
   * de Línea recién confirmado no crea una fila, completa el ANCHO de
   * filaId. */
  onAsignarAncho: (filaId: string, input: NuevaMedicionInput) => Promise<void>;
  /** Borra una marca de medición ya guardada (corrección de un trazo mal
   * hecho) — también saca la fila que había generado en la Planilla. */
  onEliminarMedicion: (medicionId: string) => Promise<void>;
  onGuardarAnotacion: (input: NuevaAnotacionInput) => Promise<void>;
  onEliminarAnotacion: (anotacionId: string) => Promise<void>;
  /** Mueve y/o redimensiona un Texto ya guardado — arrastrar el texto o
   * su handle de tamaño directo sobre el plano. Optimista + revert en
   * el padre (page.tsx) si el PATCH falla; acá no hace falta manejar
   * error explícito. Solo aplica a TEXTO, Trazo libre no se edita así. */
  onActualizarAnotacion: (anotacionId: string, cambios: CambiosAnotacion) => void;
  /** Expone zoomIn/zoomOut/resetTransform del TransformWrapper hacia el
   * header del Visor (fuera de este árbol) — los botones de zoom viven
   * ahí, junto a expandir/cerrar, en vez de flotando sobre el documento. */
  onControlesZoomListos: (controles: ControlesZoom | null) => void;
  /** Expone el estado de las herramientas de medición hacia FILA 2 del
   * Visor (fuera de este árbol). */
  onControlesMedicionListos: (controles: ControlesMedicion | null) => void;
}) {
  const { cargando, progreso, blob, imgObjectUrl, error, setError } = useArchivoBlob(doc);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const transformRef = useRef<ReactZoomPanPinchRef | null>(null);
  // canvasRef = el canvas real que dibuja react-pdf; canvasCongeladoRef =
  // la copia que se muestra encima mientras el real se re-renderiza más
  // nítido (ver congelarCanvasActual y el comentario grande de arriba).
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasCongeladoRef = useRef<HTMLCanvasElement | null>(null);
  const [multiplicadorDPR, setMultiplicadorDPR] = useState(1);
  // Decide qué tope de nitidez aplica (DPR_MAXIMO_DESKTOP vs. _MOBILE, ver
  // comentario grande arriba) — mismo criterio de breakpoint (768px, el
  // "md" de Tailwind) que ya usa el resto de la app para mobile/desktop,
  // pero no había ningún lugar en JS que lo leyera todavía (todo el
  // responsive existente es CSS puro). Lazy init + sin listener de resize
  // a propósito: el tope de nitidez no necesita reaccionar en vivo si la
  // ventana cambia de tamaño, alcanza con el valor al montar el Visor.
  const [esMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  // true durante la ventana entre "el escalón de nitidez subió" y "el
  // canvas terminó de redibujarse" — ver comentario en DPR_MAXIMO.
  const [renderizandoPDF, setRenderizandoPDF] = useState(false);
  // Copia los píxeles del canvas real al canvas congelado, en el mismo
  // tick en que se decide subir la nitidez — todavía tiene el contenido
  // VIEJO en ese momento (react-pdf recién lo va a limpiar/redibujar en
  // un efecto posterior). width===0 → todavía no renderizó nada, no hay
  // nada que copiar (primer render del documento).
  const congelarCanvasActual = () => {
    const origen = canvasRef.current;
    const destino = canvasCongeladoRef.current;
    if (!origen || !destino || origen.width === 0) return;
    destino.width = origen.width;
    destino.height = origen.height;
    destino.getContext("2d")?.drawImage(origen, 0, 0);
  };
  const actualizarDPRSegunZoom = (ref: ReactZoomPanPinchRef) => {
    const nuevoMultiplicador = multiplicadorParaEscala(ref.state.scale);
    if (nuevoMultiplicador !== multiplicadorDPR) {
      congelarCanvasActual();
      setRenderizandoPDF(true);
    }
    setMultiplicadorDPR(nuevoMultiplicador);
  };
  const dprRender = Math.min(
    (typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1) * multiplicadorDPR,
    esMobile ? DPR_MAXIMO_MOBILE : DPR_MAXIMO_DESKTOP
  );
  const [pageDimsMM, setPageDimsMM] = useState<{ width: number; height: number } | null>(null);
  const [herramienta, setHerramienta] = useState<"LINEA" | "AREA" | "TRAZO" | "RECTA" | "TEXTO" | null>(null);
  const [dibujoActual, setDibujoActual] = useState<{ xInicio: number; yInicio: number; xActual: number; yActual: number } | null>(null);
  const [puntosArea, setPuntosArea] = useState<{ x: number; y: number }[]>([]);
  const [cursorArea, setCursorArea] = useState<{ x: number; y: number } | null>(null);
  const [medicionPendiente, setMedicionPendiente] = useState<MedicionPendiente | null>(null);
  // Modo "medir ANCHO hacia una fila existente" — ver ControlesMedicion.
  // No null mientras dura: el próximo trazo de Línea confirmado no pasa
  // por medicionPendiente/el modal, se guarda directo contra filaId
  // (ver finalizarDibujoLinea/asignarAnchoDesdeDrag).
  const [medicionObjetivo, setMedicionObjetivo] = useState<{ filaId: string; descripcion: string } | null>(null);
  // Trazo libre — path en curso (mientras se arrastra) y path ya
  // terminado que se intenta guardar automáticamente al soltar el mouse
  // (sin modal — no hay ningún dato que pedirle al usuario). Si el
  // guardado falla, trazoPendiente se mantiene (banner de error con
  // Reintentar/Cancelar más abajo) en vez de perderse.
  const [trazoActual, setTrazoActual] = useState<{ x: number; y: number }[] | null>(null);
  const [trazoPendiente, setTrazoPendiente] = useState<{ puntos: { x: number; y: number }[]; color: string } | null>(null);
  const [guardandoTrazo, setGuardandoTrazo] = useState(false);
  const [errorTrazo, setErrorTrazo] = useState<string | null>(null);
  // Color elegido para el próximo Trazo o Línea recta — compartido
  // entre las dos herramientas a propósito (mismo selector, mismo
  // criterio de "elegís una vez, se mantiene hasta que lo cambiés" —
  // no tiene sentido que cambiar de Trazo a Recta resetee el color).
  const [colorTrazo, setColorTrazo] = useState<string>(COLORES_TRAZO[0].valor);
  // Línea recta — interacción híbrida (clic-clic o clic-arrastre, ver
  // onSvgMouseDown/onSvgClick): rectaActual cubre el arrastre en vivo
  // (mismo patrón que dibujoActual de Línea/Medir); rectaPrimerPunto +
  // rectaCursor cubren el modo "ya clickeé el punto A, esperando el
  // segundo click" (mismo patrón que puntosArea/cursorArea de Área).
  // rectaPendiente/guardandoRecta/errorRecta — mismo patrón de
  // guardado automático + reintento que trazoPendiente.
  const [rectaActual, setRectaActual] = useState<{ xInicio: number; yInicio: number; xActual: number; yActual: number } | null>(null);
  const [rectaPrimerPunto, setRectaPrimerPunto] = useState<{ x: number; y: number } | null>(null);
  const [rectaCursor, setRectaCursor] = useState<{ x: number; y: number } | null>(null);
  const [rectaPendiente, setRectaPendiente] = useState<{ puntos: [{ x: number; y: number }, { x: number; y: number }]; color: string } | null>(null);
  const [guardandoRecta, setGuardandoRecta] = useState(false);
  const [errorRecta, setErrorRecta] = useState<string | null>(null);
  // Texto — un solo paso real: textoPendientePunto es el punto ya
  // clickeado, esperando que el usuario escriba el texto en
  // ModalNuevoTexto; en cuanto lo confirma, se guarda directo (sin un
  // estado "pendiente" intermedio ni banner flotante pidiendo
  // Guardar/Cancelar — eso generaba un cartel superpuesto que tapaba
  // textos chicos). Una vez guardado, ya es una anotación más y se
  // mueve/redimensiona con el mismo mecanismo que cualquier Texto
  // guardado (ver iniciarMoverTextoGuardado/
  // iniciarRedimensionarTextoGuardado). errorCrearTexto solo cubre el
  // caso borde de que ESE primer guardado falle — guarda punto+texto
  // para poder reintentar sin reabrir el modal.
  const [textoPendientePunto, setTextoPendientePunto] = useState<{ x: number; y: number } | null>(null);
  const [errorCrearTexto, setErrorCrearTexto] = useState<{ x: number; y: number; texto: string } | null>(null);
  // Mover/redimensionar un Texto YA GUARDADO — único mecanismo de
  // ajuste que existe ahora que el guardado es directo (ver
  // crearTexto). ajusteTextoId marca cuál anotación se está arrastrando
  // (para que su
  // render use ajusteTextoValores en vez del x/y/tamano del prop
  // mientras dura el drag); se persiste con onActualizarAnotacion recién
  // al soltar el mouse, no en cada mousemove.
  const [ajusteTextoId, setAjusteTextoId] = useState<string | null>(null);
  const [ajusteTextoValores, setAjusteTextoValores] = useState<{ x: number; y: number; tamano: number } | null>(null);

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
    } else if (herramienta === "RECTA" && !rectaPrimerPunto && !rectaPendiente) {
      // Mismo patrón que Línea/Medir: mousedown arranca un posible
      // arrastre. Si en finalizarRectaDrag resulta que casi no se
      // movió (un click simple, no un arrastre), se reinterpreta como
      // el punto A del modo "clic + clic" en vez de descartarse.
      setRectaActual({ xInicio: p.x, yInicio: p.y, xActual: p.x, yActual: p.y });
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
      // Umbral casi nulo (0.02, contra 0.15/0.4 de rondas anteriores):
      // en pruebas automatizadas con puntos generados a mano el umbral
      // más alto no se notaba (los puntos ya venían parejo espaciados),
      // pero con un mouse real la tasa de mousemove varía mucho con la
      // velocidad de la mano — en un trazo rápido, un umbral de 0.15
      // podía terminar capturando muy pocos puntos en los tramos
      // veloces, y ahí es donde se ve "cortado" incluso con curva
      // suave: si faltan puntos, la curva no tiene de dónde seguir la
      // forma real de la mano, por más Catmull-Rom que se le aplique.
      // Solo se descartan duplicados literales (mismo pixel, mouse
      // quieto) — el límite real de cuántos puntos se capturan lo pone
      // el navegador/hardware, no este umbral.
      setTrazoActual((prev) => {
        if (!prev) return prev;
        const ultimo = prev[prev.length - 1];
        if (Math.hypot(p.x - ultimo.x, p.y - ultimo.y) < 0.02) return prev;
        return [...prev, p];
      });
    } else if (herramienta === "RECTA" && rectaActual) {
      setRectaActual((prev) => (prev ? { ...prev, xActual: p.x, yActual: p.y } : prev));
    } else if (herramienta === "RECTA" && rectaPrimerPunto) {
      // Modo "clic + clic": ya está el punto A, esto solo actualiza la
      // línea de previsualización hasta la posición actual del mouse.
      setRectaCursor(p);
    }
  };

  const finalizarDibujoLinea = () => {
    if (herramienta !== "LINEA" || !dibujoActual) return;
    const { xInicio, yInicio, xActual: xFin, yActual: yFin } = dibujoActual;
    setDibujoActual(null);
    const distPercent = Math.hypot(xFin - xInicio, yFin - yInicio);
    if (distPercent < 0.5 || !pageDimsMM || doc.factorEscala == null) return;
    const valor = calcularLongitudReal(xInicio, yInicio, xFin, yFin, pageDimsMM, doc.factorEscala);
    if (medicionObjetivo) {
      asignarAnchoDesdeDrag(xInicio, yInicio, xFin, yFin, valor);
      return;
    }
    setMedicionPendiente({ tipo: "LINEA", xInicio, yInicio, xFin, yFin, valor });
  };

  // Modo asignación (ver ControlesMedicion.medicionObjetivo) — guarda
  // directo sin pasar por medicionPendiente/el modal de confirmación: la
  // fila objetivo ya tiene su propia descripción/repeticiones, pedírselas
  // de nuevo acá sería redundante (mismo criterio que Texto, que también
  // guarda directo sin modal intermedio). Un solo uso — se apaga la
  // herramienta después; el ícono de regla se vuelve a clickear para
  // medir de nuevo.
  const asignarAnchoDesdeDrag = async (
    xInicio: number,
    yInicio: number,
    xFin: number,
    yFin: number,
    valor: number
  ) => {
    const objetivo = medicionObjetivo;
    if (!objetivo) return;
    setMedicionObjetivo(null);
    setHerramienta(null);
    await onAsignarAncho(objetivo.filaId, {
      tipo: "LINEA",
      xInicio,
      yInicio,
      xFin,
      yFin,
      longitudReal: valor,
      repeticiones: 1,
      descripcion: `Ancho de "${objetivo.descripcion}"`,
      rubroId: null,
    });
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

  const intentarGuardarTrazo = async (puntos: { x: number; y: number }[], color: string) => {
    setGuardandoTrazo(true);
    setErrorTrazo(null);
    try {
      await onGuardarAnotacion({ tipo: "TRAZO", puntos, color });
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
    // El color se fija acá (al terminar de dibujar), no se relee de
    // colorTrazo en cada reintento — así un cambio de color mientras
    // hay un trazo con error pendiente no le cambia el color después
    // de haberlo dibujado.
    setTrazoPendiente({ puntos, color: colorTrazo });
    intentarGuardarTrazo(puntos, colorTrazo);
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

  const intentarGuardarRecta = async (puntos: [{ x: number; y: number }, { x: number; y: number }], color: string) => {
    setGuardandoRecta(true);
    setErrorRecta(null);
    try {
      await onGuardarAnotacion({ tipo: "RECTA", puntos, color });
      setRectaPendiente(null);
    } catch {
      setErrorRecta("No se pudo guardar la línea recta.");
    } finally {
      setGuardandoRecta(false);
    }
  };

  // Cierra el gesto de ARRASTRE de Línea recta (mousedown -> mousemove
  // -> mouseup). Si casi no hubo movimiento, NO se descarta como en
  // Línea/Medir — se reinterpreta como el punto A del modo "clic +
  // clic" (ver onSvgClick), que es la otra forma válida de dibujar la
  // recta descrita en el pedido.
  const finalizarRectaDrag = () => {
    if (herramienta !== "RECTA" || !rectaActual) return;
    const { xInicio, yInicio, xActual, yActual } = rectaActual;
    setRectaActual(null);
    const dist = Math.hypot(xActual - xInicio, yActual - yInicio);
    if (dist < 0.5) {
      setRectaPrimerPunto({ x: xInicio, y: yInicio });
      return;
    }
    const puntos: [{ x: number; y: number }, { x: number; y: number }] = [
      { x: xInicio, y: yInicio },
      { x: xActual, y: yActual },
    ];
    setRectaPendiente({ puntos, color: colorTrazo });
    intentarGuardarRecta(puntos, colorTrazo);
  };

  // Misma red de seguridad que finalizarDibujoLinea/finalizarTrazo.
  useEffect(() => {
    if (!rectaActual) return;
    window.addEventListener("mouseup", finalizarRectaDrag);
    return () => window.removeEventListener("mouseup", finalizarRectaDrag);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rectaActual]);

  // Click para AREA (agrega un vértice), TEXTO (abre el modal en ese
  // punto) y el segundo click del modo "clic + clic" de Línea recta.
  // mousedown/mouseup ya están ocupados por el drag de Línea/Trazo/
  // Recta, así que estas usan onClick (un click "de verdad", sin
  // arrastre significativo de por medio) para no pisarse con esa lógica.
  const onSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    if (herramienta === "AREA" && !medicionPendiente) {
      const p = puntoDesdeEvento(svgRef.current, e.clientX, e.clientY);
      if (p) setPuntosArea((prev) => [...prev, p]);
    } else if (herramienta === "TEXTO" && !textoPendientePunto) {
      const p = puntoDesdeEvento(svgRef.current, e.clientX, e.clientY);
      if (p) setTextoPendientePunto(p);
    } else if (herramienta === "RECTA" && rectaPrimerPunto) {
      const p = puntoDesdeEvento(svgRef.current, e.clientX, e.clientY);
      if (!p) return;
      // Si el segundo click cae casi en el mismo punto que el primero
      // (mismo umbral que el resto de las herramientas), lo ignora en
      // vez de guardar una "línea" de largo cero — el punto A se
      // mantiene puesto, el usuario simplemente clickea de nuevo donde
      // corresponde.
      if (Math.hypot(p.x - rectaPrimerPunto.x, p.y - rectaPrimerPunto.y) < 0.5) return;
      const puntos: [{ x: number; y: number }, { x: number; y: number }] = [rectaPrimerPunto, p];
      setRectaPrimerPunto(null);
      setRectaCursor(null);
      setRectaPendiente({ puntos, color: colorTrazo });
      intentarGuardarRecta(puntos, colorTrazo);
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
    } else if (herramienta === "RECTA") {
      // Cierra un arrastre en curso si lo había (no-op si no — ver
      // guard interno de finalizarRectaDrag); si estaba en modo "clic
      // + clic" solo limpia el preview, igual que Área — el punto A ya
      // puesto se mantiene.
      finalizarRectaDrag();
      setRectaCursor(null);
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
      setMedicionObjetivo(null);
      return;
    }
    setHerramienta("LINEA");
    setPuntosArea([]);
    setCursorArea(null);
    setTrazoActual(null);
    setRectaActual(null);
    setRectaPrimerPunto(null);
    setRectaCursor(null);
    setTextoPendientePunto(null);
  };

  const toggleArea = () => {
    if (herramienta !== "AREA") {
      setHerramienta("AREA");
      setPuntosArea([]);
      setCursorArea(null);
      setDibujoActual(null);
      setTrazoActual(null);
      setRectaActual(null);
      setRectaPrimerPunto(null);
      setRectaCursor(null);
      setTextoPendientePunto(null);
      setMedicionObjetivo(null);
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
    setRectaActual(null);
    setRectaPrimerPunto(null);
    setRectaCursor(null);
    setTextoPendientePunto(null);
    setMedicionObjetivo(null);
  };

  const toggleRecta = () => {
    if (herramienta === "RECTA") {
      setHerramienta(null);
      setRectaActual(null);
      setRectaPrimerPunto(null);
      setRectaCursor(null);
      return;
    }
    setHerramienta("RECTA");
    setDibujoActual(null);
    setPuntosArea([]);
    setCursorArea(null);
    setMedicionObjetivo(null);
    setTrazoActual(null);
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
    setRectaActual(null);
    setRectaPrimerPunto(null);
    setRectaCursor(null);
    setMedicionObjetivo(null);
  };

  // Arranca el modo asignación (ver ControlesMedicion.medicionObjetivo)
  // — fuerza LINEA, resetea cualquier otro trazo en curso, igual que
  // los demás toggle*. A diferencia de esos, no es un toggle: cada click
  // en el ícono de regla arranca de cero (si ya estaba en asignación
  // para otra fila, la cambia a esta).
  const iniciarAsignacionAncho = (filaId: string, descripcion: string) => {
    setHerramienta("LINEA");
    setDibujoActual(null);
    setPuntosArea([]);
    setCursorArea(null);
    setTrazoActual(null);
    setRectaActual(null);
    setRectaPrimerPunto(null);
    setRectaCursor(null);
    setTextoPendientePunto(null);
    setMedicionObjetivo({ filaId, descripcion });
  };

  // ESC — cancela la herramienta activa y descarta cualquier trazo
  // parcial sin guardar nada (mismo efecto que clickear el botón de la
  // herramienta para apagarla, pero incondicional: a diferencia de
  // toggleArea, que con 3+ vértices puestos CIERRA el polígono en vez
  // de cancelarlo, acá siempre descarta, nunca confirma). También cubre
  // "hay un modal abierto" sin necesidad de un handler aparte en cada
  // uno: medicionPendiente (ModalConfirmarMedicion) y textoPendientePunto
  // (ModalNuevoTexto) se ponen SIN apagar herramienta — el usuario sigue
  // "con la herramienta puesta" mientras esos modales están abiertos —
  // así que limpiarlos acá alcanza para cerrarlos también.
  const cancelarHerramienta = () => {
    setHerramienta(null);
    setDibujoActual(null);
    setPuntosArea([]);
    setCursorArea(null);
    setTrazoActual(null);
    setRectaActual(null);
    setRectaPrimerPunto(null);
    setRectaCursor(null);
    setTextoPendientePunto(null);
    setMedicionPendiente(null);
    setMedicionObjetivo(null);
  };

  useEffect(() => {
    if (!herramienta) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelarHerramienta();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [herramienta]);

  // Se guarda directo al confirmar el texto en el modal — sin paso
  // intermedio "pendiente" ni banner flotante pidiendo Guardar/Cancelar
  // (el usuario reportó que ese cartel tapaba textos chicos en el
  // plano). Una vez creado, ya aparece como una anotación guardada más
  // y se ajusta con el mismo mecanismo que cualquier Texto existente
  // (mover/redimensionar arrastrando directo — ver
  // iniciarMoverTextoGuardado/iniciarRedimensionarTextoGuardado). Si
  // ESTE primer guardado falla, se guarda el punto+texto en
  // errorCrearTexto para poder reintentar sin reabrir el modal.
  const crearTexto = async (x: number, y: number, texto: string) => {
    setErrorCrearTexto(null);
    try {
      await onGuardarAnotacion({ tipo: "TEXTO", x, y, texto, tamano: TEXTO_TAMANO_INICIAL });
    } catch {
      setErrorCrearTexto({ x, y, texto });
    }
  };

  // Texto YA GUARDADO — mover (arrastrar el texto) y borrar (click sin
  // arrastre) comparten el mismo mousedown en el mismo elemento, así
  // que hay que distinguirlos: si el mouse se movió más de
  // UMBRAL_DRAG_PX antes de soltar, fue un arrastre (mover, se persiste
  // con onActualizarAnotacion al soltar); si no, fue un click (borrar,
  // mismo flujo de confirmación que ya tenía). Ambas interacciones solo
  // se ofrecen cuando NO hay otra herramienta activa (ver pointerEvents
  // condicional en el render) — mismo criterio que el resto de "click
  // sobre una forma guardada" en este componente.
  const UMBRAL_DRAG_PX = 4;

  const iniciarMoverTextoGuardado = (a: Anotacion) => (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!svgRef.current || a.x == null || a.y == null) return;
    const svg = svgRef.current;
    const inicioX = e.clientX, inicioY = e.clientY;
    let arrastrado = false;
    let valores = { x: a.x, y: a.y, tamano: a.tamano ?? 16 };
    const onMove = (ev: MouseEvent) => {
      if (!arrastrado && Math.hypot(ev.clientX - inicioX, ev.clientY - inicioY) > UMBRAL_DRAG_PX) {
        arrastrado = true;
        setAjusteTextoId(a.id);
      }
      if (!arrastrado) return;
      const p = puntoDesdeEvento(svg, ev.clientX, ev.clientY);
      if (p) {
        valores = { ...valores, x: p.x, y: p.y };
        setAjusteTextoValores(valores);
      }
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (arrastrado) {
        onActualizarAnotacion(a.id, { x: valores.x, y: valores.y });
        setAjusteTextoId(null);
        setAjusteTextoValores(null);
      } else {
        eliminarAnotacionConConfirmacion(a);
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const iniciarRedimensionarTextoGuardado = (a: Anotacion) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (a.tamano == null || a.x == null || a.y == null) return;
    const inicioY = e.clientY;
    const tamanoInicial = a.tamano;
    let tamanoActual = tamanoInicial;
    setAjusteTextoId(a.id);
    setAjusteTextoValores({ x: a.x, y: a.y, tamano: tamanoInicial });
    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientY - inicioY;
      tamanoActual = clamp(tamanoInicial + delta, TEXTO_TAMANO_MIN, TEXTO_TAMANO_MAX);
      setAjusteTextoValores({ x: a.x!, y: a.y!, tamano: tamanoActual });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      onActualizarAnotacion(a.id, { tamano: tamanoActual });
      setAjusteTextoId(null);
      setAjusteTextoValores(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const eliminarAnotacionConConfirmacion = (anotacion: Anotacion) => {
    const etiqueta =
      anotacion.tipo === "TEXTO" ? `el texto "${anotacion.texto}"` : anotacion.tipo === "RECTA" ? "la línea recta" : "el trazo";
    if (confirm(`¿Eliminar ${etiqueta}?`)) {
      onEliminarAnotacion(anotacion.id);
    }
  };

  // Reemplaza al panel flotante de mediciones (sacado por redundante con
  // la Planilla de Cómputo) — mismo patrón de click + confirmación que
  // ya tienen Trazo libre y Texto.
  const eliminarMedicionConConfirmacion = (medicion: MedicionDocumento) => {
    if (confirm(`¿Eliminar "${medicion.descripcion}"?`)) {
      onEliminarMedicion(medicion.id);
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
      obtenerContenedorCaptura: () => transformRef.current?.instance.wrapperComponent ?? null,
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
      rectaActiva: herramienta === "RECTA",
      onToggleRecta: toggleRecta,
      textoActivo: herramienta === "TEXTO",
      onToggleTexto: toggleTexto,
      medicionObjetivo,
      onIniciarAsignacionAncho: iniciarAsignacionAncho,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.tipoArchivo, pageDimsMM, herramienta, puntosArea.length, medicionObjetivo]);

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
      {/* Banners flotantes arriba del plano — en un solo contenedor
          flex-col apilado a propósito: si dos llegaran a estar activos
          a la vez (ej. un trazo con error de guardado sin resolver +
          un texto recién colocado), que se apilen en vez de dibujarse
          uno encima del otro. */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2">
        {(herramienta === "TRAZO" || herramienta === "RECTA") && (
          <div className="flex items-center gap-1.5 bg-white rounded-full px-2.5 py-1.5 shadow-md border border-slate-200">
            {COLORES_TRAZO.map((c) => (
              <button
                key={c.valor}
                onClick={() => setColorTrazo(c.valor)}
                title={c.nombre}
                className={cn(
                  "w-5 h-5 rounded-full border-2 transition-transform",
                  colorTrazo === c.valor ? "border-slate-700 scale-110" : "border-white"
                )}
                style={{ backgroundColor: c.valor }}
              />
            ))}
          </div>
        )}
        {renderizandoPDF && !cargando && (
          <div className="flex items-center gap-2 bg-white/95 rounded-full px-3 py-1.5 shadow-md border border-slate-200 pointer-events-none">
            <Loader2 className="w-3.5 h-3.5 text-[#2563EB] animate-spin" />
            <span className="text-xs text-slate-500">Ajustando nitidez…</span>
          </div>
        )}
        {errorTrazo && (
          <div className="flex items-center gap-2 bg-white rounded-[10px] px-3 py-2 shadow-lg border border-red-200">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
            <p className="text-xs text-red-600">{errorTrazo}</p>
            <button
              onClick={() => trazoPendiente && intentarGuardarTrazo(trazoPendiente.puntos, trazoPendiente.color)}
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
        {errorRecta && (
          <div className="flex items-center gap-2 bg-white rounded-[10px] px-3 py-2 shadow-lg border border-red-200">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
            <p className="text-xs text-red-600">{errorRecta}</p>
            <button
              onClick={() => rectaPendiente && intentarGuardarRecta(rectaPendiente.puntos, rectaPendiente.color)}
              disabled={guardandoRecta}
              className="text-xs font-semibold text-[#2563EB] hover:underline disabled:opacity-40"
            >
              Reintentar
            </button>
            <button
              onClick={() => {
                setRectaPendiente(null);
                setErrorRecta(null);
              }}
              className="text-xs font-semibold text-slate-500 hover:underline"
            >
              Cancelar
            </button>
          </div>
        )}
        {/* Sin banner en el camino feliz — el texto se guarda solo al
            confirmar el modal, sin pedir Guardar/Cancelar (ver
            crearTexto). Este banner SOLO aparece si ese guardado
            falló, para poder reintentar sin reabrir el modal ni perder
            lo escrito. */}
        {errorCrearTexto && (
          <div className="flex items-center gap-2 bg-white rounded-[10px] px-3 py-2 shadow-lg border border-red-200">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
            <p className="text-xs text-red-600">No se pudo guardar el texto.</p>
            <button
              onClick={() => errorCrearTexto && crearTexto(errorCrearTexto.x, errorCrearTexto.y, errorCrearTexto.texto)}
              className="text-xs font-semibold text-[#2563EB] hover:underline"
            >
              Reintentar
            </button>
            <button onClick={() => setErrorCrearTexto(null)} className="text-xs font-semibold text-slate-500 hover:underline">
              Descartar
            </button>
          </div>
        )}
      </div>
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
                    canvasRef={canvasRef}
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
            {doc.tipoArchivo === "PDF" && (
              // Congelado del canvas viejo — ver congelarCanvasActual() y
              // el comentario grande arriba de DPR_MAXIMO. Mismo tamaño
              // que el canvas real (position:relative del wrapper +
              // absolute/inset-0/w-full/h-full), así que el navegador lo
              // estira exactamente como el <canvas> real — se ve
              // pixelado si el zoom subió, pero sigue siendo el plano.
              // display:none cuando no hace falta, en vez de desmontarlo,
              // para no perder los píxeles ya copiados entre un
              // congelado y el siguiente.
              <canvas
                ref={canvasCongeladoRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{ display: renderizandoPDF ? "block" : "none" }}
              />
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
              {/* Línea/Área guardadas — clickeables para borrar (click sobre
                  el trazo + confirmación, mismo criterio que Trazo libre/
                  Texto). pointerEvents condicionado a que NO haya una
                  herramienta activa: si estuviera siempre en "auto", un
                  click para poner un vértice de Área o un punto de Texto
                  que caiga sobre una medición ya guardada terminaría
                  borrándola en vez de dibujar — ver eliminarMedicionConConfirmacion. */}
              {mediciones.map((m) => {
                const clickeable = herramienta === null;
                const estiloClick: React.CSSProperties = { pointerEvents: clickeable ? "auto" : "none", cursor: clickeable ? "pointer" : "default" };
                const onClickBorrar = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  eliminarMedicionConConfirmacion(m);
                };
                if (m.tipo === "AREA" && m.puntos && m.puntos.length >= 3) {
                  return (
                    <g key={m.id} style={estiloClick} onClick={onClickBorrar}>
                      <title>{`"${m.descripcion}" — click para eliminar`}</title>
                      <polygon
                        points={m.puntos.map((p) => `${p.x},${p.y}`).join(" ")}
                        fill="#2563EB"
                        fillOpacity={0.12}
                        stroke="#2563EB"
                        strokeWidth={1.25}
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                      />
                    </g>
                  );
                }
                if (m.xInicio == null || m.yInicio == null || m.xFin == null || m.yFin == null) return null;
                return (
                  <g key={m.id} style={estiloClick} onClick={onClickBorrar}>
                    <title>{`"${m.descripcion}" — click para eliminar`}</title>
                    <line x1={m.xInicio} y1={m.yInicio} x2={m.xFin} y2={m.yFin} stroke="transparent" strokeWidth={3} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                    <line x1={m.xInicio} y1={m.yInicio} x2={m.xFin} y2={m.yFin} stroke="#2563EB" strokeWidth={1.25} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                  </g>
                );
              })}
              {/* Trazos guardados — mismo criterio de click-para-borrar y
                  misma condición de pointerEvents que Línea/Área arriba.
                  Curva suave (puntosASuavePath) en vez de <polyline> recta
                  — ver comentario en esa función. La franja invisible más
                  ancha (strokeWidth 3) existe solo para hacer más fácil
                  clickear un trazo fino. */}
              {anotaciones.map((a) => {
                if ((a.tipo !== "TRAZO" && a.tipo !== "RECTA") || !a.puntos || a.puntos.length < 2) return null;
                // puntosASuavePath con exactamente 2 puntos devuelve una
                // línea recta (M...L...), no una curva — por eso RECTA
                // reusa esta misma función sin ningún caso especial.
                const d = puntosASuavePath(a.puntos);
                const clickeable = herramienta === null;
                const color = a.color ?? COLORES_TRAZO[0].valor;
                return (
                  <g
                    key={a.id}
                    style={{ pointerEvents: clickeable ? "auto" : "none", cursor: clickeable ? "pointer" : "default" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      eliminarAnotacionConConfirmacion(a);
                    }}
                  >
                    <title>{a.tipo === "RECTA" ? "Línea recta — click para eliminar" : "Trazo — click para eliminar"}</title>
                    <path d={d} fill="none" stroke="transparent" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                    <path d={d} fill="none" stroke={color} strokeWidth={0.8} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
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
                  strokeWidth={0.7}
                  strokeDasharray="5,3"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              )}
              {/* Sin círculos de vértice — mismo criterio que Trazo libre
                  (sin ningún marcador). strokeWidth 0.8 — mismo grosor
                  fino que el punteado de Línea recta (no el 1.25 del
                  polígono ya guardado, que probamos en la ronda anterior:
                  con el Área quedaba más grueso que el resto de los
                  punteados de preview mientras se dibuja). */}
              {puntosArea.length > 0 && (
                <polyline
                  points={[...puntosArea, ...(cursorArea ? [cursorArea] : [])].map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  stroke="#64748B"
                  strokeWidth={0.8}
                  strokeDasharray="5,3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              )}
              {trazoActual && trazoActual.length > 0 && (
                <path
                  d={puntosASuavePath(trazoActual)}
                  fill="none"
                  stroke="#64748B"
                  strokeWidth={0.7}
                  strokeDasharray="5,3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              )}
              {trazoPendiente && (
                <path
                  d={puntosASuavePath(trazoPendiente.puntos)}
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth={1}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              )}
              {/* Línea recta — dos modos de guía, mismo gris/punteado
                  que el resto: rectaActual mientras se arrastra
                  (mousedown->mousemove), rectaPrimerPunto+rectaCursor
                  mientras espera el segundo click del modo "clic +
                  clic". Sin marcador de punto A — mismo criterio que
                  Trazo libre/Área (sin ningún círculo). strokeWidth 0.8
                  — igual que la línea ya guardada (ver bloque de
                  TRAZO/RECTA guardados más arriba), no el 1.5 que tenía
                  antes: la línea de preview cambiaba de grosor al
                  confirmarse, quedaba una discontinuidad visual entre
                  "dibujando" y "guardado". */}
              {rectaActual && (
                <line
                  x1={rectaActual.xInicio}
                  y1={rectaActual.yInicio}
                  x2={rectaActual.xActual}
                  y2={rectaActual.yActual}
                  stroke="#64748B"
                  strokeWidth={0.8}
                  strokeDasharray="3,2"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              )}
              {rectaPrimerPunto && rectaCursor && (
                <line
                  x1={rectaPrimerPunto.x}
                  y1={rectaPrimerPunto.y}
                  x2={rectaCursor.x}
                  y2={rectaCursor.y}
                  stroke="#64748B"
                  strokeWidth={0.8}
                  strokeDasharray="3,2"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              )}
              {rectaPendiente && (
                <line
                  x1={rectaPendiente.puntos[0].x}
                  y1={rectaPendiente.puntos[0].y}
                  x2={rectaPendiente.puntos[1].x}
                  y2={rectaPendiente.puntos[1].y}
                  stroke="#F59E0B"
                  strokeWidth={1}
                  strokeLinecap="round"
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
                al <svg> de abajo; cada texto reactiva pointer-events
                individualmente, pero solo cuando NO hay una herramienta
                activa (mismo motivo que Línea/Área/Trazo en el <svg>:
                evitar que clickear para poner un vértice o un punto
                termine moviendo/borrando un texto existente que está
                debajo). Solo se ve la letra — sin círculo ni ícono de
                esquina (el usuario reportó que un círculo tapaba el
                texto, y después que el ícono de esquina que lo
                reemplazó se seguía viendo mal por más que se achicara);
                el área para redimensionar en la esquina inferior
                derecha existe pero es invisible — el cursor
                nwse-resize al pasar por ahí ya es señal suficiente, sin
                nada permanente flotando sobre el plano (la explicación
                de cómo redimensionar vive una sola vez en
                ModalNuevoTexto). Mover es arrastrar el texto mismo — un
                click sin arrastre borra (ver iniciarMoverTextoGuardado). */}
            <div className="absolute inset-0" style={{ pointerEvents: "none" }}>
              {anotaciones.map((a) => {
                if (a.tipo !== "TEXTO" || a.x == null || a.y == null || !a.texto) return null;
                const enAjuste = ajusteTextoId === a.id && ajusteTextoValores;
                const x = enAjuste ? ajusteTextoValores!.x : a.x;
                const y = enAjuste ? ajusteTextoValores!.y : a.y;
                const tamano = enAjuste ? ajusteTextoValores!.tamano : a.tamano ?? 16;
                // Incluye "TEXTO" además de null a propósito: la
                // herramienta Texto queda prendida después de crear uno
                // (para poder poner varios seguidos, ver toggleTexto),
                // así que un texto recién escrito seguía con
                // pointer-events:none — el click para borrarlo pasaba de
                // largo hasta el <svg> de abajo, que lo interpretaba como
                // "poner un texto nuevo acá" en vez de borrar el
                // existente (bug reportado: "no se puede borrar después
                // de escribirlo"). Clickear un texto puntual sigue
                // andando igual con la herramienta prendida porque el
                // span hace stopPropagation antes de llegar al <svg>;
                // clickear el resto del plano (sin texto debajo) sigue
                // colocando uno nuevo, sin cambios.
                const interactivo = herramienta === null || herramienta === "TEXTO";
                return (
                  <div
                    key={a.id}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${x}%`, top: `${y}%`, pointerEvents: interactivo ? "auto" : "none" }}
                  >
                    <div className="relative inline-block">
                      <span
                        onMouseDown={iniciarMoverTextoGuardado(a)}
                        title={`"${a.texto}" — arrastrar para mover, click para eliminar`}
                        style={{ fontSize: `${tamano}px` }}
                        className="font-bold text-[#2563EB] whitespace-nowrap leading-none inline-block select-none cursor-pointer hover:text-[#1D4ED8] transition-colors"
                      >
                        {a.texto}
                      </span>
                      {/* Área de arrastre para redimensionar — sin ícono
                          visible (ronda anterior ya lo había achicado dos
                          veces y seguía viéndose mal). El cursor
                          nwse-resize al pasar por la esquina ya es señal
                          suficiente; la explicación de "arrastrá la
                          esquina para cambiar el tamaño" vive una sola
                          vez en ModalNuevoTexto, no como tooltip
                          permanente sobre el plano (mismo motivo por el
                          que el ícono anterior tampoco tenía title — se
                          superponía y tapaba textos chicos). Un poco más
                          grande que el ícono que reemplaza (12px vs 10px)
                          porque ahora es la única superficie de hit para
                          esta interacción, sin ayuda visual. */}
                      <div
                        onMouseDown={iniciarRedimensionarTextoGuardado(a)}
                        className="absolute -bottom-0.5 -right-0.5 w-3 h-3 cursor-nwse-resize"
                      />
                    </div>
                  </div>
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
        <ModalNuevoTexto
          onCancelar={() => setTextoPendientePunto(null)}
          onContinuar={(texto) => {
            crearTexto(textoPendientePunto.x, textoPendientePunto.y, texto);
            setTextoPendientePunto(null);
          }}
        />
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
  nombreProyecto,
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
  onAsignarAncho,
  onEliminarMedicion,
  anotaciones,
  onGuardarAnotacion,
  onEliminarAnotacion,
  onActualizarAnotacion,
  onControlesMedicionListos,
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
  /** Modo asignación (ver ControlesMedicion.medicionObjetivo) — ícono de
   * regla en PlanillaComputo.tsx, ver onControlesMedicionListos abajo
   * para cómo llega hasta ahí. */
  onAsignarAncho: (filaId: string, input: NuevaMedicionInput) => Promise<void>;
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
  onActualizarAnotacion: (anotacionId: string, cambios: CambiosAnotacion) => void;
  /** Expone los controles de medición (incluye onIniciarAsignacionAncho)
   * un nivel más arriba, hacia page.tsx — el ícono de regla que arranca
   * el modo asignación vive en PlanillaComputo.tsx, un componente
   * hermano de este Visor, no un hijo, así que necesita subir hasta el
   * dueño de ambos para bajar de nuevo. */
  onControlesMedicionListos?: (controles: ControlesMedicion | null) => void;
  /** Nombre del proyecto — solo para la cabecera del PDF exportado
   * ("Descargar PDF"), no se muestra en ningún otro lado del Visor (el
   * header con el nombre ya vive en la página que lo contiene). */
  nombreProyecto: string;
  style?: React.CSSProperties;
}) {
  const [notasLocal, setNotasLocal] = useState(notas);
  const [guardandoNotas, setGuardandoNotas] = useState(false);
  useEffect(() => setNotasLocal(notas), [notas]);

  const [controlesZoom, setControlesZoom] = useState<ControlesZoom | null>(null);
  const [controlesMedicion, setControlesMedicion] = useState<ControlesMedicion | null>(null);
  const puedeActivarMedicion = documentoPrincipal?.tipoArchivo === "PDF" && !!controlesMedicion?.pageDimsListo;
  const [exportandoPDF, setExportandoPDF] = useState(false);

  // "Descargar PDF" — captura EXACTAMENTE lo que se ve en el viewport
  // ahora mismo (zoom/pan incluidos, no el documento completo) porque
  // apunta al wrapper de react-zoom-pan-pinch, que tiene overflow:hidden
  // y por eso ya recorta a lo visible — ver obtenerContenedorCaptura en
  // ControlesZoom. html2canvas y @react-pdf/renderer se cargan con
  // import() dinámico, no en el top-level del archivo: son pesadas y
  // solo hacen falta si el usuario realmente aprieta el botón.
  const descargarPDF = async () => {
    const contenedor = controlesZoom?.obtenerContenedorCaptura();
    if (!contenedor || !documentoPrincipal) return;
    setExportandoPDF(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvasCapturado = await html2canvas(contenedor, {
        backgroundColor: "#ffffff",
        scale: typeof window !== "undefined" ? window.devicePixelRatio || 2 : 2,
        useCORS: true,
      });
      const imagenDataUrl = canvasCapturado.toDataURL("image/png");
      const orientacion = canvasCapturado.width >= canvasCapturado.height ? "landscape" : "portrait";
      const fecha = new Date().toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" });

      const { generarPdfVisor } = await import("./VisorExportPDF");
      const blob = await generarPdfVisor({
        nombreProyecto,
        nombreDocumento: documentoPrincipal.nombre,
        fecha,
        escala: documentoPrincipal.escalaDeclarada,
        imagenDataUrl,
        orientacion,
        notas: notasLocal,
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const nombreBase = `${nombreProyecto || "plano"}-${documentoPrincipal.nombre || "documento"}`.replace(/\s+/g, "-");
      a.download = `${nombreBase}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[descargarPDF]", err);
      alert("No se pudo generar el PDF. Probá de nuevo.");
    } finally {
      setExportandoPDF(false);
    }
  };

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
    // Antes "fixed inset-0 z-50 ... lg:static lg:inset-auto ..." — modo
    // pantalla completa en mobile heredado de cuando este componente
    // vivía embebido en el layout de 3 columnas de la pestaña
    // Presupuesto. Hoy <Visor> se usa en un solo lugar (grep confirmado
    // — /proyectos/[id]/visor/page.tsx), una página propia que ya es
    // "pantalla de trabajo enfocada" con su propio header — el overlay
    // fijo quedó como código muerto que tapaba la Planilla (que vive
    // arriba, en el flujo normal del documento) en cualquier viewport
    // por debajo de 1024px. Ahora se comporta siempre como la variante
    // lg: de antes — tarjeta normal en el flujo, en todos los tamaños.
    <div
      className="bg-white flex flex-col h-full flex-shrink-0 border border-slate-300 rounded-[16px] shadow-sm overflow-hidden"
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

      {/* FILA 2 — barra de herramientas: tres grupos con separación
          visual clara (divider vertical entre cada uno) — zoom/vista,
          herramientas de dibujo/anotación, y Descargar PDF (acción
          puntual, no una herramienta que queda prendida, por eso vive
          en su propio grupo en vez de mezclada con las demás). Zoom/
          Expandir son controles de vista, no "herramientas" con estado
          on/off — quedan como íconos sueltos, sin borde ni fondo
          permanente (el nivel más bajo de peso visual). Medir/Área/
          Trazo/Recta/Texto/Descargar PDF usan clasePildoraHerramienta:
          píldora neutra en reposo (blanco + borde sutil, mismo lenguaje
          que "Cambiar escala"/"Exportar Excel"), azul sólido #2563EB
          solo cuando la herramienta está prendida — antes todos estos
          botones usaban el mismo azul pálido siempre, prendidos o no,
          así que no había forma de distinguir de un vistazo cuál estaba
          activa. */}
      <div className="flex items-center gap-1 px-4 py-2 bg-white border-b border-slate-200 flex-shrink-0 flex-wrap">
        {controlesZoom && (
          <>
            <button onClick={controlesZoom.zoomOut} title="Alejar" className="p-1.5 rounded-[8px] text-slate-500 hover:text-[#1A3A5C] hover:bg-slate-100 transition-colors">
              <ZoomOut className="w-4 h-4" />
            </button>
            <button onClick={controlesZoom.zoomIn} title="Acercar" className="p-1.5 rounded-[8px] text-slate-500 hover:text-[#1A3A5C] hover:bg-slate-100 transition-colors">
              <ZoomIn className="w-4 h-4" />
            </button>
            <button onClick={controlesZoom.resetTransform} title="Ajustar a vista" className="p-1.5 rounded-[8px] text-slate-500 hover:text-[#1A3A5C] hover:bg-slate-100 transition-colors">
              <Maximize2 className="w-4 h-4" />
            </button>
          </>
        )}
        <button
          onClick={onToggleExpandir}
          title={expandido ? "Volver a vista de 3 columnas" : "Expandir visor a pantalla completa"}
          className="p-1.5 rounded-[8px] text-slate-500 hover:text-[#1A3A5C] hover:bg-slate-100 transition-colors"
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
              className={clasePildoraHerramienta(controlesMedicion?.herramienta === "LINEA", puedeActivarMedicion)}
            >
              <Ruler className="w-3.5 h-3.5" /> {controlesMedicion?.herramienta === "LINEA" ? "Midiendo…" : "Medir"}
            </button>
            <button
              onClick={controlesMedicion?.onToggleArea}
              disabled={!puedeActivarMedicion || !!controlesMedicion?.medicionObjetivo}
              title={
                controlesMedicion?.medicionObjetivo
                  ? "No disponible mientras se está midiendo un ANCHO — cancelá con ESC o con el ícono de regla"
                  : documentoPrincipal.tipoArchivo !== "PDF"
                  ? "Medición disponible solo para planos en PDF por ahora — para fotos hace falta calibrar por cota (próxima ronda)"
                  : controlesMedicion?.herramienta !== "AREA"
                  ? "Medir una superficie dibujando un polígono sobre el plano — clic para cada vértice"
                  : controlesMedicion.puntosAreaCount < 3
                  ? "Agregá al menos 3 vértices — clic en el plano (volvé a clickear acá para cancelar)"
                  : "Cerrar el polígono y calcular el área"
              }
              className={clasePildoraHerramienta(controlesMedicion?.herramienta === "AREA", puedeActivarMedicion && !controlesMedicion?.medicionObjetivo)}
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
              disabled={!controlesMedicion || !!controlesMedicion?.medicionObjetivo}
              title={
                controlesMedicion?.medicionObjetivo
                  ? "No disponible mientras se está midiendo un ANCHO — cancelá con ESC o con el ícono de regla"
                  : controlesMedicion?.trazoActivo
                  ? "Dibujando — clic y arrastre para trazar a mano alzada"
                  : "Trazo libre — dibujá a mano alzada sobre el plano (flecha, círculo, subrayado, etc.)"
              }
              className={clasePildoraHerramienta(!!controlesMedicion?.trazoActivo, !!controlesMedicion && !controlesMedicion?.medicionObjetivo)}
            >
              <Pencil className="w-3.5 h-3.5" /> {controlesMedicion?.trazoActivo ? "Dibujando…" : "Trazo libre"}
            </button>
            <button
              onClick={controlesMedicion?.onToggleRecta}
              disabled={!controlesMedicion || !!controlesMedicion?.medicionObjetivo}
              title={
                controlesMedicion?.medicionObjetivo
                  ? "No disponible mientras se está midiendo un ANCHO — cancelá con ESC o con el ícono de regla"
                  : controlesMedicion?.rectaActiva
                  ? "Dibujando — clic para el punto A, clic o arrastre hasta el punto B"
                  : "Línea recta — dibujá una línea recta sobre el plano (sin medir, solo visual)"
              }
              className={clasePildoraHerramienta(!!controlesMedicion?.rectaActiva, !!controlesMedicion && !controlesMedicion?.medicionObjetivo)}
            >
              <Slash className="w-3.5 h-3.5" /> {controlesMedicion?.rectaActiva ? "Dibujando…" : "Línea recta"}
            </button>
            <button
              onClick={controlesMedicion?.onToggleTexto}
              disabled={!controlesMedicion || !!controlesMedicion?.medicionObjetivo}
              title={
                controlesMedicion?.medicionObjetivo
                  ? "No disponible mientras se está midiendo un ANCHO — cancelá con ESC o con el ícono de regla"
                  : controlesMedicion?.textoActivo
                  ? "Poniendo texto — clic en el plano"
                  : "Texto — dejá una letra o palabra en un punto del plano, con tamaño ajustable"
              }
              className={clasePildoraHerramienta(!!controlesMedicion?.textoActivo, !!controlesMedicion && !controlesMedicion?.medicionObjetivo)}
            >
              <TypeIcon className="w-3.5 h-3.5" /> {controlesMedicion?.textoActivo ? "Marcando…" : "Texto"}
            </button>
          </>
        )}
        <div className="flex-1" />
        <div className="w-px h-4 bg-slate-200 mx-1" />
        {/* Descarga exactamente lo que se ve en el viewport ahora mismo
            (zoom/pan y anotaciones incluidos) — ver descargarPDF. Acción
            de una sola vez, no una herramienta que queda "prendida" —
            nunca pasa a la variante azul de clasePildoraHerramienta,
            solo alterna entre neutra y deshabilitada. */}
        <button
          onClick={descargarPDF}
          disabled={!controlesZoom || !documentoPrincipal || exportandoPDF}
          title="Descargar el plano visible (con las anotaciones) como PDF"
          className={cn(clasePildoraHerramienta(false, !!controlesZoom && !!documentoPrincipal), exportandoPDF && "opacity-60 cursor-wait")}
        >
          {exportandoPDF ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          {exportandoPDF ? "Generando…" : "Descargar PDF"}
        </button>
        <div className="w-px h-4 bg-slate-200 mx-1" />
        <button onClick={onClose} title="Cerrar" className="p-1.5 rounded-[8px] text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      {/* Banner de modo asignación (ver ControlesMedicion.medicionObjetivo)
          — arrancado desde el ícono de regla en PlanillaComputo.tsx. El
          próximo trazo de Línea confirmado no crea una fila nueva, completa
          el ANCHO de esta. ESC ya cancela (mismo listener que las demás
          herramientas, ver cancelarHerramienta en VisorPrincipal). */}
      {controlesMedicion?.medicionObjetivo && (
        <div className="flex items-center gap-2 px-4 py-2 bg-[#2563EB]/10 border-b border-[#2563EB]/20 text-sm text-[#1A3A5C] flex-shrink-0">
          <Ruler className="w-3.5 h-3.5 text-[#2563EB] flex-shrink-0" />
          <span>
            Midiendo ANCHO para: <span className="font-medium">{controlesMedicion.medicionObjetivo.descripcion}</span>
            {" — "}dibujá una línea sobre el plano (ESC para cancelar)
          </span>
        </div>
      )}

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
                onAsignarAncho={onAsignarAncho}
                onEliminarMedicion={onEliminarMedicion}
                onGuardarAnotacion={onGuardarAnotacion}
                onEliminarAnotacion={onEliminarAnotacion}
                onActualizarAnotacion={onActualizarAnotacion}
                onControlesZoomListos={setControlesZoom}
                onControlesMedicionListos={(c) => {
                  setControlesMedicion(c);
                  onControlesMedicionListos?.(c);
                }}
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
