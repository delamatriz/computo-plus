"use client";

import { Fragment, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Cpu, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConsumoEmpresa, DetalleConsumoEmpresa, NivelConsumo, ResumenConsumoIA } from "@/lib/consumoIA";

// Panel /admin → Consumo IA (solo SUPERADMIN): gasto en la API de Anthropic por
// empresa en el mes en curso, contra el umbral de su plan. Al tocar una fila se
// abre el detalle: desglose por función, últimos 6 meses y comparación con el
// mes anterior. Datos de GET /api/admin/consumo-ia (lib/consumoIA.ts). El id
// "consumo-ia" es el ancla a la que llevan la campanita y el mail de alerta.

const ESTILO_NIVEL: Record<NivelConsumo, { etiqueta: string; clase: string }> = {
  NORMAL: { etiqueta: "Normal", clase: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  ATENCION: { etiqueta: "Atención", clase: "bg-amber-50 text-amber-800 border-amber-200" },
  ALERTA: { etiqueta: "Alerta", clase: "bg-red-50 text-red-700 border-red-200" },
};

const ETIQUETA_PLAN: Record<string, string> = { basico: "Básico", premium: "Premium", profesional: "Profesional", enterprise: "Enterprise" };

const usd = (v: number) => `USD ${v.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const entero = (v: number) => v.toLocaleString("es-UY");
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];
const fmtMes = (clave: string) => {
  const [a, m] = clave.split("-").map(Number);
  return `${MESES[m - 1]} ${String(a).slice(2)}`;
};

function Variacion({ actual, anterior }: { actual: number; anterior: number }) {
  if (anterior <= 0) return <span className="text-slate-400">sin datos del mes anterior</span>;
  const pct = ((actual - anterior) / anterior) * 100;
  return (
    <span className={cn("font-semibold tabular-nums", pct > 0 ? "text-red-600" : "text-emerald-600")}>
      {pct > 0 ? "+" : ""}
      {pct.toLocaleString("es-UY", { maximumFractionDigits: 0 })}%
    </span>
  );
}

function Detalle({ empresa }: { empresa: ConsumoEmpresa }) {
  const [detalle, setDetalle] = useState<DetalleConsumoEmpresa | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let vigente = true;
    fetch(`/api/admin/consumo-ia/${empresa.empresaId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: DetalleConsumoEmpresa) => vigente && setDetalle(d))
      .catch(() => vigente && setError(true));
    return () => {
      vigente = false;
    };
  }, [empresa.empresaId]);

  if (error) return <p className="px-5 py-4 text-sm text-red-600">No se pudo cargar el detalle.</p>;
  if (!detalle)
    return (
      <p className="px-5 py-4 text-sm text-slate-400 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Cargando detalle…
      </p>
    );

  const maximo = Math.max(...detalle.ultimosMeses.map((m) => m.costo), 0);
  return (
    <div className="px-5 py-4 grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] bg-slate-50/60">
      {/* Desglose por función */}
      <div className="min-w-0">
        <h3 className="text-xs font-bold uppercase tracking-wide text-[#1A3A5C] mb-2">Por función — este mes</h3>
        {detalle.porFuncion.length === 0 ? (
          <p className="text-sm text-slate-400">Sin llamadas este mes.</p>
        ) : (
          <div className="overflow-x-auto bg-white rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400 border-b border-slate-100">
                  <th className="px-3 py-2 font-semibold">Función</th>
                  <th className="px-3 py-2 font-semibold text-right">Llamadas</th>
                  <th className="px-3 py-2 font-semibold text-right">Tokens entrada</th>
                  <th className="px-3 py-2 font-semibold text-right">Tokens salida</th>
                  <th className="px-3 py-2 font-semibold text-right">Costo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {detalle.porFuncion.map((f) => (
                  <tr key={f.funcion}>
                    <td className="px-3 py-2 font-mono text-xs text-slate-600">{f.funcion}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{entero(f.llamadas)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">{entero(f.inputTokens)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">{entero(f.outputTokens)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-[#1E293B]">{usd(f.costo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Últimos 6 meses + comparación */}
      <div className="min-w-0">
        <h3 className="text-xs font-bold uppercase tracking-wide text-[#1A3A5C] mb-2">Últimos 6 meses</h3>
        {maximo <= 0 ? (
          <p className="text-sm text-slate-400">Sin consumo en los últimos 6 meses.</p>
        ) : (
          <div className="bg-white rounded-lg border border-slate-200 px-3 pt-3 pb-2">
            <div className="flex items-end gap-2 h-32">
              {detalle.ultimosMeses.map((m, i) => (
                <div key={m.mes} className="flex-1 flex flex-col items-center justify-end h-full min-w-0" title={`${fmtMes(m.mes)}: ${usd(m.costo)} · ${entero(m.llamadas)} llamadas`}>
                  <span className="text-[10px] tabular-nums text-slate-500 mb-1 whitespace-nowrap">{m.costo > 0 ? m.costo.toFixed(2) : ""}</span>
                  <div
                    className={cn("w-full rounded-t", i === detalle.ultimosMeses.length - 1 ? "bg-[#2563EB]" : "bg-[#1A3A5C]/40")}
                    style={{ height: `${Math.max((m.costo / maximo) * 100, m.costo > 0 ? 3 : 0)}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-1 border-t border-slate-100 pt-1">
              {detalle.ultimosMeses.map((m) => (
                <span key={m.mes} className="flex-1 text-center text-[10px] text-slate-400">{fmtMes(m.mes)}</span>
              ))}
            </div>
          </div>
        )}
        <p className="mt-3 text-sm text-slate-600">
          Este mes <span className="font-semibold text-[#1E293B] tabular-nums">{usd(detalle.gastoMes)}</span> · mes anterior{" "}
          <span className="tabular-nums">{usd(detalle.gastoMesAnterior)}</span> ·{" "}
          <Variacion actual={detalle.gastoMes} anterior={detalle.gastoMesAnterior} />
        </p>
      </div>
    </div>
  );
}

export function SeccionConsumoIA() {
  const [resumen, setResumen] = useState<ResumenConsumoIA | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [abiertaId, setAbiertaId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/consumo-ia")
      .then((r) => (r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`)))
      .then(setResumen)
      .catch((e) => setError(String(e)));
  }, []);

  // La campanita y el mail llevan a /admin#consumo-ia: con la tabla ya
  // cargada, se baja hasta la sección (el ancla nativa no la encuentra
  // porque al cargar la página todavía no existe).
  useEffect(() => {
    if (resumen && window.location.hash === "#consumo-ia") {
      document.getElementById("consumo-ia")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [resumen]);

  return (
    <section id="consumo-ia" className="mt-6 bg-white rounded-xl border border-slate-200 shadow-sm scroll-mt-6">
      <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center gap-x-2 gap-y-1">
        <Cpu className="w-4 h-4 text-[#1A3A5C]" />
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#1A3A5C]">Consumo IA</h2>
        {resumen && <span className="text-xs text-slate-400">mes en curso: {fmtMes(resumen.mes)}</span>}
        {resumen && (
          <span className="text-xs text-slate-400 sm:ml-auto">
            Umbrales — Básico: atención {usd(resumen.umbrales.basico.atencion)}, alerta {usd(resumen.umbrales.basico.alerta)} ·
            Premium: atención {usd(resumen.umbrales.premium.atencion)}, alerta {usd(resumen.umbrales.premium.alerta)}
          </span>
        )}
      </div>

      {error ? (
        <p className="px-5 py-4 text-sm text-red-600">No se pudo cargar el consumo ({error}).</p>
      ) : resumen === null ? (
        <p className="px-5 py-4 text-sm text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Cargando…</p>
      ) : resumen.empresas.length === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-400">No hay empresas activas ni en prueba.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400 border-b border-slate-100">
                <th className="px-5 py-2 font-semibold">Empresa</th>
                <th className="px-3 py-2 font-semibold">Plan</th>
                <th className="px-3 py-2 font-semibold text-right">Gasto mes</th>
                <th className="px-3 py-2 font-semibold text-right">Llamadas</th>
                <th className="px-3 py-2 font-semibold">Función más usada</th>
                <th className="px-3 py-2 font-semibold text-right">Mes anterior</th>
                <th className="px-5 py-2 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {resumen.empresas.map((e) => {
                const abierta = abiertaId === e.empresaId;
                return (
                  <Fragment key={e.empresaId}>
                    <tr
                      onClick={() => setAbiertaId(abierta ? null : e.empresaId)}
                      className={cn("cursor-pointer hover:bg-slate-50 transition-colors", abierta && "bg-slate-50")}
                      aria-expanded={abierta}
                    >
                      <td className="px-5 py-2.5 font-medium text-[#1E293B]">
                        <span className="inline-flex items-center gap-1.5">
                          {abierta ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                          {e.nombre}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {ETIQUETA_PLAN[e.plan] ?? e.plan}
                        {e.estado === "PRUEBA" && <span className="text-xs text-slate-400"> (prueba)</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-[#1E293B]">{usd(e.gastoMes)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{entero(e.llamadasMes)}</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{e.funcionMasUsada ?? "—"}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{usd(e.gastoMesAnterior)}</td>
                      <td className="px-5 py-2.5">
                        <span className={cn("inline-block px-2 py-0.5 rounded-full border text-xs font-semibold", ESTILO_NIVEL[e.nivel].clase)}>
                          {ESTILO_NIVEL[e.nivel].etiqueta}
                        </span>
                      </td>
                    </tr>
                    {abierta && (
                      <tr>
                        <td colSpan={7} className="p-0 border-t border-slate-100">
                          <Detalle empresa={e} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50 text-sm">
                <td className="px-5 py-2.5 font-bold text-[#1A3A5C]" colSpan={2}>
                  Total · promedio {usd(resumen.totales.promedioPorCliente)} por cliente
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums font-bold text-[#1A3A5C]">{usd(resumen.totales.gastoMes)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums font-bold text-[#1A3A5C]">{entero(resumen.totales.llamadasMes)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
