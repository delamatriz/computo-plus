"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Loader2, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Descompuesto, fmtMoneda, type SubrubroEmpresa } from "@/components/mi-biblioteca/DescompuestoEmpresa";

// Pestaña "Mis rubros" del panel de subrubros del presupuesto: busca en la
// biblioteca personal de la empresa (GET /api/mi-biblioteca?q=, mismo
// buscador que /mi-biblioteca) y agrega el elegido al capítulo con su APU.
// Los precios de Mis rubros están en pesos.

export function PanelMisRubros({
  onAgregar,
  agregandoId,
}: {
  onAgregar: (subrubro: SubrubroEmpresa) => void;
  /** Rubro de Mis rubros que se está agregando (spinner en su botón). */
  agregandoId: string | null;
}) {
  const [subrubros, setSubrubros] = useState<SubrubroEmpresa[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [filtro, setFiltro] = useState("");
  // Total sin filtro: distingue "Mis rubros vacío" de "la búsqueda no encontró nada".
  const [hayAlguno, setHayAlguno] = useState<boolean | null>(null);
  const [abiertoId, setAbiertoId] = useState<string | null>(null);

  useEffect(() => {
    const q = filtro.trim();
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setCargando(true);
      fetch(`/api/mi-biblioteca${q ? `?q=${encodeURIComponent(q)}` : ""}`, { signal: controller.signal })
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((data: SubrubroEmpresa[]) => {
          setSubrubros(data);
          setError(false);
          if (!q) setHayAlguno(data.length > 0);
        })
        .catch((err) => {
          if (err?.name === "AbortError") return;
          console.error("[PanelMisRubros]", err);
          setError(true);
        })
        .finally(() => {
          if (!controller.signal.aborted) setCargando(false);
        });
    }, q ? 250 : 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [filtro]);

  if (hayAlguno === false && !filtro.trim() && !error) {
    return (
      <div className="px-3 py-4 text-center text-xs text-slate-500">
        Todavía no tenés rubros en Mis rubros. Creá uno desde{" "}
        <Link href="/mi-biblioteca" className="font-medium text-[#2563EB] hover:underline">
          Mis rubros
        </Link>{" "}
        o guardá uno desde un proyecto.
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-slate-300 absolute left-2.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Buscá por nombre del rubro…"
          aria-label="Buscar en Mis rubros"
          className="w-full pl-8 pr-3 py-1.5 text-xs bg-white rounded-[6px] border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30 focus:border-[#2563EB]/40 placeholder:text-slate-300"
        />
      </div>
      <div className={cn("max-h-80 overflow-y-auto rounded-[6px] border border-slate-100 bg-white transition-opacity", cargando && subrubros.length > 0 && "opacity-60")}>
        {error ? (
          <div className="px-3 py-2 text-xs text-red-600">No se pudieron cargar tus rubros.</div>
        ) : cargando && subrubros.length === 0 ? (
          <div className="px-3 py-2 text-xs text-slate-400 italic">Cargando…</div>
        ) : subrubros.length === 0 ? (
          <div className="px-3 py-2 text-xs text-slate-400 italic">Ninguno de tus rubros coincide con “{filtro.trim()}”.</div>
        ) : (
          subrubros.map((s) => {
            const apu = s.apus[0];
            const abierto = abiertoId === s.id;
            const agregando = agregandoId === s.id;
            return (
              <div key={s.id} className="border-b border-slate-100 last:border-0">
                <div className="flex items-center gap-2 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setAbiertoId(abierto ? null : s.id)}
                    disabled={!apu}
                    aria-expanded={abierto}
                    title={apu ? "Ver descompuesto" : undefined}
                    className="flex-1 min-w-0 flex items-center gap-2 text-left disabled:cursor-default"
                  >
                    <span className="flex-shrink-0 text-slate-400">
                      {abierto ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </span>
                    <span className="flex-1 min-w-0 text-xs font-semibold text-slate-700 leading-tight truncate">{s.nombre}</span>
                    <span className="flex-shrink-0 text-sm font-bold text-[#2563EB] tabular-nums whitespace-nowrap">
                      {fmtMoneda(s.precioUY)}/{s.unidad}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onAgregar(s)}
                    disabled={!apu || agregandoId !== null}
                    className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-[6px] text-[11px] font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] transition-colors disabled:opacity-50"
                  >
                    {agregando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    Agregar
                  </button>
                </div>
                {abierto && apu && <Descompuesto apu={apu} unidad={s.unidad} precioUY={s.precioUY} />}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
