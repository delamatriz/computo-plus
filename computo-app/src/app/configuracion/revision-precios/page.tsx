"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Loader2, AlertTriangle, CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface MaterialSinPrecio {
  codigo: string;
  descripcion: string;
  unidad: string;
}

interface MaterialARevisar {
  codigo: string;
  descripcion: string;
  unidad: string;
  precioActual: number;
  precioSugerido: number | null;
  motivo: string | null;
  detalle: string | null;
  url: string | null;
}

const MOTIVO_LABEL: Record<string, string> = {
  variacion_alta: "Variación de precio alta",
  producto_no_encontrado: "Producto no encontrado en la fuente",
  fuente_no_disponible: "No se pudo consultar la fuente",
};

function fmtMoneda(n: number): string {
  return `$${n.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function RevisionPreciosPage() {
  const [sinPrecio, setSinPrecio] = useState<MaterialSinPrecio[]>([]);
  const [aRevisar, setARevisar] = useState<MaterialARevisar[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch("/api/precios-mtop/pendientes-revision");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSinPrecio(data.sinPrecio);
      setARevisar(data.aRevisar);
    } catch {
      setError("No se pudo cargar la cola de revisión.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const resolver = useCallback(async (codigo: string, body: { accion: string; precioManual?: number }) => {
    const res = await fetch(`/api/precios-mtop/${codigo}/resolver`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.mensaje || `HTTP ${res.status}`);
    }
    setSinPrecio((prev) => prev.filter((m) => m.codigo !== codigo));
    setARevisar((prev) => prev.filter((m) => m.codigo !== codigo));
  }, []);

  return (
    <div className="p-8 max-w-3xl">
      <Link href="/configuracion" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#2563EB] transition-colors mb-4">
        <ArrowLeft className="w-3.5 h-3.5" /> Configuración
      </Link>
      <h1 className="text-2xl font-semibold text-[#1A3A5C] mb-2">Cola de Revisión — Precios de Materiales</h1>
      <p className="text-slate-500 mb-8">
        Materiales que necesitan intervención manual — sin precio de referencia, o con una sugerencia de la IA
        pendiente de confirmar.
      </p>

      {cargando ? (
        <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-800 rounded-lg px-3 py-2.5 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={cargar} className="text-red-700 font-medium hover:underline flex-shrink-0">Reintentar</button>
        </div>
      ) : (
        <>
          <SeccionSinPrecio materiales={sinPrecio} onResolver={resolver} />
          <SeccionARevisar materiales={aRevisar} onResolver={resolver} />
        </>
      )}
    </div>
  );
}

function SeccionSinPrecio({
  materiales,
  onResolver,
}: {
  materiales: MaterialSinPrecio[];
  onResolver: (codigo: string, body: { accion: string; precioManual?: number }) => Promise<void>;
}) {
  const [valores, setValores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState<Record<string, boolean>>({});
  const [errores, setErrores] = useState<Record<string, string>>({});

  const guardar = async (codigo: string) => {
    const precio = Number(valores[codigo]);
    if (!Number.isFinite(precio) || precio <= 0) {
      setErrores((prev) => ({ ...prev, [codigo]: "Ingresá un precio mayor a 0" }));
      return;
    }
    setErrores((prev) => ({ ...prev, [codigo]: "" }));
    setGuardando((prev) => ({ ...prev, [codigo]: true }));
    try {
      await onResolver(codigo, { accion: "manual", precioManual: precio });
    } catch (err) {
      setErrores((prev) => ({ ...prev, [codigo]: err instanceof Error ? err.message : "Error al guardar" }));
    } finally {
      setGuardando((prev) => ({ ...prev, [codigo]: false }));
    }
  };

  return (
    <section id="sin-precio" className="mb-10 scroll-mt-20">
      <h2 className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide mb-1">
        Sin precio de referencia ({materiales.length})
      </h2>
      <p className="text-sm text-slate-500 mb-4">
        Estos materiales nunca tuvieron un precio cargado — ingresá uno para sacarlos de la cola.
      </p>

      {materiales.length === 0 ? (
        <p className="text-sm text-slate-400 bg-white rounded-xl border border-slate-200 px-4 py-6 text-center">
          No hay materiales sin precio pendientes.
        </p>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200 bg-slate-50">
                <th className="py-2.5 px-4 font-medium">Descripción</th>
                <th className="py-2.5 px-4 font-medium w-20">Unidad</th>
                <th className="py-2.5 px-4 font-medium w-40">Precio (UYU)</th>
                <th className="py-2.5 px-4 font-medium w-24"></th>
              </tr>
            </thead>
            <tbody>
              {materiales.map((m) => (
                <tr key={m.codigo} className="border-b border-slate-100 last:border-0">
                  <td className="py-2.5 px-4 text-[#1E293B]">{m.descripcion}</td>
                  <td className="py-2.5 px-4 text-slate-500">{m.unidad}</td>
                  <td className="py-2.5 px-4">
                    <input
                      type="number"
                      step="0.01"
                      value={valores[m.codigo] ?? ""}
                      onChange={(e) => setValores((prev) => ({ ...prev, [m.codigo]: e.target.value }))}
                      placeholder="0.00"
                      className="w-32 border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB]"
                    />
                    {errores[m.codigo] && <p className="text-xs text-red-600 mt-1">{errores[m.codigo]}</p>}
                  </td>
                  <td className="py-2.5 px-4">
                    <button
                      onClick={() => guardar(m.codigo)}
                      disabled={guardando[m.codigo]}
                      className="bg-[#2563EB] text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-[#1d4ed8] disabled:opacity-60 transition-colors"
                    >
                      {guardando[m.codigo] ? "Guardando…" : "Guardar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SeccionARevisar({
  materiales,
  onResolver,
}: {
  materiales: MaterialARevisar[];
  onResolver: (codigo: string, body: { accion: string; precioManual?: number }) => Promise<void>;
}) {
  return (
    <section id="a-revisar" className="scroll-mt-20">
      <h2 className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide mb-1">
        Precio sugerido a revisar ({materiales.length})
      </h2>
      <p className="text-sm text-slate-500 mb-4">
        La IA encontró un precio distinto al guardado (o no encontró nada) — revisá y elegí qué hacer.
      </p>

      {materiales.length === 0 ? (
        <p className="text-sm text-slate-400 bg-white rounded-xl border border-slate-200 px-4 py-6 text-center">
          No hay sugerencias de la IA pendientes de revisar.
        </p>
      ) : (
        <div className="space-y-3">
          {materiales.map((m) => (
            <TarjetaARevisar key={m.codigo} material={m} onResolver={onResolver} />
          ))}
        </div>
      )}
    </section>
  );
}

function TarjetaARevisar({
  material,
  onResolver,
}: {
  material: MaterialARevisar;
  onResolver: (codigo: string, body: { accion: string; precioManual?: number }) => Promise<void>;
}) {
  const [resolviendo, setResolviendo] = useState<"aceptar" | "mantener" | "manual" | null>(null);
  const [manualAbierto, setManualAbierto] = useState(false);
  const [precioManual, setPrecioManual] = useState("");
  const [error, setError] = useState<string | null>(null);

  const variacionPct =
    material.precioSugerido != null && material.precioActual !== 0
      ? ((material.precioSugerido - material.precioActual) / material.precioActual) * 100
      : null;

  const ejecutar = async (accion: "aceptar" | "mantener" | "manual") => {
    setError(null);
    if (accion === "manual") {
      const precio = Number(precioManual);
      if (!Number.isFinite(precio) || precio <= 0) {
        setError("Ingresá un precio mayor a 0");
        return;
      }
      setResolviendo("manual");
      try {
        await onResolver(material.codigo, { accion: "manual", precioManual: precio });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al guardar");
      } finally {
        setResolviendo(null);
      }
      return;
    }
    setResolviendo(accion);
    try {
      await onResolver(material.codigo, { accion });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setResolviendo(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="text-sm font-semibold text-[#1E293B]">{material.descripcion}</p>
          <p className="text-xs text-slate-400">{material.codigo}</p>
        </div>
        <span className="flex-shrink-0 flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 whitespace-nowrap">
          <AlertTriangle className="w-3 h-3" />
          {MOTIVO_LABEL[material.motivo ?? ""] ?? material.motivo ?? "Requiere verificación"}
        </span>
      </div>

      <div className="flex items-center gap-6 py-2">
        <div>
          <p className="text-[11px] text-slate-400 uppercase tracking-wide">Precio actual</p>
          <p className="text-sm font-semibold text-slate-700 tabular-nums">{fmtMoneda(material.precioActual)}</p>
        </div>
        {material.precioSugerido != null && (
          <div>
            <p className="text-[11px] text-slate-400 uppercase tracking-wide">Precio sugerido</p>
            <p className="text-sm font-semibold text-[#2563EB] tabular-nums">
              {fmtMoneda(material.precioSugerido)}
              {variacionPct != null && (
                <span className={cn("ml-1.5 text-xs font-medium", variacionPct > 0 ? "text-amber-600" : "text-emerald-600")}>
                  ({variacionPct > 0 ? "+" : ""}{variacionPct.toFixed(1)}%)
                </span>
              )}
            </p>
          </div>
        )}
      </div>

      {material.detalle && <p className="text-xs text-slate-500 italic mt-1">&quot;{material.detalle}&quot;</p>}
      {material.url && (
        <a
          href={material.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-[#2563EB] hover:underline mt-1"
        >
          <ExternalLink className="w-3 h-3" /> Ver fuente
        </a>
      )}

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-600 mt-2">
          <XCircle className="w-3.5 h-3.5 flex-shrink-0" /> {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-100">
        {material.precioSugerido != null && (
          <button
            onClick={() => ejecutar("aceptar")}
            disabled={resolviendo !== null}
            className="inline-flex items-center gap-1.5 bg-[#2563EB] text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-[#1d4ed8] disabled:opacity-60 transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> {resolviendo === "aceptar" ? "Aplicando…" : "Aceptar sugerido"}
          </button>
        )}
        <button
          onClick={() => ejecutar("mantener")}
          disabled={resolviendo !== null}
          className="inline-flex items-center gap-1.5 border border-slate-300 text-slate-600 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-slate-50 disabled:opacity-60 transition-colors"
        >
          <HelpCircle className="w-3.5 h-3.5" /> Mantener actual
        </button>

        {!manualAbierto ? (
          <button
            onClick={() => setManualAbierto(true)}
            disabled={resolviendo !== null}
            className="text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-60"
          >
            Cargar precio manual
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              step="0.01"
              value={precioManual}
              onChange={(e) => setPrecioManual(e.target.value)}
              placeholder="0.00"
              autoFocus
              className="w-28 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB]"
            />
            <button
              onClick={() => ejecutar("manual")}
              disabled={resolviendo !== null}
              className="bg-[#1A3A5C] text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-[#15304c] disabled:opacity-60 transition-colors"
            >
              {resolviendo === "manual" ? "Guardando…" : "Guardar"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
