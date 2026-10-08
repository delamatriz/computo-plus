"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import { Loader2, ArrowLeft, AlertTriangle } from "lucide-react";
import { subtotalFila, type MetrajeFila, type SeccionPlanilla, type RubroOption, type ActualizacionComputo } from "@/components/metrajes/metrajeFila";
import type { DocumentoResumen, DocumentoDetalle, MedicionDocumento, Anotacion } from "@/components/metrajes/documentoMetraje";
import type { NuevaMedicionInput, NuevaAnotacionInput, CambiosAnotacion, ControlesMedicion } from "@/components/metrajes/Visor";

// Visor y PlanillaComputo (vía Visor) importan react-pdf (pdf.js), que
// revienta con "DOMMatrix is not defined" si su módulo se evalúa en el
// servidor. Esta página es "use client" pero de todos modos se renderiza
// una vez en el servidor (SSR normal de Next para el HTML inicial) — con
// ssr:false nunca se evalúan ahí, solo en el browser.
const Visor = dynamic(() => import("@/components/metrajes/Visor"), { ssr: false });
const PlanillaComputo = dynamic(() => import("@/components/metrajes/PlanillaComputo"), { ssr: false });

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
  // Presupuesto entregado (FINALIZADO) — solo lectura, oculta "Aplicar al
  // presupuesto" (escribe cantidad/precioUnit en los rubros, ver guards
  // reales del lado del servidor en /api/proyectos/[id]/aplicar-computo).
  const [soloLectura, setSoloLectura] = useState(false);
  const [rubrosDisponibles, setRubrosDisponibles] = useState<RubroOption[]>([]);
  // Filas de la Planilla de cómputo — persistidas (FilaMetraje), a nivel
  // de PROYECTO (acumula filas de todos los documentos, no solo el
  // abierto — ver GET /api/proyectos/[id]/filas-metraje y el diseño
  // confirmado de "Aplicar al presupuesto").
  const [filas, setFilas] = useState<MetrajeFila[]>([]);
  // Secciones opcionales de la Planilla (también a nivel de proyecto) y la
  // sección ACTIVA: adonde van las filas nuevas (Agregar fila, IA, una
  // medición guardada en el plano). null = filas sueltas. Pasa a ser la
  // última sección creada o la que el usuario elige; no se persiste.
  const [secciones, setSecciones] = useState<SeccionPlanilla[]>([]);
  const [seccionActivaId, setSeccionActivaId] = useState<string | null>(null);
  // Aviso breve cuando completar/borrar Alto cambia la unidad de una
  // fila (ml→m² o m²→m³) y eso desvincula automáticamente el Rubro que
  // tenía puesto — ver actualizarFila. También avisa si se toca "Agregar
  // fila" sin un plano abierto (ver agregarFila). Se autolimpia solo, no
  // requiere que el usuario lo cierre a mano.
  const [avisoUnidad, setAvisoUnidad] = useState<string | null>(null);

  // Las 3 categorías de documentos — acá solo para armar la lista
  // combinada del visor; el alta/listado/subida en sí vive en
  // Documentación para metrar
  // (pestaña Presupuesto).
  const [planos, setPlanos] = useState<DocumentoResumen[]>([]);
  const [fotos, setFotos] = useState<DocumentoResumen[]>([]);
  const [detalles, setDetalles] = useState<DocumentoResumen[]>([]);
  const [eliminandoIds, setEliminandoIds] = useState<Set<string>>(new Set());

  const [documentoAbierto, setDocumentoAbierto] = useState<DocumentoDetalle | null>(null);
  const [ventanaFlotante, setVentanaFlotante] = useState<DocumentoDetalle | null>(null);
  const [cargandoDetalleDoc, setCargandoDetalleDoc] = useState(false);

  // Marcas de medición (Etapa 3 — Línea/Área) del documento principal,
  // para dibujarlas sobre el plano. Se recargan cada vez que cambia el
  // documento abierto.
  const [mediciones, setMediciones] = useState<MedicionDocumento[]>([]);

  // Controles de medición expuestos por el Visor (incluye
  // onIniciarAsignacionAncho) — el ícono de regla que arranca el modo
  // asignación vive en PlanillaComputo.tsx, renderizado acá como
  // hermano del Visor, así que necesita pasar por este estado para
  // bajar de un componente al otro (ver Visor.tsx, prop
  // onControlesMedicionListos del Visor exterior).
  const [controlesMedicion, setControlesMedicion] = useState<ControlesMedicion | null>(null);

  // Anotaciones (Trazo libre / Texto — no son medición) del documento
  // principal. Mismo mecanismo de carga que mediciones, pero endpoint y
  // tabla separados (ver prisma/schema.prisma).
  const [anotaciones, setAnotaciones] = useState<Anotacion[]>([]);

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
        setSoloLectura(data.estado === "FINALIZADO");
        setNotas(data.notas ?? "");
        const nombrePorTituloId = new Map<string, string>(
          (data.titulos ?? []).map((t: { id: string; nombre: string }) => [t.id, t.nombre])
        );
        // Todo proyecto tiene siempre ≥1 título (implícito o explícito,
        // ver POST /api/proyectos) — con ≤1 con contenido, tituloNombre
        // se manda null para no mostrar "NombreProyecto › Capítulo" en
        // el caso simple (mismo criterio que el resto de la app, ver
        // modoMultiTitulo en proyectos/[id]/page.tsx). Con 2+, sigue
        // poblado para desambiguar capítulos homónimos entre títulos.
        const titulosConContenido = new Set(
          (data.capitulos ?? []).map((c: { tituloId?: string | null }) => c.tituloId).filter(Boolean)
        );
        const modoMultiTitulo = titulosConContenido.size >= 2;
        const opciones: RubroOption[] = [];
        for (const cap of data.capitulos ?? []) {
          for (const rubro of cap.rubros ?? []) {
            opciones.push({
              id: rubro.id,
              nombre: rubro.descripcion || "Rubro sin nombre",
              capituloNombre: cap.nombre,
              tituloNombre: modoMultiTitulo && cap.tituloId ? nombrePorTituloId.get(cap.tituloId) ?? null : null,
              unidad: rubro.unidad ?? "",
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

  /* Filas de la Planilla de cómputo — a nivel de proyecto (ver comentario
     en la declaración de `filas` arriba). */
  useEffect(() => {
    if (!proyectoId) return;
    let cancelado = false;
    (async () => {
      try {
        const res = await fetch(`/api/proyectos/${proyectoId}/filas-metraje`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!cancelado) setFilas(data.filas ?? []);
      } catch {
        if (!cancelado) setFilas([]);
      }
      try {
        const res = await fetch(`/api/proyectos/${proyectoId}/secciones-planilla`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!cancelado) setSecciones(data.secciones ?? []);
      } catch {
        if (!cancelado) setSecciones([]);
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

  // Guarda una nueva marca de medición (Etapa 3, Línea o Área) y la fila
  // puente correspondiente en la Planilla (FilaMetraje.medicionId — ver
  // prisma/schema.prisma). Área no tiene columna propia en la Planilla
  // (solo Largo/Ancho/Alto/Cantidad genéricos) — el valor calculado (m²)
  // va en "largo", igual que la longitud de Línea (m) — mismo campo para
  // el "número calculado por esta fila" sin importar la herramienta, en
  // vez de repartirlo entre Ancho×Alto sin ningún significado real para
  // un polígono irregular. unidad nace null (igual que una fila manual)
  // en vez de autocompletarse por herramienta (ML/M2) — fijarla de
  // entrada bloqueaba el <select> de "Rubro vinculado" contra la mayoría
  // de los rubros del proyecto ni bien se creaba la fila, antes de que el
  // usuario eligiera nada. Hereda la unidad del primer rubro que se
  // vincule, como cualquier fila (ver PATCH /api/proyectos/[id]/filas-metraje/[filaId]).
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

    const resFila = await fetch(`/api/proyectos/${proyectoId}/documentos-metraje/${documentoAbierto.id}/filas-metraje`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        descripcion: input.descripcion,
        largo: input.tipo === "AREA" ? input.areaReal : input.tipo === "PUNTO" ? input.valorConteo : input.longitudReal,
        cantidad: input.repeticiones,
        unidad: null,
        rubroId: input.rubroId ?? null,
        medicionId: data.medicion.id,
        seccionId: seccionActivaId,
      }),
    });
    if (resFila.ok) {
      const dataFila = await resFila.json();
      setFilas((prev) => [...prev, dataFila.fila]);
    }
  }

  // "Eliminar del dibujo" (Visor): borra SOLO la marca del plano. Las filas
  // de la Planilla que salieron de ella quedan intactas, desvinculadas
  // (medicionId / medicionAnchoId en null), como filas cargadas a mano: el
  // server suelta el vínculo antes de borrar para que el cascade no se las
  // lleve (ver DELETE .../mediciones/[medicionId]?soloDibujo=1). Borrar el
  // registro sigue siendo la X de cada fila.
  async function eliminarMedicion(medicionId: string) {
    if (!documentoAbierto) return;
    const res = await fetch(
      `/api/proyectos/${proyectoId}/documentos-metraje/${documentoAbierto.id}/mediciones/${medicionId}?soloDibujo=1`,
      { method: "DELETE" }
    );
    if (!res.ok) throw new Error();
    const data: { filasDesvinculadas?: MetrajeFila[] } = await res.json();
    setMediciones((prev) => prev.filter((m) => m.id !== medicionId));
    const desvinculadas = new Map((data.filasDesvinculadas ?? []).map((f) => [f.id, f]));
    if (desvinculadas.size > 0) {
      setFilas((prev) => prev.map((f) => desvinculadas.get(f.id) ?? f));
    }
  }

  // Modo asignación (ver ControlesMedicion.medicionObjetivo en Visor.tsx)
  // — guarda el trazo de ancho como una medición más (queda visible en el
  // plano, mismo mecanismo que guardarMedicion) y completa el ANCHO de
  // filaId en vez de crear una fila nueva. El PATCH dispara el mismo
  // recálculo de unidad que editar Alto/Ancho a mano (Parte 1) y, si la
  // fila ya tenía una medición de ancho previa, el server la borra sola
  // (ver PATCH .../filas-metraje/[filaId]) — acá solo hace falta reflejar
  // esa baja en el estado local para que no quede un trazo huérfano.
  async function asignarAncho(filaId: string, input: NuevaMedicionInput) {
    if (!documentoAbierto) return;
    const res = await fetch(`/api/proyectos/${proyectoId}/documentos-metraje/${documentoAbierto.id}/mediciones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    setMediciones((prev) => [...prev, data.medicion]);

    // PUNTO nunca llega acá en la práctica — iniciarAsignacionAncho
    // fuerza herramienta a LINEA siempre (ver Visor.tsx) — pero el tipo
    // es la unión completa, así que se cubre el caso para que compile.
    const anchoReal =
      input.tipo === "LINEA" || input.tipo === "POLILINEA" ? input.longitudReal : input.tipo === "AREA" ? input.areaReal : input.valorConteo;
    const resFila = await fetch(`/api/proyectos/${proyectoId}/filas-metraje/${filaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ancho: anchoReal, medicionAnchoId: data.medicion.id }),
    });
    if (!resFila.ok) throw new Error();
    const dataFila = await resFila.json();
    setFilas((prev) => prev.map((f) => (f.id === filaId ? dataFila.fila : f)));
    if (dataFila.desvinculado) {
      setAvisoUnidad(`Se desvinculó de "${dataFila.desvinculado.nombre}" porque la unidad cambió a ${dataFila.desvinculado.unidadNueva}`);
      setTimeout(() => setAvisoUnidad(null), 5000);
    }
    if (dataFila.medicionEliminada) {
      setMediciones((prev) => prev.filter((m) => m.id !== dataFila.medicionEliminada));
    }
  }

  // Carga las anotaciones del documento principal — mismo mecanismo que
  // mediciones, endpoint separado.
  useEffect(() => {
    if (!documentoAbierto || documentoAbierto.categoria !== "PLANO") {
      setAnotaciones([]);
      return;
    }
    let cancelado = false;
    (async () => {
      try {
        const res = await fetch(`/api/proyectos/${proyectoId}/documentos-metraje/${documentoAbierto.id}/anotaciones`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!cancelado) setAnotaciones(data.anotaciones ?? []);
      } catch {
        if (!cancelado) setAnotaciones([]);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [documentoAbierto, proyectoId]);

  // Guarda una nueva anotación — sin fila en la Planilla (no mide nada,
  // ver comentario en prisma/schema.prisma).
  async function guardarAnotacion(input: NuevaAnotacionInput) {
    if (!documentoAbierto) return;
    const res = await fetch(`/api/proyectos/${proyectoId}/documentos-metraje/${documentoAbierto.id}/anotaciones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    setAnotaciones((prev) => [...prev, data.anotacion]);
  }

  async function eliminarAnotacion(anotacionId: string) {
    if (!documentoAbierto) return;
    const res = await fetch(
      `/api/proyectos/${proyectoId}/documentos-metraje/${documentoAbierto.id}/anotaciones/${anotacionId}`,
      { method: "DELETE" }
    );
    if (!res.ok) throw new Error();
    setAnotaciones((prev) => prev.filter((a) => a.id !== anotacionId));
  }

  // Mueve/redimensiona un Texto ya guardado (arrastrar sobre el plano).
  // Optimista: actualiza el estado local de una — el usuario ya vio el
  // resultado en vivo mientras arrastraba (ver ajusteTextoValores en
  // Visor.tsx) — y si el PATCH falla, revierte solo. Sin manejo de
  // error visible a propósito: es una edición de bajo riesgo (se puede
  // reintentar arrastrando de nuevo), no amerita un modal ni un banner.
  function actualizarAnotacion(anotacionId: string, cambios: CambiosAnotacion) {
    if (!documentoAbierto) return;
    const anterior = anotaciones.find((a) => a.id === anotacionId);
    if (!anterior) return;
    setAnotaciones((prev) => prev.map((a) => (a.id === anotacionId ? { ...a, ...cambios } : a)));
    fetch(`/api/proyectos/${proyectoId}/documentos-metraje/${documentoAbierto.id}/anotaciones/${anotacionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cambios),
    })
      .then((res) => {
        if (!res.ok) throw new Error();
      })
      .catch(() => {
        setAnotaciones((prev) => prev.map((a) => (a.id === anotacionId ? anterior : a)));
      });
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

  /* Filas de la planilla — persistidas, ver FilaMetraje en
     prisma/schema.prisma. crearFila() necesita un documento abierto
     (dueño de la fila nueva); actualizar/eliminar son a nivel de
     proyecto y no lo necesitan (ver rutas en /api/proyectos/[id]/filas-metraje). */
  async function crearFila(datos: {
    descripcion: string;
    largo?: number | null;
    ancho?: number | null;
    alto?: number | null;
    cantidad?: number | null;
    unidad?: string | null;
  }, seccionId?: string | null): Promise<MetrajeFila | null> {
    if (!documentoAbierto) return null;
    const res = await fetch(`/api/proyectos/${proyectoId}/documentos-metraje/${documentoAbierto.id}/filas-metraje`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...datos, seccionId: seccionId === undefined ? seccionActivaId : seccionId }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.fila as MetrajeFila;
  }

  const actualizarFila = async (id: string, field: keyof MetrajeFila, value: string) => {
    const nuevoValor: string | number | null =
      field === "descripcion" || field === "rubroId" || field === "unidad" || field === "seccionId"
        ? value || null
        : value === ""
        ? null
        : parseFloat(value);

    // Optimista para todo menos rubroId — ahí esperamos la respuesta del
    // server porque puede autocompletar `unidad` (ver diseño confirmado,
    // sección 4) y necesitamos ese valor reflejado en el estado.
    if (field !== "rubroId") {
      setFilas((prev) => prev.map((f) => (f.id === id ? { ...f, [field]: nuevoValor } : f)));
    }

    const res = await fetch(`/api/proyectos/${proyectoId}/filas-metraje/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: nuevoValor }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error || "No se pudo actualizar la fila");
      return;
    }
    const data = await res.json();
    setFilas((prev) => prev.map((f) => (f.id === id ? data.fila : f)));
    // Completar/borrar Alto puede haber cambiado la unidad y desvinculado
    // el Rubro que la fila tenía puesto — ver PATCH .../filas-metraje/[filaId].
    if (data.desvinculado) {
      setAvisoUnidad(`Se desvinculó de "${data.desvinculado.nombre}" porque la unidad cambió a ${data.desvinculado.unidadNueva}`);
      setTimeout(() => setAvisoUnidad(null), 5000);
    }
    // Vaciar Ancho a mano en una fila que tenía un ancho medido (ver
    // ícono de regla) borra esa medición vieja en el server para no
    // dejarla como trazo huérfano en el plano — hay que reflejarlo acá.
    if (data.medicionEliminada) {
      setMediciones((prev) => prev.filter((m) => m.id !== data.medicionEliminada));
    }
  };

  // Sin seccionId agrega a la sección activa; desde el "+" de una sección,
  // a esa sección (y la deja activa).
  const agregarFila = async (seccionId?: string | null) => {
    if (!documentoAbierto) {
      setAvisoUnidad("Abrí un plano en el visor para agregar filas: cada fila queda guardada junto a su documento.");
      setTimeout(() => setAvisoUnidad(null), 5000);
      return;
    }
    if (seccionId !== undefined) setSeccionActivaId(seccionId);
    const fila = await crearFila({ descripcion: "" }, seccionId);
    if (fila) setFilas((prev) => [...prev, fila]);
  };

  /* Secciones de la Planilla — ver SeccionPlanilla en prisma/schema.prisma.
     Las filas sueltas y las de cada sección suman todas al total general. */
  const agregarSeccion = async () => {
    const res = await fetch(`/api/proyectos/${proyectoId}/secciones-planilla`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      alert("No se pudo crear la sección");
      return;
    }
    const data = await res.json();
    setSecciones((prev) => [...prev, data.seccion]);
    setSeccionActivaId(data.seccion.id);
  };

  // Edición inline, optimista (igual que la descripción de una fila).
  const renombrarSeccion = (id: string, nombre: string) => {
    setSecciones((prev) => prev.map((s) => (s.id === id ? { ...s, nombre } : s)));
    fetch(`/api/proyectos/${proyectoId}/secciones-planilla/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre }),
    }).catch(() => {});
  };

  // Flechas subir/bajar — optimista; la respuesta del server trae el orden
  // real y se toma ese.
  const moverSeccion = async (id: string, direccion: -1 | 1) => {
    const i = secciones.findIndex((s) => s.id === id);
    const j = i + direccion;
    if (i < 0 || j < 0 || j >= secciones.length) return;
    const nuevas = [...secciones];
    [nuevas[i], nuevas[j]] = [nuevas[j], nuevas[i]];
    setSecciones(nuevas);
    const res = await fetch(`/api/proyectos/${proyectoId}/secciones-planilla/reordenar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: nuevas.map((s) => s.id) }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (data?.secciones) setSecciones(data.secciones);
  };

  // Las filas de la sección pasan a sueltas (FilaMetraje.seccionId tiene
  // onDelete: SetNull), no se borran. La confirmación la pide la Planilla.
  const eliminarSeccion = async (id: string) => {
    const res = await fetch(`/api/proyectos/${proyectoId}/secciones-planilla/${id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("No se pudo eliminar la sección");
      return;
    }
    setSecciones((prev) => prev.filter((s) => s.id !== id));
    setFilas((prev) => prev.map((f) => (f.seccionId === id ? { ...f, seccionId: null } : f)));
    if (seccionActivaId === id) setSeccionActivaId(null);
  };

  const agruparPorRubro = async () => {
    const res = await fetch(`/api/proyectos/${proyectoId}/secciones-planilla/agrupar-por-rubro`, { method: "POST" });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      alert(data?.error || "No se pudo agrupar por rubro");
      return;
    }
    setSecciones(data.secciones);
    setFilas(data.filas);
  };

  const eliminarFila = async (id: string) => {
    setFilas((prev) => prev.filter((f) => f.id !== id));
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/filas-metraje/${id}`, { method: "DELETE" });
      if (!res.ok) return;
      const data = await res.json();
      // Borrar la fila borra también sus mediciones asociadas (largo y/o
      // ancho medido con el ícono de regla) — ver DELETE
      // .../filas-metraje/[filaId]. Sin esto el trazo seguía visible en
      // el plano hasta el próximo reload, ya sin ninguna fila detrás.
      if (data.medicionesEliminadas?.length) {
        setMediciones((prev) => prev.filter((m) => !data.medicionesEliminadas.includes(m.id)));
      }
    } catch {
      // silencioso — la fila ya se sacó optimistamente; un fallo acá solo
      // deja el trazo en el plano hasta el próximo reload, no es crítico.
    }
  };

  const totalGeneral = useMemo(
    () => filas.reduce((s, f) => s + subtotalFila(f), 0),
    [filas]
  );

  /* Exportar a Excel — mismo orden que la Planilla: filas sueltas arriba
     y después cada sección con su nombre y su subtotal. */
  const exportarExcel = () => {
    const fecha = new Date().toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" });
    const wb = XLSX.utils.book_new();

    const filaExcel = (f: MetrajeFila): (string | number | null)[] => {
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
    };
    const conDescripcion = filas.filter((f) => f.descripcion.trim());
    const idsSecciones = new Set(secciones.map((s) => s.id));
    const bloquesSecciones = secciones.flatMap((s): (string | number | null)[][] => {
      const propias = conDescripcion.filter((f) => f.seccionId === s.id);
      const subtotal = propias.reduce((acc, f) => acc + subtotalFila(f), 0);
      return [
        [],
        [s.nombre.trim().toUpperCase() || "SECCIÓN SIN NOMBRE"],
        ...propias.map(filaExcel),
        [`Subtotal ${s.nombre.trim()}`, "", "", "", "", parseFloat(subtotal.toFixed(2)), ""],
      ];
    });

    const datos: (string | number | null)[][] = [
      [`METRAJES — ${proyectoNombre || "Proyecto"}`],
      [`Fecha de generación: ${fecha}`],
      [],
      ["DESCRIPCIÓN", "LARGO", "ANCHO", "ALTO", "CANT.", "SUBTOTAL", "RUBRO VINCULADO"],
      ...conDescripcion.filter((f) => !f.seccionId || !idsSecciones.has(f.seccionId)).map(filaExcel),
      ...bloquesSecciones,
      ...(secciones.length > 0 ? [[]] : []),
      ["TOTAL GENERAL", "", "", "", "", parseFloat(totalGeneral.toFixed(2)), ""],
    ];

    const ws = XLSX.utils.aoa_to_sheet(datos);
    ws["!cols"] = [{ wch: 36 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 28 }];

    XLSX.utils.book_append_sheet(wb, ws, "Metrajes");
    XLSX.writeFile(wb, `Metrajes-${(proyectoNombre || "proyecto").replace(/\s+/g, "-")}.xlsx`);
  };

  /* "Aplicar al presupuesto" — mismo endpoint para las dos etapas del
     flujo (ver /api/proyectos/[id]/aplicar-computo): sin `confirmar` es
     solo preview (no toca la base), con `confirmar: true` aplica de
     verdad. El modal en PlanillaComputo.tsx llama primero a la preview y
     recién en el segundo click a la de aplicar. */
  async function aplicarComputoPreview(): Promise<ActualizacionComputo[]> {
    const res = await fetch(`/api/proyectos/${proyectoId}/aplicar-computo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error("No se pudo calcular la actualización");
    const data = await res.json();
    return data.actualizaciones as ActualizacionComputo[];
  }

  async function aplicarComputoConfirmar(): Promise<ActualizacionComputo[]> {
    const res = await fetch(`/api/proyectos/${proyectoId}/aplicar-computo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmar: true }),
    });
    if (!res.ok) throw new Error("No se pudo aplicar al presupuesto");
    const data = await res.json();
    return data.actualizaciones as ActualizacionComputo[];
  }

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
                secciones={secciones}
                seccionActivaId={seccionActivaId}
                onElegirSeccionActiva={setSeccionActivaId}
                onAgregarSeccion={agregarSeccion}
                onRenombrarSeccion={renombrarSeccion}
                onMoverSeccion={moverSeccion}
                onEliminarSeccion={eliminarSeccion}
                onAgruparPorRubro={agruparPorRubro}
                rubrosDisponibles={rubrosDisponibles}
                totalGeneral={totalGeneral}
                onActualizarFila={actualizarFila}
                onAgregarFila={agregarFila}
                onEliminarFila={eliminarFila}
                onExportarExcel={exportarExcel}
                onAplicarComputoPreview={aplicarComputoPreview}
                onAplicarComputoConfirmar={aplicarComputoConfirmar}
                onMedirAnchoParaFila={controlesMedicion?.onIniciarAsignacionAncho}
                soloLectura={soloLectura}
              />
            </div>
          )}

          {/* Expandido: overlay fixed a toda la ventana del navegador —
              z-40, por debajo del modal de "Elementos detectados" (z-60)
              y del toast de desvinculación (z-120), así ambos se siguen
              viendo por encima si se disparan mientras el visor está
              expandido. */}
          <div className={visorExpandido ? "fixed inset-0 z-40" : "h-[600px]"}>
            <Visor
              nombreProyecto={proyectoNombre}
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
              onGuardarCalibracion={guardarCalibracion}
              mediciones={mediciones}
              onGuardarMedicion={guardarMedicion}
              onAsignarAncho={asignarAncho}
              onEliminarMedicion={eliminarMedicion}
              anotaciones={anotaciones}
              onGuardarAnotacion={guardarAnotacion}
              onEliminarAnotacion={eliminarAnotacion}
              onActualizarAnotacion={actualizarAnotacion}
              onControlesMedicionListos={setControlesMedicion}
            />
          </div>
        </div>
      </div>

      {cargandoDetalleDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <Loader2 className="w-6 h-6 animate-spin text-white" />
        </div>
      )}

      {/* Aviso breve de desvinculación automática (Alto cambió la unidad
          de la fila) — se autolimpia solo, ver actualizarFila. */}
      <AnimatePresence>
        {avisoUnidad && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[120] flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-[10px] px-4 py-2.5 shadow-lg max-w-md"
          >
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-xs text-amber-800">{avisoUnidad}</p>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
