"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import SeccionDocumentoMetraje from "./SeccionDocumentoMetraje";
import { CATEGORIAS, type CategoriaDocumento, type DocumentoResumen } from "./documentoMetraje";

interface EstadoCategoria {
  documentos: DocumentoResumen[];
  cargando: boolean;
  error: string | null;
}

// Card colapsable "Documentación para metrar" — mismo patrón visual,
// tamaño y color que SeccionDocumentacionLlamado.tsx (ver UI_UX_REDESIGN.md
// 2quinquies), para que las dos queden visualmente equivalentes una al
// lado de la otra. Al expandir, agrupa las 3 categorías independientes
// (Planos y documentos / Fotos de relevamiento / Detalles), cada una con
// su propio listado + subida vía SeccionDocumentoMetraje.
export default function SeccionDocumentacionParaMetrar({
  proyectoId,
  estado,
  eliminandoIds,
  onDocumentosActualizados,
  onAbrirDocumento,
  onEliminarDocumento,
}: {
  proyectoId: string;
  estado: Record<CategoriaDocumento, EstadoCategoria>;
  eliminandoIds: Set<string>;
  onDocumentosActualizados: (categoria: CategoriaDocumento, documentos: DocumentoResumen[]) => void;
  onAbrirDocumento: (id: string) => void;
  onEliminarDocumento: (id: string) => void;
}) {
  const [expandido, setExpandido] = useState(false);

  const totalDocumentos = CATEGORIAS.reduce((acc, c) => acc + estado[c.value].documentos.length, 0);

  return (
    <div
      className="rounded-[16px] border border-blue-200 shadow-sm overflow-hidden"
      style={{ background: "#F0F7FF" }}
    >
      <button
        onClick={() => setExpandido((p) => !p)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-blue-100/30 transition-colors text-left group"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">Documentación para metrar</h2>
            {totalDocumentos > 0 && (
              <span className="flex-shrink-0 flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-slate-200 text-slate-600 text-[9px] font-semibold">
                {totalDocumentos}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Planos, fotos y detalles para medir este proyecto.
          </p>
        </div>
        <span className="text-slate-400 group-hover:text-slate-600 transition-colors flex-shrink-0">
          {expandido ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expandido && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-blue-100"
          >
            <div className="px-5 py-4 space-y-5">
              {CATEGORIAS.map((c) => (
                <SeccionDocumentoMetraje
                  key={c.value}
                  proyectoId={proyectoId}
                  categoria={c.value}
                  documentos={estado[c.value].documentos}
                  cargando={estado[c.value].cargando}
                  error={estado[c.value].error}
                  eliminandoIds={eliminandoIds}
                  onDocumentosActualizados={(documentos) => onDocumentosActualizados(c.value, documentos)}
                  onAbrirDocumento={onAbrirDocumento}
                  onEliminarDocumento={onEliminarDocumento}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
