"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Loader2, Send } from "lucide-react";

interface Sugerencia {
  id: string;
  mensaje: string;
  resuelta: boolean;
  createdAt: string;
}

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-UY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ItemSugerencia({
  sugerencia,
  actualizando,
  onToggle,
}: {
  sugerencia: Sugerencia;
  actualizando: boolean;
  onToggle: (id: string, valor: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3 bg-white rounded-xl border border-slate-200 p-4">
      <input
        type="checkbox"
        checked={sugerencia.resuelta}
        disabled={actualizando}
        onChange={(e) => onToggle(sugerencia.id, e.target.checked)}
        className="mt-1 w-4 h-4 flex-shrink-0 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB] disabled:opacity-50"
      />
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm leading-relaxed whitespace-pre-wrap ${
            sugerencia.resuelta ? "text-slate-400 line-through" : "text-slate-700"
          }`}
        >
          {sugerencia.mensaje}
        </p>
        <p className="text-xs text-slate-400 mt-1.5">{fmtFecha(sugerencia.createdAt)}</p>
      </div>
    </div>
  );
}

export default function SugerenciasPage() {
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState(false);
  const [confirmacion, setConfirmacion] = useState(false);
  const [mostrarResueltas, setMostrarResueltas] = useState(false);
  const [actualizandoIds, setActualizandoIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/sugerencias");
        if (res.ok) setSugerencias(await res.json());
      } catch {
        // silencioso — la lista simplemente queda vacía
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  async function enviar() {
    if (!mensaje.trim() || enviando) return;
    setEnviando(true);
    setErrorEnvio(false);
    try {
      const res = await fetch("/api/sugerencias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje }),
      });
      if (!res.ok) throw new Error();
      const nueva: Sugerencia = await res.json();
      setSugerencias((prev) => [nueva, ...prev]);
      setMensaje("");
      setConfirmacion(true);
      setTimeout(() => setConfirmacion(false), 3000);
    } catch {
      setErrorEnvio(true);
    } finally {
      setEnviando(false);
    }
  }

  // Optimista con rollback — mismo patrón que eliminarDocumento en
  // SeccionMetrajesPresupuesto.tsx: se refleja al toque, y si el PATCH
  // falla se revierte y no queda un estado fantasma en pantalla.
  async function toggleResuelta(id: string, valor: boolean) {
    setActualizandoIds((prev) => new Set(prev).add(id));
    setSugerencias((prev) => prev.map((s) => (s.id === id ? { ...s, resuelta: valor } : s)));
    try {
      const res = await fetch(`/api/sugerencias/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resuelta: valor }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setSugerencias((prev) => prev.map((s) => (s.id === id ? { ...s, resuelta: !valor } : s)));
    } finally {
      setActualizandoIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  const pendientes = sugerencias.filter((s) => !s.resuelta);
  const resueltas = sugerencias.filter((s) => s.resuelta);

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-semibold text-[#1A3A5C] mb-2">Sugerencias</h1>
      <p className="text-slate-500 mb-8">
        Buzón de feedback hacia el equipo de Cómputo+.
      </p>

      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-8">
        <textarea
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          placeholder="Mandá una idea, reportá un bug o pedí lo que le falta a la app…"
          rows={4}
          className="w-full px-3.5 py-3 rounded-[10px] border border-slate-300 bg-bg-base text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all resize-none"
        />
        <div className="flex items-center justify-between mt-3">
          <p className="text-sm">
            {confirmacion && (
              <span className="text-emerald-600 font-medium">¡Gracias! La recibimos.</span>
            )}
            {errorEnvio && (
              <span className="text-red-600 font-medium">No se pudo enviar. Probá de nuevo.</span>
            )}
          </p>
          <button
            onClick={enviar}
            disabled={!mensaje.trim() || enviando}
            className="flex items-center gap-1.5 px-4 py-2 rounded-[8px] bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors flex-shrink-0"
          >
            {enviando ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Enviar
          </button>
        </div>
      </div>

      {cargando ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : sugerencias.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-10">
          Todavía no se mandó ninguna sugerencia.
        </p>
      ) : (
        <>
          <div className="space-y-3">
            {pendientes.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">
                No hay sugerencias pendientes.
              </p>
            ) : (
              pendientes.map((s) => (
                <ItemSugerencia
                  key={s.id}
                  sugerencia={s}
                  actualizando={actualizandoIds.has(s.id)}
                  onToggle={toggleResuelta}
                />
              ))
            )}
          </div>

          {resueltas.length > 0 && (
            <div className="mt-6">
              <button
                onClick={() => setMostrarResueltas((v) => !v)}
                className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-[#2563EB] transition-colors"
              >
                Ver resueltas ({resueltas.length})
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${mostrarResueltas ? "rotate-180" : ""}`}
                />
              </button>
              {mostrarResueltas && (
                <div className="space-y-3 mt-3">
                  {resueltas.map((s) => (
                    <ItemSugerencia
                      key={s.id}
                      sugerencia={s}
                      actualizando={actualizandoIds.has(s.id)}
                      onToggle={toggleResuelta}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
