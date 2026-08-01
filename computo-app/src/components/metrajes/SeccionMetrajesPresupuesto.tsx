"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import { X, Plus, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { urlProxyDocumentoMetraje } from "@/lib/blob";
import { fmtNum, subtotalFila, nuevaFila, type MetrajeFila, type RubroOption } from "@/components/metrajes/metrajeFila";
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
const PlanillaComputo = dynamic(() => import("@/components/metrajes/PlanillaComputo"), { ssr: false });

/* ─── Tipos ───────────────────────────────────────────────── */
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

  // Visor — Página 2. `visorAbierto` controla si el bloque Planilla+Visor
  // se muestra; `documentoAbierto` es el documento principal dentro de
  // ese visor y puede ser null (visor abierto pero sin documento
  // seleccionado todavía, ej. al entrar desde "Ir al visor y planilla de
  // metraje" sin tener ningún documento cargado).
  const [visorAbierto, setVisorAbierto] = useState(false);
  const [documentoAbierto, setDocumentoAbierto] = useState<DocumentoDetalle | null>(null);
  const [ventanaFlotante, setVentanaFlotante] = useState<DocumentoDetalle | null>(null);
  const [cargandoDetalleDoc, setCargandoDetalleDoc] = useState(false);

  // Notas — única por proyecto (ya no por documento), ver 2quinquies
  const [notas, setNotas] = useState("");

  // Visor expandido a pantalla completa — oculta la columna izquierda
  // (Planilla + Calculadora) y la lista interna del visor para dar todo
  // el ancho disponible al documento principal. No se persiste a
  // propósito, resetea al cerrar.
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
      setVisorAbierto(true);
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

  // Botón "Ir al visor y planilla de metraje" (dentro de Documentación
  // para metrar) — abre el visor con el primer documento disponible de
  // las 3 categorías, o vacío si todavía no hay ninguno cargado.
  function irAlVisor() {
    const primero = todosLosDocumentos[0];
    if (primero) {
      abrirComoPrincipal(primero.id);
    } else {
      setVisorAbierto(true);
    }
  }

  function cerrarVisor() {
    setVisorAbierto(false);
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
    if (documentoAbierto?.id === id) setDocumentoAbierto(null);
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

  return (
    <>
      {/* ── Página 1 — Documentación del llamado + Documentación para metrar, lado a lado (ver UI_UX_REDESIGN.md 2quinquies).
          Se oculta por completo mientras el Visor está abierto — reemplazo de contenido, no apilado
          (mismo patrón que el cambio entre pestañas Presupuesto/Gestión de Obra/Certificación). ── */}
      {!visorAbierto && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start mb-6">
          {documentacionLlamado}
          {proyectoId && (
            <SeccionDocumentacionParaMetrar
              proyectoId={proyectoId}
              estado={estadoDocumentos}
              eliminandoIds={eliminandoIds}
              onDocumentosActualizados={actualizarDocumentos}
              onAbrirDocumento={abrirComoPrincipal}
              onEliminarDocumento={eliminarDocumento}
              onIrAlVisor={irAlVisor}
            />
          )}
        </div>
      )}

      {/* ── Página 2 — Planilla de cómputo + Visor, columna redimensionable ── */}
      {visorAbierto && (
        <div ref={splitRef} className="w-full flex flex-col lg:flex-row gap-4 mb-6 lg:h-[75vh]">
          <div
            className={cn("w-full", !visorExpandido && "lg:w-[60%]", visorExpandido && "hidden")}
            style={isDesktop && !visorExpandido ? { width: `${100 - anchoVisorPct}%` } : undefined}
          >
            <PlanillaComputo
              filas={filas}
              rubrosDisponibles={rubrosDisponibles}
              totalGeneral={totalGeneral}
              iaTexto={iaTexto}
              iaCargando={iaCargando}
              mostrarCalculadora={mostrarCalculadora}
              onActualizarFila={actualizarFila}
              onAgregarFila={agregarFila}
              onEliminarFila={eliminarFila}
              onIaTextoChange={setIaTexto}
              onAgregarFilaIA={agregarFilaIA}
              onToggleCalculadora={() => setMostrarCalculadora((v) => !v)}
              onExportarExcel={exportarExcel}
            />
          </div>

          {/* ── Divisor arrastrable — solo desktop, sin expandir ── */}
          {!visorExpandido && (
            <div
              onMouseDown={iniciarResizeVisor}
              title="Arrastrar para redimensionar"
              className="hidden lg:flex items-stretch w-2.5 flex-shrink-0 cursor-col-resize group relative z-10"
            >
              <div className="w-px mx-auto bg-slate-200 group-hover:bg-[#2563EB] group-active:bg-[#2563EB] transition-colors" />
            </div>
          )}

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
        </div>
      )}
      {cargandoDetalleDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <Loader2 className="w-6 h-6 animate-spin text-white" />
        </div>
      )}

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
