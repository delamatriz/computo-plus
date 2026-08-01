"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  type CategoriaDocumento,
  type DocumentoResumen,
} from "@/components/metrajes/documentoMetraje";

// SeccionDocumentacionParaMetrar (vía SeccionDocumentoMetraje) importa
// react-pdf (pdf.js), que revienta con "DOMMatrix is not defined" si su
// módulo se evalúa en el servidor. Esta sección vive dentro de la
// pestaña Presupuesto (página "use client"), pero de todos modos Next la
// renderiza una vez en el servidor para el HTML inicial — con ssr:false
// nunca se evalúa ahí, solo en el browser.
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

interface EstadoCategoria {
  documentos: DocumentoResumen[];
  cargando: boolean;
  error: string | null;
}

// Documentación del llamado + Documentación para metrar, lado a lado —
// Página 1 de la pestaña Presupuesto (ver UI_UX_REDESIGN.md 2quinquies).
// El Visor + Planilla de Cómputo ya NO viven acá: son una página propia
// (/proyectos/[id]/visor), porque compartir espacio con el header del
// proyecto y las pestañas Presupuesto/Gestión de Obra/Certificación
// dejaba muy poco alto real disponible (la lista de documentos/notas
// quedaba tapada). El botón "Ir al visor y planilla de metraje" navega
// a esa ruta en vez de cambiar un estado interno.
export default function SeccionMetrajesPresupuesto({
  proyectoId,
  documentacionLlamado,
}: {
  proyectoId: string;
  /** La card "Documentación del llamado", ya renderizada por la página
   * padre — se ubica al lado de "Documentación para metrar" en la misma
   * fila (ver UI_UX_REDESIGN.md sección 2quinquies). */
  documentacionLlamado: React.ReactNode;
}) {
  const router = useRouter();

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

  function actualizarDocumentos(categoria: CategoriaDocumento, documentos: DocumentoResumen[]) {
    if (categoria === "PLANO") setPlanos(documentos);
    else if (categoria === "FOTO") setFotos(documentos);
    else setDetalles(documentos);
  }

  // La flecha "Abrir en el visor" de cada documento y el botón "Ir al
  // visor y planilla de metraje" navegan a la página propia del Visor —
  // ya no abren un estado interno acá.
  function irAlVisorConDocumento(id: string) {
    router.push(`/proyectos/${proyectoId}/visor?doc=${id}`);
  }

  function irAlVisor() {
    const primero = planos[0] ?? fotos[0] ?? detalles[0];
    router.push(primero ? `/proyectos/${proyectoId}/visor?doc=${primero.id}` : `/proyectos/${proyectoId}/visor`);
  }

  async function eliminarDocumento(id: string) {
    setEliminandoIds((prev) => new Set(prev).add(id));
    const anteriores = { planos, fotos, detalles };
    setPlanos((prev) => prev.filter((d) => d.id !== id));
    setFotos((prev) => prev.filter((d) => d.id !== id));
    setDetalles((prev) => prev.filter((d) => d.id !== id));
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start mb-6">
      {documentacionLlamado}
      {proyectoId && (
        <SeccionDocumentacionParaMetrar
          proyectoId={proyectoId}
          estado={estadoDocumentos}
          eliminandoIds={eliminandoIds}
          onDocumentosActualizados={actualizarDocumentos}
          onAbrirDocumento={irAlVisorConDocumento}
          onEliminarDocumento={eliminarDocumento}
          onIrAlVisor={irAlVisor}
        />
      )}
    </div>
  );
}
