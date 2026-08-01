"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import {
  Download,
  Plus,
  X,
  ChevronDown,
  Sparkles,
  Calculator,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { urlProxyDocumentoMetraje } from "@/lib/blob";
import {
  type CategoriaDocumento,
  type DocumentoResumen,
  type DocumentoDetalle,
} from "@/components/metrajes/documentoMetraje";

// SeccionDocumentacionParaMetrar (vía SeccionDocumentoMetraje) y Visor
// importan react-pdf (pdf.js), que revienta con "DOMMatrix is not
// defined" si su módulo se evalúa en el servidor. Esta sección vive
// dentro de la pestaña Presupuesto (página "use client"), pero de todos
// modos Next la renderiza una vez en el servidor para el HTML inicial —
// con ssr:false nunca se evalúan ahí, solo en el browser.
const SeccionDocumentacionParaMetrar = dynamic(
  () => import("@/components/metrajes/SeccionDocumentacionParaMetrar"),
  {
    ssr: false,
    loading: () => (
      <div className="bg-white rounded-[16px] border border-slate-300 shadow-sm p-4">
        <p className="text-sm text-slate-400">Cargando…</p>
      </div>
    ),
  }
);
const Visor = dynamic(() => import("@/components/metrajes/Visor"), { ssr: false });

/* ─── Tipos ───────────────────────────────────────────────── */
interface MetrajeFila {
  id: string;
  descripcion: string;
  largo: number | null;
  ancho: number | null;
  alto: number | null;
  cantidad: number | null;
  rubroId: string | null;
}

interface RubroOption {
  id: string;
  nombre: string;
  capituloNombre: string;
}

interface ElementoDetectado {
  descripcion: string;
  largo: number | null;
  ancho: number | null;
  alto: number | null;
  cantidad: number;
  subtotal: number;
  unidad: "M2" | "M3" | "ML" | "U";
  nota: string;
}

interface EstadoCategoria {
  documentos: DocumentoResumen[];
  cargando: boolean;
  error: string | null;
}

/* ─── Helpers ─────────────────────────────────────────────── */
function fmtNum(v: number, decimales = 2): string {
  return v.toLocaleString("es-UY", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

function subtotalFila(f: MetrajeFila): number {
  const valores = [f.largo, f.ancho, f.alto, f.cantidad];
  if (valores.every((v) => v == null)) return 0;
  return valores.reduce((acc: number, v) => acc * (v ?? 1), 1);
}

function nuevaFila(): MetrajeFila {
  return {
    id: `f${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    descripcion: "",
    largo: null,
    ancho: null,
    alto: null,
    cantidad: null,
    rubroId: null,
  };
}

/* ─── Sección principal ───────────────────────────────────── */
export default function SeccionMetrajesPresupuesto({
  proyectoId,
  proyectoNombre,
  documentacionLlamado,
}: {
  proyectoId: string;
  proyectoNombre: string;
  /** La card "Documentación del llamado", ya renderizada por la página
   * padre — se ubica al lado de "Documentación para metrar" en la misma
   * fila (ver UI_UX_REDESIGN.md sección 2quinquies). */
  documentacionLlamado: React.ReactNode;
}) {
  const [rubrosDisponibles, setRubrosDisponibles] = useState<RubroOption[]>([]);
  const [filas, setFilas] = useState<MetrajeFila[]>([nuevaFila()]);

  // Fila con IA
  const [iaTexto, setIaTexto] = useState("");
  const [iaCargando, setIaCargando] = useState(false);

  // Análisis de imágenes con IA — dispara desde el visor
  const [elementosDetectados, setElementosDetectados] = useState<ElementoDetectado[] | null>(null);
  const [observacionesIA, setObservacionesIA] = useState("");
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());

  // Calculadora rápida
  const [mostrarCalculadora, setMostrarCalculadora] = useState(false);

  // Documentación para metrar — 3 categorías independientes, cada una con
  // su propio cargar+guardar (ver UI_UX_REDESIGN.md 2quinquies).
  const [planos, setPlanos] = useState<DocumentoResumen[]>([]);
  const [cargandoPlanos, setCargandoPlanos] = useState(true);
  const [errorPlanos, setErrorPlanos] = useState<string | null>(null);
  const [fotos, setFotos] = useState<DocumentoResumen[]>([]);
  const [cargandoFotos, setCargandoFotos] = useState(true);
  const [errorFotos, setErrorFotos] = useState<string | null>(null);
  const [detalles, setDetalles] = useState<DocumentoResumen[]>([]);
  const [cargandoDetalles, setCargandoDetalles] = useState(true);
  const [errorDetalles, setErrorDetalles] = useState<string | null>(null);
  const [eliminandoIds, setEliminandoIds] = useState<Set<string>>(new Set());

  // Visor — documento principal fijo + ventana flotante para Foto/Detalle
  const [documentoAbierto, setDocumentoAbierto] = useState<DocumentoDetalle | null>(null);
  const [ventanaFlotante, setVentanaFlotante] = useState<DocumentoDetalle | null>(null);
  const [cargandoDetalleDoc, setCargandoDetalleDoc] = useState(false);

  // Notas — única por proyecto (ya no por documento), ver 2quinquies
  const [notas, setNotas] = useState("");

  // Visor expandido a pantalla completa — oculta la columna izquierda
  // (Documentación + Planilla + Calculadora) y la lista interna del visor
  // para dar todo el ancho disponible al documento principal. No se
  // persiste a propósito, resetea al cerrar.
  const [visorExpandido, setVisorExpandido] = useState(false);

  // Panel redimensionable — ancho del visor como % del split, arrastrando el
  // divisor. Solo aplica en desktop (lg+); en mobile el visor es overlay
  // full-screen y no hay nada que redimensionar. No se persiste a propósito
  // (resetea al recargar).
  const [anchoVisorPct, setAnchoVisorPct] = useState(40);
  const [isDesktop, setIsDesktop] = useState(false);
  const splitRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const actualizar = () => setIsDesktop(mq.matches);
    actualizar();
    mq.addEventListener("change", actualizar);
    return () => mq.removeEventListener("change", actualizar);
  }, []);

  const iniciarResizeVisor = (e: React.MouseEvent) => {
    e.preventDefault();
    const contenedor = splitRef.current;
    if (!contenedor) return;

    const onMouseMove = (ev: MouseEvent) => {
      const rect = contenedor.getBoundingClientRect();
      const pctDesdeIzquierda = ((ev.clientX - rect.left) / rect.width) * 100;
      setAnchoVisorPct(Math.min(70, Math.max(20, 100 - pctDesdeIzquierda)));
    };
    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  /* Carga independiente de cada una de las 3 categorías */
  useEffect(() => {
    if (!proyectoId) return;
    let cancelado = false;
    (async () => {
      try {
        const res = await fetch(`/api/proyectos/${proyectoId}/documentos-metraje?categoria=PLANO`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!cancelado) setPlanos(data.documentos ?? []);
      } catch {
        if (!cancelado) setErrorPlanos("No se pudieron cargar los documentos.");
      } finally {
        if (!cancelado) setCargandoPlanos(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [proyectoId]);

  useEffect(() => {
    if (!proyectoId) return;
    let cancelado = false;
    (async () => {
      try {
        const res = await fetch(`/api/proyectos/${proyectoId}/documentos-metraje?categoria=FOTO`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!cancelado) setFotos(data.documentos ?? []);
      } catch {
        if (!cancelado) setErrorFotos("No se pudieron cargar los documentos.");
      } finally {
        if (!cancelado) setCargandoFotos(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [proyectoId]);

  useEffect(() => {
    if (!proyectoId) return;
    let cancelado = false;
    (async () => {
      try {
        const res = await fetch(`/api/proyectos/${proyectoId}/documentos-metraje?categoria=DETALLE`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!cancelado) setDetalles(data.documentos ?? []);
      } catch {
        if (!cancelado) setErrorDetalles("No se pudieron cargar los documentos.");
      } finally {
        if (!cancelado) setCargandoDetalles(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [proyectoId]);

  const estadoDocumentos: Record<CategoriaDocumento, EstadoCategoria> = {
    PLANO: { documentos: planos, cargando: cargandoPlanos, error: errorPlanos },
    FOTO: { documentos: fotos, cargando: cargandoFotos, error: errorFotos },
    DETALLE: { documentos: detalles, cargando: cargandoDetalles, error: errorDetalles },
  };

  const todosLosDocumentos = useMemo(
    () => [...planos, ...fotos, ...detalles],
    [planos, fotos, detalles]
  );

  function actualizarDocumentos(categoria: CategoriaDocumento, documentos: DocumentoResumen[]) {
    if (categoria === "PLANO") setPlanos(documentos);
    else if (categoria === "FOTO") setFotos(documentos);
    else setDetalles(documentos);
  }

  async function abrirComoPrincipal(id: string) {
    setCargandoDetalleDoc(true);
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/documentos-metraje/${id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setDocumentoAbierto(data.documento);
      setVentanaFlotante(null);
    } catch {
      setErrorPlanos("No se pudo abrir el documento.");
    } finally {
      setCargandoDetalleDoc(false);
    }
  }

  async function abrirComoVentanaFlotante(id: string) {
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/documentos-metraje/${id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setVentanaFlotante(data.documento);
    } catch {
      // silencioso — la ventana flotante simplemente no abre, sin bloquear el visor principal
    }
  }

  function seleccionarDesdeVisor(doc: DocumentoResumen) {
    if (doc.categoria === "PLANO") {
      abrirComoPrincipal(doc.id);
    } else {
      abrirComoVentanaFlotante(doc.id);
    }
  }

  function cerrarVisor() {
    setDocumentoAbierto(null);
    setVentanaFlotante(null);
    setVisorExpandido(false);
  }

  async function eliminarDocumento(id: string) {
    setEliminandoIds((prev) => new Set(prev).add(id));
    const anteriores = { planos, fotos, detalles };
    setPlanos((prev) => prev.filter((d) => d.id !== id));
    setFotos((prev) => prev.filter((d) => d.id !== id));
    setDetalles((prev) => prev.filter((d) => d.id !== id));
    if (documentoAbierto?.id === id) cerrarVisor();
    if (ventanaFlotante?.id === id) setVentanaFlotante(null);
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/documentos-metraje/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      setPlanos(anteriores.planos);
      setFotos(anteriores.fotos);
      setDetalles(anteriores.detalles);
      setErrorPlanos("No se pudo eliminar el documento.");
    } finally {
      setEliminandoIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function guardarNotas(nuevasNotas: string) {
    const res = await fetch(`/api/proyectos/${proyectoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notas: nuevasNotas.trim() || null }),
    });
    if (!res.ok) throw new Error();
    setNotas(nuevasNotas.trim());
  }

  /* Cargar rubros disponibles del proyecto (para vincular filas de la
   * planilla) y las notas (única por proyecto) */
  useEffect(() => {
    if (!proyectoId) return;
    async function cargar() {
      try {
        const res = await fetch(`/api/proyectos/${proyectoId}`);
        if (!res.ok) return;
        const data = await res.json();
        setNotas(data.notas ?? "");
        const opciones: RubroOption[] = [];
        for (const cap of data.capitulos ?? []) {
          for (const rubro of cap.rubros ?? []) {
            opciones.push({
              id: rubro.id,
              nombre: rubro.descripcion || "Rubro sin nombre",
              capituloNombre: cap.nombre,
            });
          }
        }
        setRubrosDisponibles(opciones);
      } catch (err) {
        console.error("[metrajes] cargar rubros/notas", err);
      }
    }
    cargar();
  }, [proyectoId]);

  /* Filas de la planilla */
  const actualizarFila = (id: string, field: keyof MetrajeFila, value: string) => {
    setFilas((prev) =>
      prev.map((f) =>
        f.id !== id
          ? f
          : {
              ...f,
              [field]:
                field === "descripcion" || field === "rubroId"
                  ? value || null
                  : value === ""
                  ? null
                  : parseFloat(value),
            }
      )
    );
  };

  const agregarFila = () => setFilas((prev) => [...prev, nuevaFila()]);

  const eliminarFila = (id: string) => setFilas((prev) => prev.filter((f) => f.id !== id));

  /* Fila generada a partir de descripción en lenguaje natural vía IA */
  const agregarFilaIA = async () => {
    if (!iaTexto.trim() || iaCargando) return;
    setIaCargando(true);
    try {
      const res = await fetch("/api/metrajes/sugerir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descripcion: iaTexto.trim() }),
      });
      if (!res.ok) throw new Error("Error al generar la fila");
      const data = await res.json();

      setFilas((prev) => [
        ...prev,
        {
          ...nuevaFila(),
          descripcion: data.nota ? `${data.descripcion} (${data.nota})` : data.descripcion,
          largo: data.largo ?? null,
          ancho: data.ancho ?? null,
          alto: data.alto ?? null,
          cantidad: data.cantidad ?? 1,
        },
      ]);
      setIaTexto("");
    } catch (err) {
      console.error("[metrajes] agregarFilaIA", err);
    } finally {
      setIaCargando(false);
    }
  };

  /* Analizar con IA el documento principal (si es imagen) + todas las
   * fotos de relevamiento del proyecto — ya no dependen de un plano
   * puntual, son documentos independientes (ver 2quinquies). */
  const imagenesParaIA = useMemo(() => {
    const imgs: string[] = [];
    if (documentoAbierto?.tipoArchivo === "IMAGEN") imgs.push(documentoAbierto.archivo);
    for (const f of fotos) imgs.push(urlProxyDocumentoMetraje(proyectoId, f.id));
    return imgs;
  }, [documentoAbierto, fotos, proyectoId]);

  const analizarConIA = async (imagenesBase64: string[], contexto: string | null) => {
    const res = await fetch("/api/metrajes/analizar-imagen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fotos: imagenesBase64, contexto: contexto?.trim() || undefined }),
    });
    if (!res.ok) throw new Error("Error al analizar las imágenes");
    const data = await res.json();
    const elementos: ElementoDetectado[] = data.elementos ?? [];
    setElementosDetectados(elementos);
    setObservacionesIA(data.observaciones ?? "");
    setSeleccionados(new Set(elementos.map((_, i) => i)));
  };

  const toggleSeleccionado = (i: number) => {
    setSeleccionados((prev) => {
      const copia = new Set(prev);
      if (copia.has(i)) copia.delete(i);
      else copia.add(i);
      return copia;
    });
  };

  const cerrarPanelAnalisis = () => {
    setElementosDetectados(null);
    setObservacionesIA("");
    setSeleccionados(new Set());
  };

  const agregarElementosSeleccionados = () => {
    if (!elementosDetectados) return;
    const nuevasFilas = elementosDetectados
      .filter((_, i) => seleccionados.has(i))
      .map((el) => ({
        ...nuevaFila(),
        descripcion: el.nota ? `${el.descripcion} (${el.nota})` : el.descripcion,
        largo: el.largo,
        ancho: el.ancho,
        alto: el.alto,
        cantidad: el.cantidad ?? 1,
      }));
    if (nuevasFilas.length > 0) setFilas((prev) => [...prev, ...nuevasFilas]);
    cerrarPanelAnalisis();
  };

  const totalGeneral = useMemo(
    () => filas.reduce((s, f) => s + subtotalFila(f), 0),
    [filas]
  );

  /* Exportar a Excel */
  const exportarExcel = () => {
    const fecha = new Date().toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" });
    const wb = XLSX.utils.book_new();

    const datos: (string | number | null)[][] = [
      [`METRAJES — ${proyectoNombre || "Proyecto"}`],
      [`Fecha de generación: ${fecha}`],
      [],
      ["DESCRIPCIÓN", "LARGO", "ANCHO", "ALTO", "CANT.", "SUBTOTAL", "RUBRO VINCULADO"],
      ...filas
        .filter((f) => f.descripcion.trim())
        .map((f) => {
          const rubro = rubrosDisponibles.find((r) => r.id === f.rubroId);
          return [
            f.descripcion,
            f.largo ?? null,
            f.ancho ?? null,
            f.alto ?? null,
            f.cantidad ?? null,
            parseFloat(subtotalFila(f).toFixed(2)),
            rubro ? rubro.nombre : "",
          ];
        }),
      ["TOTAL GENERAL", "", "", "", "", parseFloat(totalGeneral.toFixed(2)), ""],
    ];

    const ws = XLSX.utils.aoa_to_sheet(datos);
    ws["!cols"] = [{ wch: 36 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 28 }];

    XLSX.utils.book_append_sheet(wb, ws, "Metrajes");
    XLSX.writeFile(wb, `Metrajes-${(proyectoNombre || "proyecto").replace(/\s+/g, "-")}.xlsx`);
  };

  const inputCls =
    "w-full text-sm text-slate-600 bg-transparent focus:outline-none focus:bg-white focus:rounded focus:ring-1 focus:ring-[#2563EB]/20 placeholder:text-slate-300";

  return (
    <>
      <div
        ref={splitRef}
        className={cn("w-full flex flex-col lg:flex-row gap-4 mb-6", documentoAbierto && "lg:h-[75vh]")}
      >
        <div
          className={cn("w-full space-y-4", documentoAbierto && !visorExpandido && "lg:w-[60%]", visorExpandido && "hidden")}
          style={isDesktop && documentoAbierto && !visorExpandido ? { width: `${100 - anchoVisorPct}%` } : undefined}
        >
          {/* ── Documentación del llamado + Documentación para metrar, lado a lado (ver UI_UX_REDESIGN.md 2quinquies) ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            {documentacionLlamado}
            {proyectoId && (
              <SeccionDocumentacionParaMetrar
                proyectoId={proyectoId}
                estado={estadoDocumentos}
                eliminandoIds={eliminandoIds}
                onDocumentosActualizados={actualizarDocumentos}
                onAbrirDocumento={abrirComoPrincipal}
                onEliminarDocumento={eliminarDocumento}
              />
            )}
          </div>

          {/* ── Planilla de cómputo ───────────────────────────── */}
          <div className="bg-white rounded-[16px] border border-slate-300 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
              <span className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">
                Planilla de cómputo
              </span>
              <button
                onClick={exportarExcel}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-slate-300 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Exportar Excel
              </button>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[860px]">
                {/* Cabecera */}
                <div className="flex items-center bg-slate-50 border-b border-slate-200" style={{ height: 32 }}>
                  <div className="flex-1 px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Descripción</div>
                  <div style={{ width: 88, flexShrink: 0 }} className="px-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-right">Largo</div>
                  <div style={{ width: 88, flexShrink: 0 }} className="px-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-right">Ancho</div>
                  <div style={{ width: 88, flexShrink: 0 }} className="px-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-right">Alto</div>
                  <div style={{ width: 80, flexShrink: 0 }} className="px-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-right">Cant.</div>
                  <div style={{ width: 110, flexShrink: 0 }} className="px-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-right">Subtotal</div>
                  <div style={{ width: 220, flexShrink: 0 }} className="px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Rubro vinculado</div>
                  <div style={{ width: 36, flexShrink: 0 }} />
                </div>

                {/* Filas */}
                {filas.map((fila, idx) => {
                  const subtotal = subtotalFila(fila);
                  return (
                    <div
                      key={fila.id}
                      className={cn(
                        "flex items-center hover:bg-blue-50/20 transition-colors",
                        idx % 2 === 1 ? "bg-[#F8FAFC]" : "bg-white"
                      )}
                      style={{ height: 36, borderBottom: "1px solid #F1F5F9" }}
                    >
                      <div className="flex-1 px-3">
                        <input
                          type="text"
                          value={fila.descripcion}
                          onChange={(e) => actualizarFila(fila.id, "descripcion", e.target.value)}
                          placeholder="Descripción del elemento"
                          className={inputCls}
                        />
                      </div>
                      <div style={{ width: 88, flexShrink: 0 }} className="px-2">
                        <input
                          type="number"
                          value={fila.largo ?? ""}
                          onChange={(e) => actualizarFila(fila.id, "largo", e.target.value)}
                          placeholder="—"
                          className={cn(inputCls, "text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none")}
                        />
                      </div>
                      <div style={{ width: 88, flexShrink: 0 }} className="px-2">
                        <input
                          type="number"
                          value={fila.ancho ?? ""}
                          onChange={(e) => actualizarFila(fila.id, "ancho", e.target.value)}
                          placeholder="—"
                          className={cn(inputCls, "text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none")}
                        />
                      </div>
                      <div style={{ width: 88, flexShrink: 0 }} className="px-2">
                        <input
                          type="number"
                          value={fila.alto ?? ""}
                          onChange={(e) => actualizarFila(fila.id, "alto", e.target.value)}
                          placeholder="—"
                          className={cn(inputCls, "text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none")}
                        />
                      </div>
                      <div style={{ width: 80, flexShrink: 0 }} className="px-2">
                        <input
                          type="number"
                          value={fila.cantidad ?? ""}
                          onChange={(e) => actualizarFila(fila.id, "cantidad", e.target.value)}
                          placeholder="—"
                          className={cn(inputCls, "text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none")}
                        />
                      </div>
                      <div style={{ width: 110, flexShrink: 0 }} className="px-2 text-right">
                        <span className={cn("text-sm font-semibold tabular-nums", subtotal > 0 ? "text-[#2563EB]" : "text-slate-300")}>
                          {subtotal > 0 ? fmtNum(subtotal) : "—"}
                        </span>
                      </div>
                      <div style={{ width: 220, flexShrink: 0 }} className="px-3">
                        <select
                          value={fila.rubroId ?? ""}
                          onChange={(e) => actualizarFila(fila.id, "rubroId", e.target.value)}
                          className={cn(inputCls, "cursor-pointer", !fila.rubroId && "text-slate-400")}
                        >
                          <option value="">Sin vincular</option>
                          {Object.entries(
                            rubrosDisponibles.reduce<Record<string, RubroOption[]>>((acc, r) => {
                              (acc[r.capituloNombre] ??= []).push(r);
                              return acc;
                            }, {})
                          ).map(([capNombre, rubros]) => (
                            <optgroup key={capNombre} label={capNombre}>
                              {rubros.map((r) => (
                                <option key={r.id} value={r.id}>{r.nombre}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                      <div style={{ width: 36, flexShrink: 0 }} className="flex items-center justify-center">
                        <button
                          onClick={() => eliminarFila(fila.id)}
                          className="text-slate-300 hover:text-red-500 transition-colors"
                          aria-label="Eliminar fila"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Agregar fila */}
                <div className="flex items-center pl-3" style={{ height: 32, borderTop: "1px solid #F1F5F9" }}>
                  <button
                    onClick={agregarFila}
                    className="flex items-center gap-1.5 text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Agregar fila
                  </button>
                </div>

                {/* Fila IA */}
                <div className="flex items-center gap-2 px-3 py-2.5 border-t border-slate-100 bg-[#F0F7FF]">
                  <Sparkles className="w-4 h-4 text-[#2563EB] flex-shrink-0" />
                  <input
                    type="text"
                    value={iaTexto}
                    onChange={(e) => setIaTexto(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && agregarFilaIA()}
                    placeholder="Describí el elemento (ej: tabique de durlock 2.40m x 3.10m, 4 unidades) y la IA completa la fila"
                    className="flex-1 min-w-0 text-sm text-slate-700 bg-white border border-blue-200 rounded-[8px] px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] placeholder:text-slate-400"
                  />
                  <button
                    onClick={agregarFilaIA}
                    disabled={!iaTexto.trim() || iaCargando}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-sm font-semibold transition-colors flex-shrink-0",
                      !iaTexto.trim() || iaCargando
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                        : "bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
                    )}
                  >
                    {iaCargando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    Generar fila
                  </button>
                </div>

                {/* Total general */}
                <div className="flex items-center border-t-2 border-slate-300 bg-white" style={{ height: 40 }}>
                  <div className="flex-1 px-3 text-sm font-bold text-slate-400 uppercase tracking-wide">Total general</div>
                  <div style={{ width: 88 }} />
                  <div style={{ width: 88 }} />
                  <div style={{ width: 88 }} />
                  <div style={{ width: 80 }} />
                  <div style={{ width: 110, flexShrink: 0 }} className="px-2 text-right">
                    <span className="text-base font-bold tabular-nums" style={{ color: "#1A3A5C" }}>
                      {fmtNum(totalGeneral)}
                    </span>
                  </div>
                  <div style={{ width: 220 }} />
                  <div style={{ width: 36 }} />
                </div>
              </div>
            </div>
          </div>

          {/* ── Calculadora rápida ────────────────────────────── */}
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => setMostrarCalculadora((v) => !v)}
              className="relative flex items-center justify-center gap-2 w-full py-3 rounded-[12px] border border-slate-300 text-slate-500 hover:text-slate-700 hover:border-slate-400 font-medium text-sm transition-colors bg-white"
            >
              <Calculator className="w-4 h-4" />
              Calculadora rápida
              <ChevronDown
                className={cn("w-4 h-4 absolute right-4 transition-transform", mostrarCalculadora && "rotate-180")}
              />
            </button>
            <AnimatePresence initial={false}>
              {mostrarCalculadora && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="rounded-[12px] border border-slate-300 bg-white p-3 max-w-xs">
                    <CalculadoraInline />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Divisor arrastrable — solo desktop, solo con un documento abierto y sin expandir ── */}
        {documentoAbierto && !visorExpandido && (
          <div
            onMouseDown={iniciarResizeVisor}
            title="Arrastrar para redimensionar"
            className="hidden lg:flex items-stretch w-2.5 flex-shrink-0 cursor-col-resize group relative z-10"
          >
            <div className="w-px mx-auto bg-slate-200 group-hover:bg-[#2563EB] group-active:bg-[#2563EB] transition-colors" />
          </div>
        )}

        {/* ── Visor (panel lateral, ver UI_UX_REDESIGN.md 2quinquies) ── */}
        {documentoAbierto && (
          <Visor
            documentoPrincipal={documentoAbierto}
            todosLosDocumentos={todosLosDocumentos}
            onSeleccionarDocumento={seleccionarDesdeVisor}
            ventanaFlotante={ventanaFlotante}
            onCerrarVentanaFlotante={() => setVentanaFlotante(null)}
            onClose={cerrarVisor}
            expandido={visorExpandido}
            onToggleExpandir={() => setVisorExpandido((v) => !v)}
            notas={notas}
            onGuardarNotas={guardarNotas}
            imagenesParaIA={imagenesParaIA}
            onAnalizarConIA={analizarConIA}
            style={isDesktop ? { width: visorExpandido ? "100%" : `${anchoVisorPct}%` } : undefined}
          />
        )}
        {cargandoDetalleDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
            <Loader2 className="w-6 h-6 animate-spin text-white" />
          </div>
        )}
      </div>

      {/* ── Modal: elementos detectados por IA ────────────── */}
      <AnimatePresence>
        {elementosDetectados && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4"
            onClick={cerrarPanelAnalisis}
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-[16px] shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#2563EB]" />
                  <span className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">
                    Elementos detectados
                  </span>
                </div>
                <button
                  onClick={cerrarPanelAnalisis}
                  className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  aria-label="Cerrar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-auto px-5 py-4 space-y-2">
                {elementosDetectados.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">
                    No se detectaron elementos medibles en las imágenes.
                  </p>
                ) : (
                  elementosDetectados.map((el, i) => (
                    <label
                      key={i}
                      className={cn(
                        "flex items-start gap-3 px-3 py-2.5 rounded-[10px] border cursor-pointer transition-colors",
                        seleccionados.has(i)
                          ? "border-[#2563EB] bg-blue-50/50"
                          : "border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={seleccionados.has(i)}
                        onChange={() => toggleSeleccionado(i)}
                        className="mt-0.5 w-4 h-4 accent-[#2563EB] flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-[#1A3A5C]">{el.descripcion}</span>
                          <span className="text-sm font-semibold text-[#2563EB] tabular-nums flex-shrink-0">
                            {fmtNum(el.subtotal)} {el.unidad}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {[
                            el.largo != null ? `L: ${fmtNum(el.largo)}` : null,
                            el.ancho != null ? `A: ${fmtNum(el.ancho)}` : null,
                            el.alto != null ? `H: ${fmtNum(el.alto)}` : null,
                            el.cantidad != null ? `Cant: ${el.cantidad}` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                        {el.nota && (
                          <p className="text-xs text-slate-400 italic mt-1">{el.nota}</p>
                        )}
                      </div>
                    </label>
                  ))
                )}

                {observacionesIA && (
                  <div className="mt-3 px-3 py-2.5 rounded-[10px] bg-[#F0F7FF] border border-blue-100">
                    <p className="text-xs text-slate-500">{observacionesIA}</p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-slate-200 flex-shrink-0">
                <span className="text-xs text-slate-400">
                  {seleccionados.size} de {elementosDetectados.length} seleccionados
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={cerrarPanelAnalisis}
                    className="px-3 py-2 rounded-[8px] text-sm font-medium text-slate-500 hover:bg-slate-100 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={agregarElementosSeleccionados}
                    disabled={seleccionados.size === 0}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2 rounded-[8px] text-sm font-semibold transition-colors",
                      seleccionados.size === 0
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                        : "bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
                    )}
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar seleccionados a la planilla
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ─── Calculadora rápida inline ──────────────────────────── */
function CalculadoraInline() {
  const [display, setDisplay] = useState("0");
  const [operacion, setOperacion] = useState("");
  const [valorPrevio, setValorPrevio] = useState("");
  const [esperandoOperando, setEsperandoOperando] = useState(false);

  const presionarNumero = (num: string) => {
    if (esperandoOperando) {
      setDisplay(num);
      setEsperandoOperando(false);
    } else {
      setDisplay(display === "0" ? num : display + num);
    }
  };

  const presionarOperacion = (op: string) => {
    setValorPrevio(display);
    setOperacion(op);
    setEsperandoOperando(true);
  };

  const calcular = () => {
    const prev = parseFloat(valorPrevio);
    const curr = parseFloat(display);
    let resultado = 0;
    if (operacion === "+") resultado = prev + curr;
    if (operacion === "-") resultado = prev - curr;
    if (operacion === "×") resultado = prev * curr;
    if (operacion === "÷") resultado = curr !== 0 ? prev / curr : 0;
    setDisplay(resultado % 1 === 0 ? resultado.toString() : resultado.toFixed(2));
    setOperacion("");
    setEsperandoOperando(true);
  };

  const limpiar = () => {
    setDisplay("0");
    setOperacion("");
    setValorPrevio("");
    setEsperandoOperando(false);
  };

  const btnCls = "h-9 rounded-lg text-sm font-medium transition-colors";

  return (
    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
      <div className="bg-white rounded-lg px-3 py-2 text-right text-lg font-mono font-semibold text-[#1A3A5C] mb-2 border border-slate-200 min-h-[40px]">
        {parseFloat(display).toLocaleString("es-UY")}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        <button onClick={limpiar} className={`${btnCls} col-span-2 bg-red-50 text-red-600 hover:bg-red-100`}>C</button>
        <button onClick={() => presionarOperacion("÷")} className={`${btnCls} bg-blue-50 text-[#2563EB] hover:bg-blue-100`}>÷</button>
        <button onClick={() => presionarOperacion("×")} className={`${btnCls} bg-blue-50 text-[#2563EB] hover:bg-blue-100`}>×</button>

        {["7", "8", "9"].map((n) => (
          <button key={n} onClick={() => presionarNumero(n)} className={`${btnCls} bg-white border border-slate-200 text-[#1E293B] hover:bg-slate-100`}>{n}</button>
        ))}
        <button onClick={() => presionarOperacion("-")} className={`${btnCls} bg-blue-50 text-[#2563EB] hover:bg-blue-100`}>−</button>

        {["4", "5", "6"].map((n) => (
          <button key={n} onClick={() => presionarNumero(n)} className={`${btnCls} bg-white border border-slate-200 text-[#1E293B] hover:bg-slate-100`}>{n}</button>
        ))}
        <button onClick={() => presionarOperacion("+")} className={`${btnCls} bg-blue-50 text-[#2563EB] hover:bg-blue-100`}>+</button>

        {["1", "2", "3"].map((n) => (
          <button key={n} onClick={() => presionarNumero(n)} className={`${btnCls} bg-white border border-slate-200 text-[#1E293B] hover:bg-slate-100`}>{n}</button>
        ))}
        <button onClick={calcular} className={`${btnCls} row-span-2 bg-[#2563EB] text-white hover:bg-blue-700`}>=</button>

        <button onClick={() => presionarNumero("0")} className={`${btnCls} col-span-2 bg-white border border-slate-200 text-[#1E293B] hover:bg-slate-100`}>0</button>
        <button onClick={() => presionarNumero(".")} className={`${btnCls} bg-white border border-slate-200 text-[#1E293B] hover:bg-slate-100`}>.</button>
      </div>
    </div>
  );
}
