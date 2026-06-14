"use client";

import { useState } from "react";
import { Sparkles, ChevronDown, ChevronRight, Plus, Check, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/* ─── Tipos ───────────────────────────────────────────────── */
interface MaterialSugerido {
  descripcion: string;
  unidad: string;
  rendimiento: number;
  precioUnit: number;
}

interface ManoObraSugerida {
  categoria: string;
  rendimiento: number;
  jornal: number;
}

interface ApuSugerido {
  materiales: MaterialSugerido[];
  manoObra: ManoObraSugerida[];
  precioUnitarioEstimado: number;
}

interface PartidaFaltante {
  capitulo: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  cantidadEstimada: number;
  justificacion: string;
  apu: ApuSugerido;
}

interface CapituloInfo {
  id: string;
  nombre: string;
}

interface Props {
  proyectoId: string;
  moneda: string;
  capitulos: CapituloInfo[];
  onAgregado?: () => void;
}

/* ─── Formato ─────────────────────────────────────────────── */
function fmtMoneda(v: number, moneda: string): string {
  if (!v) return "—";
  const fmt = Math.round(v).toLocaleString("es-UY");
  return moneda === "USD" ? `U$S ${fmt}` : `$ ${fmt}`;
}

/* ─── Componente principal ────────────────────────────────── */
export default function SeccionPartidasFaltantes({ proyectoId, moneda, capitulos, onAgregado }: Props) {
  const [expandido, setExpandido] = useState(false);
  const [analizando, setAnalizando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [faltantes, setFaltantes] = useState<PartidaFaltante[] | null>(null);
  const [agregandoIdx, setAgregandoIdx] = useState<number | null>(null);
  const [agregados, setAgregados] = useState<Set<number>>(new Set());

  async function analizar() {
    setAnalizando(true);
    setError(null);
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/detectar-faltantes`, { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setFaltantes(Array.isArray(data.faltantes) ? data.faltantes : []);
      setAgregados(new Set());
    } catch {
      setError("No se pudo analizar el presupuesto. Probá de nuevo.");
    } finally {
      setAnalizando(false);
    }
  }

  async function agregar(idx: number) {
    if (!faltantes) return;
    const f = faltantes[idx];
    setAgregandoIdx(idx);
    try {
      // Buscar capítulo existente por nombre (case-insensitive) o crear uno nuevo
      let capituloId = capitulos.find(
        (c) => c.nombre.trim().toLowerCase() === f.capitulo.trim().toLowerCase()
      )?.id;

      if (!capituloId) {
        const resCap = await fetch(`/api/proyectos/${proyectoId}/capitulos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre: f.capitulo }),
        });
        if (!resCap.ok) throw new Error();
        const cap = await resCap.json();
        capituloId = cap.id;
      }

      // Crear rubro vacío dentro del capítulo
      const resRubro = await fetch(`/api/capitulos/${capituloId}/rubros`, { method: "POST" });
      if (!resRubro.ok) throw new Error();
      const rubro = await resRubro.json();

      // Completar datos del rubro
      const resPatch = await fetch(`/api/rubros/${rubro.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descripcion: f.descripcion,
          unidad: f.unidad,
          cantidad: f.cantidadEstimada,
          precioUnit: f.apu.precioUnitarioEstimado,
        }),
      });
      if (!resPatch.ok) throw new Error();

      // Crear APU asociado
      const resApu = await fetch(`/api/rubros/${rubro.id}/apu`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materiales: f.apu.materiales.map((m) => ({
            descripcion: m.descripcion,
            unidad: m.unidad,
            rendimiento: m.rendimiento,
            precioUnit: m.precioUnit,
          })),
          manoObra: f.apu.manoObra.map((mo) => ({
            categoria: mo.categoria,
            jornadaHs: 8,
            rendimiento: mo.rendimiento,
            jornalRef: mo.jornal,
          })),
          equipos: [],
        }),
      });
      if (!resApu.ok) throw new Error();

      setAgregados((prev) => new Set(prev).add(idx));
      onAgregado?.();
    } catch {
      setError("No se pudo agregar la partida. Probá de nuevo.");
    } finally {
      setAgregandoIdx(null);
    }
  }

  return (
    <div className="mt-6 bg-white rounded-[16px] border border-slate-300 shadow-sm overflow-hidden">
      {/* Header colapsable */}
      <button
        onClick={() => setExpandido((p) => !p)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors text-left group"
      >
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-4 h-4 text-[#2563EB]" />
          <h2 className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">Detección de partidas faltantes</h2>
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
              <div className="flex items-center justify-between gap-3 mb-4">
                <p className="text-xs text-slate-500 max-w-md">
                  La IA analiza tu presupuesto y te sugiere rubros que probablemente
                  faltan, con APU y precios estimados listos para agregar.
                </p>
                <button
                  onClick={analizar}
                  disabled={analizando}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1A3A5C] transition-colors disabled:opacity-60 flex-shrink-0"
                >
                  {analizando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {analizando ? "Analizando..." : "Analizar presupuesto"}
                </button>
              </div>

              {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

              {faltantes !== null && faltantes.length === 0 && !error && (
                <p className="text-xs text-slate-400 italic">
                  No se detectaron partidas faltantes evidentes en este presupuesto.
                </p>
              )}

              {faltantes && faltantes.length > 0 && (
                <div className="space-y-3">
                  {faltantes.map((f, idx) => (
                    <div key={idx} className="rounded-[12px] border border-slate-200 bg-white overflow-hidden">
                      <div className="px-4 py-3 flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {f.capitulo}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-400">· {f.codigo}</span>
                          </div>
                          <p className="text-sm font-medium text-[#1E293B]">{f.descripcion}</p>
                          <p className="text-xs text-slate-500 mt-1">{f.justificacion}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                            <span>Cant. estimada: <strong className="text-slate-700">{f.cantidadEstimada} {f.unidad}</strong></span>
                            <span>Precio unit.: <strong className="text-slate-700">{fmtMoneda(f.apu.precioUnitarioEstimado, moneda)}</strong></span>
                            <span>Total: <strong className="text-[#2563EB]">{fmtMoneda(f.apu.precioUnitarioEstimado * f.cantidadEstimada, moneda)}</strong></span>
                          </div>
                        </div>
                        <button
                          onClick={() => agregar(idx)}
                          disabled={agregandoIdx === idx || agregados.has(idx)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-[8px] text-xs font-medium transition-colors flex-shrink-0 disabled:opacity-60"
                          style={
                            agregados.has(idx)
                              ? { background: "#F0FDF4", color: "#16A34A" }
                              : { background: "#EFF6FF", color: "#2563EB" }
                          }
                        >
                          {agregandoIdx === idx ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : agregados.has(idx) ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Plus className="w-3.5 h-3.5" />
                          )}
                          {agregados.has(idx) ? "Agregado" : "Agregar"}
                        </button>
                      </div>

                      {/* APU sugerido */}
                      <div className="border-t border-slate-100 px-4 py-3 bg-slate-50">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">APU sugerido</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1">Materiales</p>
                            <ul className="space-y-0.5">
                              {f.apu.materiales.map((m, i) => (
                                <li key={i} className="text-xs text-slate-600 flex justify-between gap-2">
                                  <span className="truncate">{m.descripcion}</span>
                                  <span className="tabular-nums text-slate-400 flex-shrink-0">
                                    {m.rendimiento} {m.unidad} × {fmtMoneda(m.precioUnit, moneda)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1">Mano de obra</p>
                            <ul className="space-y-0.5">
                              {f.apu.manoObra.map((mo, i) => (
                                <li key={i} className="text-xs text-slate-600 flex justify-between gap-2">
                                  <span className="truncate">{mo.categoria}</span>
                                  <span className="tabular-nums text-slate-400 flex-shrink-0">
                                    rend. {mo.rendimiento} · {fmtMoneda(mo.jornal, moneda)}/jornal
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
