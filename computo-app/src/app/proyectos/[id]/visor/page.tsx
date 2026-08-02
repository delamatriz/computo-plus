"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import { X, Plus, Sparkles, Loader2, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { urlProxyDocumentoMetraje } from "@/lib/blob";
import { fmtNum, subtotalFila, nuevaFila, type MetrajeFila, type RubroOption } from "@/components/metrajes/metrajeFila";
import type { DocumentoResumen, DocumentoDetalle, MedicionDocumento } from "@/components/metrajes/documentoMetraje";
import type { NuevaMedicionInput } from "@/components/metrajes/Visor";

// Visor y PlanillaComputo (vía Visor) importan react-pdf (pdf.js), que
// revienta con "DOMMatrix is not defined" si su módulo se evalúa en el
// servidor. Esta página es "use client" pero de todos modos se renderiza
// una vez en el servidor (SSR normal de Next para el HTML inicial) — con
// ssr:false nunca se evalúan ahí, solo en el browser.
const Visor = dynamic(() => import("@/components/metrajes/Visor"), { ssr: false });
const PlanillaComputo = dynamic(() => import("@/components/metrajes/PlanillaComputo"), { ssr: false });

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

// Visor de "Documentación para metrar" — página propia (UI_UX_REDESIGN.md
// 2quinquies, ajuste post-implementación): antes vivía como estado de
// React dentro de la pestaña Presupuesto, compitiendo por alto/ancho con
// el header del proyecto y la fila de pestañas — eso dejaba muy poco
// espacio real para la lista de documentos y notas. Con ruta propia tiene
// toda la pantalla disponible (menos la navbar + un header simple acá).
export default function VisorProyectoPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const proyectoId = (params?.id as string) ?? "";
  const docInicialId = searchParams.get("doc");

  const [proyectoNombre, setProyectoNombre] = useState("");
  const [rubrosDisponibles, setRubrosDisponibles] = useState<RubroOption[]>([]);
  const [filas, setFilas] = useState<MetrajeFila[]>([nuevaFila()]);

  // Fila con IA
  const [iaTexto, setIaTexto] = useState("");
  const [iaCargando, setIaCargando] = useState(false);

  // Análisis de imágenes con IA — dispara desde el visor
  const [elementosDetectados, setElementosDetectados] = useState<ElementoDetectado[] | null>(null);
  const [observacionesIA, setObservacionesIA] = useState("");
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());

  // Las 3 categorías de documentos — acá solo para armar la lista
  // combinada del visor y las fotos para "Analizar con IA"; el
  // alta/listado/subida en sí vive en Documentación para metrar
  // (pestaña Presupuesto).
  const [planos, setPlanos] = useState<DocumentoResumen[]>([]);
  const [fotos, setFotos] = useState<DocumentoResumen[]>([]);
  const [detalles, setDetalles] = useState<DocumentoResumen[]>([]);
  const [eliminandoIds, setEliminandoIds] = useState<Set<string>>(new Set());

  const [documentoAbierto, setDocumentoAbierto] = useState<DocumentoDetalle | null>(null);
  const [ventanaFlotante, setVentanaFlotante] = useState<DocumentoDetalle | null>(null);
  const [cargandoDetalleDoc, setCargandoDetalleDoc] = useState(false);

  // Marcas de medición (Etapa 3 — herramienta de Línea) del documento
  // principal, para dibujarlas sobre el plano. Se recargan cada vez que
  // cambia el documento abierto.
  const [mediciones, setMediciones] = useState<MedicionDocumento[]>([]);

  // Notas — única por proyecto
  const [notas, setNotas] = useState("");

  // Visor expandido a pantalla completa — oculta la Planilla y la lista
  // interna de documentos para dar todo el espacio al documento
  // principal. No se persiste a propósito.
  const [visorExpandido, setVisorExpandido] = useState(false);

  /* Carga de las 3 categorías + proyecto (nombre, notas, rubros) */
  useEffect(() => {
    if (!proyectoId) return;
    let cancelado = false;
    (async () => {
      const [resPlanos, resFotos, resDetalles, resProyecto] = await Promise.allSettled([
        fetch(`/api/proyectos/${proyectoId}/documentos-metraje?categoria=PLANO`),
        fetch(`/api/proyectos/${proyectoId}/documentos-metraje?categoria=FOTO`),
        fetch(`/api/proyectos/${proyectoId}/documentos-metraje?categoria=DETALLE`),
        fetch(`/api/proyectos/${proyectoId}`),
      ]);
      if (cancelado) return;
      if (resPlanos.status === "fulfilled" && resPlanos.value.ok) {
        const data = await resPlanos.value.json();
        setPlanos(data.documentos ?? []);
      }
      if (resFotos.status === "fulfilled" && resFotos.value.ok) {
        const data = await resFotos.value.json();
        setFotos(data.documentos ?? []);
      }
      if (resDetalles.status === "fulfilled" && resDetalles.value.ok) {
        const data = await resDetalles.value.json();
        setDetalles(data.documentos ?? []);
      }
      if (resProyecto.status === "fulfilled" && resProyecto.value.ok) {
        const data = await resProyecto.value.json();
        setProyectoNombre(data.nombre ?? "");
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
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [proyectoId]);

  /* Documento inicial — viene por ?doc=<id> desde el botón "Ir al visor y
   * planilla de metraje" (o desde la flecha de un documento puntual en
   * Documentación para metrar). Sin query param, el visor abre vacío. */
  useEffect(() => {
    if (!proyectoId || !docInicialId) return;
    abrirComoPrincipal(docInicialId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyectoId, docInicialId]);

  const todosLosDocumentos = useMemo(
    () => [...planos, ...fotos, ...detalles],
    [planos, fotos, detalles]
  );

  async function abrirComoPrincipal(id: string) {
    setCargandoDetalleDoc(true);
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/documentos-metraje/${id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setDocumentoAbierto(data.documento);
      setVentanaFlotante(null);
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

  // Eliminar desde la lista del visor — si el documento eliminado era el
  // principal (o la ventana flotante), no cierra la página: pasa al
  // estado vacío del documento principal (mismo criterio ya decidido
  // cuando el Visor vivía dentro de Presupuesto).
  async function eliminarDocumento(doc: DocumentoResumen) {
    const { id } = doc;
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
    } finally {
      setEliminandoIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  // Carga las marcas de medición del documento principal cada vez que
  // cambia — solo tiene sentido para categoria=PLANO, pero no hace daño
  // pedirlo siempre (la lista simplemente da vacía para el resto).
  useEffect(() => {
    if (!documentoAbierto || documentoAbierto.categoria !== "PLANO") {
      setMediciones([]);
      return;
    }
    let cancelado = false;
    (async () => {
      try {
        const res = await fetch(`/api/proyectos/${proyectoId}/documentos-metraje/${documentoAbierto.id}/mediciones`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!cancelado) setMediciones(data.mediciones ?? []);
      } catch {
        if (!cancelado) setMediciones([]);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [documentoAbierto, proyectoId]);

  // Guarda una nueva marca de medición (Etapa 3, Línea o Área) y agrega
  // la fila correspondiente a la Planilla — mismo mecanismo que ya usan
  // "Analizar con IA"/agregarFilaIA: se agrega en memoria, no hay tabla
  // de filas persistida (ver metrajeFila.ts). Área no tiene columna
  // propia en la Planilla (solo Largo/Ancho/Alto/Cantidad genéricos) —
  // el valor calculado (m²) va en "largo", igual que la longitud de
  // Línea (m) — mismo campo para el "número calculado por esta fila"
  // sin importar la herramienta, en vez de repartirlo entre
  // Ancho×Alto sin ningún significado real para un polígono irregular.
  async function guardarMedicion(input: NuevaMedicionInput) {
    if (!documentoAbierto) return;
    const res = await fetch(`/api/proyectos/${proyectoId}/documentos-metraje/${documentoAbierto.id}/mediciones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    setMediciones((prev) => [...prev, data.medicion]);
    // La fila usa el id de la medición (en vez del id random de
    // nuevaFila()) para poder encontrarla y sacarla de la Planilla si la
    // medición se borra después — ver eliminarMedicion.
    setFilas((prev) => [
      ...prev,
      {
        ...nuevaFila(),
        id: data.medicion.id,
        descripcion: input.descripcion,
        largo: input.tipo === "AREA" ? input.areaReal : input.longitudReal,
        cantidad: input.repeticiones,
        rubroId: input.rubroId,
      },
    ]);
  }

  // Borra una marca de medición (corrección de un trazo mal hecho) — y la
  // fila que había generado en la Planilla, ya que comparten id.
  async function eliminarMedicion(medicionId: string) {
    if (!documentoAbierto) return;
    const res = await fetch(
      `/api/proyectos/${proyectoId}/documentos-metraje/${documentoAbierto.id}/mediciones/${medicionId}`,
      { method: "DELETE" }
    );
    if (!res.ok) throw new Error();
    setMediciones((prev) => prev.filter((m) => m.id !== medicionId));
    setFilas((prev) => prev.filter((f) => f.id !== medicionId));
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

  // Calibración de escala (Etapa 2 de "Metrajes con plano", Método B —
  // escala declarada). Solo se llama para el documento principal cuando
  // es categoria=PLANO (Visor solo muestra el banner/botón en ese caso).
  // No recalcula nada todavía — eso llega con las herramientas de
  // medición (Etapa 3, ronda futura).
  async function guardarCalibracion(escalaDeclarada: string, factorEscala: number) {
    if (!documentoAbierto) return;
    const res = await fetch(`/api/proyectos/${proyectoId}/documentos-metraje/${documentoAbierto.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ escalaDeclarada, factorEscala, metodoCalibracion: "DECLARADA" }),
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    setDocumentoAbierto(data.documento);
  }

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
      console.error("[visor] agregarFilaIA", err);
    } finally {
      setIaCargando(false);
    }
  };

  /* Analizar con IA el documento principal (si es imagen) + todas las
   * fotos de relevamiento del proyecto. */
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
    <div className="min-h-full flex flex-col" style={{ background: "#F8FAFC" }}>
      {/* ── Header simple — nombre del proyecto + volver. Sin el header
          completo del proyecto (Editar/Excel/PDF/Eliminar) ni las
          pestañas Presupuesto/Gestión de Obra/Certificación — pantalla
          de trabajo enfocada. ── */}
      <div className="bg-white border-b border-slate-200 px-4 md:px-6 py-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-sm md:text-base font-bold text-[#1A3A5C] truncate">
            {proyectoNombre || "Proyecto"}
            <span className="text-slate-400 font-normal"> — Visor y planilla de metraje</span>
          </h1>
          <button
            onClick={() => router.push(`/proyectos/${proyectoId}`)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-[8px] border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Cerrar y volver a Presupuesto
          </button>
        </div>
      </div>

      {/* ── Planilla (tope de alto propio, con scroll interno) + Visor
          (alto fijo cómodo) ──

          A diferencia del bloque anterior (que vivía dentro de la
          pestaña Presupuesto), acá NO forzamos todo el stack a caber en
          calc(100vh-Xpx): con Planilla + el header propio del Visor +
          Notas (alto fijo) compitiendo por una franja acotada del
          viewport, el panel de "Documentos" y el documento principal
          quedaban aplastados a ~70-90px — exactamente el problema que
          esta página nueva se suponía que resolvía. Ahora el Visor
          tiene un alto fijo cómodo (600px) y la página simplemente
          scrollea si el viewport es más bajo que eso — mucho mejor que
          un panel ilegible. ── */}
      <div className="px-4 md:px-6 py-4">
        <div className="flex flex-col gap-4">
          {!visorExpandido && (
            <div className="flex-shrink-0 max-h-[280px] overflow-y-auto">
              <PlanillaComputo
                filas={filas}
                rubrosDisponibles={rubrosDisponibles}
                totalGeneral={totalGeneral}
                iaTexto={iaTexto}
                iaCargando={iaCargando}
                onActualizarFila={actualizarFila}
                onAgregarFila={agregarFila}
                onEliminarFila={eliminarFila}
                onIaTextoChange={setIaTexto}
                onAgregarFilaIA={agregarFilaIA}
                onExportarExcel={exportarExcel}
              />
            </div>
          )}

          <div className="h-[600px]">
            <Visor
              documentoPrincipal={documentoAbierto}
              todosLosDocumentos={todosLosDocumentos}
              onSeleccionarDocumento={seleccionarDesdeVisor}
              onEliminarDocumento={eliminarDocumento}
              eliminandoIds={eliminandoIds}
              ventanaFlotante={ventanaFlotante}
              onCerrarVentanaFlotante={() => setVentanaFlotante(null)}
              onClose={() => router.push(`/proyectos/${proyectoId}`)}
              expandido={visorExpandido}
              onToggleExpandir={() => setVisorExpandido((v) => !v)}
              notas={notas}
              onGuardarNotas={guardarNotas}
              imagenesParaIA={imagenesParaIA}
              onAnalizarConIA={analizarConIA}
              onGuardarCalibracion={guardarCalibracion}
              rubrosDisponibles={rubrosDisponibles}
              mediciones={mediciones}
              onGuardarMedicion={guardarMedicion}
              onEliminarMedicion={eliminarMedicion}
            />
          </div>
        </div>
      </div>

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
    </div>
  );
}
