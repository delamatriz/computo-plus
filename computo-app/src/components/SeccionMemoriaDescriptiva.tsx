"use client";

import { useState } from "react";
import { Sparkles, ChevronDown, ChevronRight, RefreshCw, Loader2, FileText, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  proyectoId: string;
  proyectoNombre: string;
  memoriaInicial: string | null;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* Convierte Markdown básico (encabezados, negrita, listas con "-") a HTML,
   para memorias generadas antes de que el modelo devolviera texto plano. */
function markdownBasicoAHtml(texto: string): string {
  const lineas = texto.split("\n");
  const html: string[] = [];
  let enLista = false;

  const cerrarLista = () => {
    if (enLista) {
      html.push("</ul>");
      enLista = false;
    }
  };

  for (const linea of lineas) {
    const trim = linea.trim();

    const heading = trim.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      cerrarLista();
      const nivel = Math.min(heading[1].length + 1, 6);
      html.push(`<h${nivel}>${formatInline(heading[2])}</h${nivel}>`);
      continue;
    }

    const item = trim.match(/^[-*]\s+(.*)$/);
    if (item) {
      if (!enLista) {
        html.push("<ul>");
        enLista = true;
      }
      html.push(`<li>${formatInline(item[1])}</li>`);
      continue;
    }

    cerrarLista();
    if (trim) html.push(`<p>${formatInline(trim)}</p>`);
  }
  cerrarLista();

  return html.join("\n");
}

function formatInline(texto: string): string {
  return escapeHtml(texto).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
}

export default function SeccionMemoriaDescriptiva({ proyectoId, proyectoNombre, memoriaInicial }: Props) {
  const [expandido, setExpandido] = useState(false);
  const [texto, setTexto] = useState(memoriaInicial ?? "");
  const [generando, setGenerando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmandoRegenerar, setConfirmandoRegenerar] = useState(false);

  async function generar() {
    setGenerando(true);
    setError(null);
    setConfirmandoRegenerar(false);
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/memoria-descriptiva`, { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTexto(data.memoriaDescriptiva ?? "");
    } catch {
      setError("No se pudo generar la memoria del presupuesto. Probá de nuevo.");
    } finally {
      setGenerando(false);
    }
  }

  async function guardar(valor: string) {
    if (valor === memoriaInicial) return;
    setGuardando(true);
    setGuardado(false);
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/memoria-descriptiva`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: valor }),
      });
      if (!res.ok) throw new Error();
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2000);
    } catch {
      setError("No se pudo guardar la edición.");
    } finally {
      setGuardando(false);
    }
  }

  function exportarWord() {
    const cuerpo = markdownBasicoAHtml(texto);
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Memoria del presupuesto</title></head>
<body style="font-family: 'DM Sans', Arial, sans-serif; font-size: 12pt; line-height: 1.5; color: #1E293B;">
<h1 style="color: #1A3A5C;">Memoria del Presupuesto</h1>
<h2 style="color: #1A3A5C; font-weight: normal;">${proyectoNombre}</h2>
${cuerpo}
</body></html>`;

    const blob = new Blob(["﻿", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Memoria-del-Presupuesto-${proyectoNombre.replace(/\s+/g, "-")}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mt-6 bg-white rounded-[16px] border border-slate-300 shadow-sm overflow-hidden">
      {/* Header colapsable */}
      <button
        onClick={() => setExpandido((p) => !p)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors text-left group"
      >
        <div className="flex items-center gap-2.5">
          <FileText className="w-4 h-4 text-[#2563EB]" />
          <h2 className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">Memoria del presupuesto</h2>
        </div>
        <span className="text-slate-400 group-hover:text-slate-600 transition-colors">
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
            className="overflow-hidden border-t border-slate-200"
          >
            <div className="px-5 py-5" style={{ background: "#F8FAFC" }}>
              {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

              {!texto ? (
                <div className="text-center py-8">
                  <p className="text-sm text-slate-400 mb-4">
                    Generá automáticamente la memoria del presupuesto del proyecto
                    a partir del presupuesto actual.
                  </p>
                  <button
                    onClick={generar}
                    disabled={generando}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1A3A5C] transition-colors disabled:opacity-60"
                  >
                    {generando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {generando ? "Generando..." : "Generar memoria del presupuesto"}
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <p className="text-xs text-slate-500">
                      {guardando ? "Guardando..." : guardado ? "Guardado ✓" : "Editable — los cambios se guardan al salir del campo."}
                    </p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={exportarWord}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-[8px] text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:border-[#2563EB]/40 hover:text-[#2563EB] transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Exportar a Word
                      </button>
                      {confirmandoRegenerar ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-500">¿Sobrescribir el texto actual?</span>
                          <button
                            onClick={generar}
                            disabled={generando}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-[8px] text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-60"
                          >
                            {generando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            Sí, regenerar
                          </button>
                          <button
                            onClick={() => setConfirmandoRegenerar(false)}
                            className="px-2.5 py-1.5 rounded-[8px] text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmandoRegenerar(true)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-[8px] text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:border-[#2563EB]/40 hover:text-[#2563EB] transition-colors"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Regenerar
                        </button>
                      )}
                    </div>
                  </div>

                  <textarea
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    onBlur={(e) => guardar(e.target.value)}
                    rows={18}
                    className="w-full rounded-[12px] border border-slate-200 bg-white p-4 text-sm text-slate-700 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 resize-y"
                  />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
