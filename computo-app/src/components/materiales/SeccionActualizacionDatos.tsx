"use client";

// NOTA(multi-tenant): esta pantalla edita el catálogo/jornales
// compartido, pero en el futuro multi-tenant cada empresa va a tener su
// PROPIA copia editable aquí mismo (nace de una semilla de MTOP/SUNCA
// oficial) — esta UI no necesita restricción de rol, es edición normal
// por empresa. Lo que sí falta construir por separado es una pantalla
// de admin para mantener la plantilla maestra y propagarla a empresas
// existentes sin pisar sus cambios (ver Fase 3 del plan multi-tenant).
// Antes vivía en /configuracion, movida a /materiales porque es
// contenido específico de ese dominio.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Search, Square, Loader2, CheckCircle2, AlertTriangle, XCircle, Ban, RefreshCw } from "lucide-react";

interface MaterialElegible {
  codigo: string;
  descripcion: string;
  proveedor: string | null;
  precioUnitario: number;
  unidad: string;
}

// Mismo union que AccionVerificacion en lib/verificarPrecioMercado.ts —
// duplicado a propósito acá (tipo, no valor): ese archivo importa "@/lib/db"
// server-only, no se puede importar desde un componente "use client".
type AccionVerificacion = "actualizado" | "variacion_alta" | "no_encontrado" | "error" | "ya_no_elegible";

interface ResultadoVerificacionPrecio {
  codigo: string;
  descripcion: string;
  accion: AccionVerificacion;
  precioAnterior: number;
  precioNuevo: number | null;
  variacionPct: number | null;
  detalle: string;
}

// Tandas chicas disparadas una tras otra desde el navegador — cada fetch
// dura como mucho unos pocos minutos (4 materiales × ~20-90s cada uno),
// muy lejos de cualquier límite de la cadena (Render permite hasta 100
// min por request, pero sostener un solo fetch más de una hora es frágil
// igual). Si se corta a mitad de camino, se pierde como mucho esta tanda
// — los ya procesados dejan de ser elegibles en la base, así que volver a
// apretar el botón retoma solo con lo que falta, sin re-procesar nada.
const TAMANO_TANDA = 4;

function fmtMoneda(n: number): string {
  return `$${n.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const ACCION_INFO: Record<AccionVerificacion, { label: string; color: string; bg: string; Icon: typeof CheckCircle2 }> = {
  actualizado: { label: "Actualizado", color: "#16A34A", bg: "#F0FDF4", Icon: CheckCircle2 },
  variacion_alta: { label: "Requiere revisión", color: "#D97706", bg: "#FFFBEB", Icon: AlertTriangle },
  no_encontrado: { label: "No encontrado", color: "#64748B", bg: "#F1F5F9", Icon: AlertTriangle },
  error: { label: "Error", color: "#DC2626", bg: "#FEF2F2", Icon: XCircle },
  ya_no_elegible: { label: "Ya no elegible", color: "#64748B", bg: "#F1F5F9", Icon: Ban },
};

export default function SeccionActualizacionDatos() {
  const [elegibles, setElegibles] = useState<MaterialElegible[] | null>(null);
  const [cargandoElegibles, setCargandoElegibles] = useState(true);
  const [resultados, setResultados] = useState<ResultadoVerificacionPrecio[]>([]);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const detenerRef = useRef(false);

  const cargarElegibles = useCallback(async () => {
    setCargandoElegibles(true);
    setError(null);
    try {
      const res = await fetch("/api/configuracion/precios-mercado/elegibles");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setElegibles(data.elegibles);
      setResultados([]);
    } catch {
      setError("No se pudo cargar la lista de materiales pendientes de verificar.");
      setElegibles(null);
    } finally {
      setCargandoElegibles(false);
    }
  }, []);

  useEffect(() => {
    cargarElegibles();
  }, [cargarElegibles]);

  const codigosProcesados = useMemo(() => new Set(resultados.map((r) => r.codigo)), [resultados]);
  const pendientes = useMemo(
    () => (elegibles ?? []).filter((e) => !codigosProcesados.has(e.codigo)),
    [elegibles, codigosProcesados]
  );

  const ejecutar = useCallback(async () => {
    setProcesando(true);
    setError(null);
    detenerRef.current = false;

    // Resultados de ESTA corrida en particular — separado del estado
    // `resultados` (que acumula entre corridas dentro de la misma sesión de
    // pantalla), para que el resumen del Evento B sea el de esta corrida,
    // no el total acumulado si el usuario ya la había apretado antes.
    const resultadosDeEstaCorrida: ResultadoVerificacionPrecio[] = [];

    let cola = pendientes.map((e) => e.codigo);
    while (cola.length > 0 && !detenerRef.current) {
      const tanda = cola.slice(0, TAMANO_TANDA);
      cola = cola.slice(TAMANO_TANDA);
      try {
        const res = await fetch("/api/configuracion/precios-mercado/procesar-tanda", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ codigos: tanda }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const nuevos = data.resultados as ResultadoVerificacionPrecio[];
        resultadosDeEstaCorrida.push(...nuevos);
        setResultados((prev) => [...prev, ...nuevos]);
      } catch (err) {
        setError(
          `Se cortó procesando [${tanda.join(", ")}]: ${err instanceof Error ? err.message : String(err)}. Los anteriores ya quedaron aplicados — volvé a apretar "Buscar precios actualizados" para retomar con lo que falta.`
        );
        break;
      }
    }

    // Evento B — solo si esta corrida efectivamente procesó algo (abrir la
    // sección sin que hubiera pendientes, o detener antes de que termine la
    // primera tanda, no genera evento).
    if (resultadosDeEstaCorrida.length > 0) {
      const actualizados = resultadosDeEstaCorrida.filter((r) => r.accion === "actualizado").length;
      const pendientesRevision = resultadosDeEstaCorrida.length - actualizados;
      try {
        await fetch("/api/configuracion/precios-mercado/evento-resumen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actualizados, pendientesRevision, restantes: cola.length }),
        });
      } catch (err) {
        console.error("[evento-resumen]", err);
      }
    }

    setProcesando(false);
  }, [pendientes]);

  const detener = () => {
    detenerRef.current = true;
  };

  const totalElegibles = elegibles?.length ?? 0;
  const progresoPct = totalElegibles > 0 ? Math.round((resultados.length / totalElegibles) * 100) : 0;

  const resumen = useMemo(() => {
    const acc: Record<AccionVerificacion, number> = {
      actualizado: 0,
      variacion_alta: 0,
      no_encontrado: 0,
      error: 0,
      ya_no_elegible: 0,
    };
    for (const r of resultados) acc[r.accion]++;
    return acc;
  }, [resultados]);

  return (
    <section className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
      <h2 className="text-lg font-semibold text-[#1E293B] mb-1">
        Actualización de Precios — Mercado Libre
      </h2>
      <p className="text-sm text-slate-500 mb-1">
        Verifica contra la web el precio actual de los materiales de &quot;retail directo&quot; (proveedor conocido) —
        actualiza solo si la variación es chica; si es grande o no se encuentra, queda marcado para revisión manual.
      </p>
      <Link href="/configuracion/revision-precios" className="inline-block text-sm text-[#2563EB] hover:underline mb-4">
        Ver cola de revisión →
      </Link>

      {cargandoElegibles ? (
        <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando materiales pendientes…
        </div>
      ) : error && !elegibles ? (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 rounded-lg px-3 py-2.5 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={cargarElegibles} className="flex items-center gap-1 text-red-700 font-medium hover:underline flex-shrink-0">
            <RefreshCw className="w-3.5 h-3.5" /> Reintentar
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-600">
              {pendientes.length === 0 && totalElegibles > 0 ? (
                <span className="text-emerald-600 font-medium">Todos los materiales elegibles ya fueron verificados en esta corrida.</span>
              ) : totalElegibles === 0 ? (
                "No hay materiales pendientes de verificar por ahora."
              ) : (
                <>
                  <span className="font-semibold text-[#1E293B]">{resultados.length}</span> de{" "}
                  <span className="font-semibold text-[#1E293B]">{totalElegibles}</span> procesados
                </>
              )}
            </p>
            {!procesando ? (
              <button
                onClick={ejecutar}
                disabled={pendientes.length === 0}
                className="inline-flex items-center gap-2 bg-[#2563EB] text-white text-sm font-medium px-3.5 py-2 rounded-lg hover:bg-[#1d4ed8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Search className="w-4 h-4" />
                Buscar precios actualizados
              </button>
            ) : (
              <button
                onClick={detener}
                className="inline-flex items-center gap-2 border border-red-300 text-red-600 text-sm font-medium px-3.5 py-2 rounded-lg hover:bg-red-50 transition-colors"
              >
                <Square className="w-3.5 h-3.5" />
                Detener
              </button>
            )}
          </div>

          {totalElegibles > 0 && (
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-[#2563EB] transition-all duration-300"
                style={{ width: `${progresoPct}%` }}
              />
            </div>
          )}

          {procesando && (
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
              <Loader2 className="w-4 h-4 animate-spin" /> Procesando — esto puede tardar, podés dejar la pestaña abierta o volver más tarde y retomar.
            </div>
          )}

          {error && elegibles && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2.5 mb-3 text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {resultados.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-3 mb-3 text-xs">
                {(Object.keys(ACCION_INFO) as AccionVerificacion[])
                  .filter((k) => resumen[k] > 0)
                  .map((k) => {
                    const info = ACCION_INFO[k];
                    return (
                      <span
                        key={k}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full font-medium"
                        style={{ background: info.bg, color: info.color }}
                      >
                        <info.Icon className="w-3 h-3" /> {resumen[k]} {info.label.toLowerCase()}
                      </span>
                    );
                  })}
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr className="text-left text-slate-500 border-b border-slate-200">
                      <th className="py-2 px-3 font-medium">Código</th>
                      <th className="py-2 px-3 font-medium">Antes → Después</th>
                      <th className="py-2 px-3 font-medium">Variación</th>
                      <th className="py-2 px-3 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...resultados].reverse().map((r, i) => {
                      const info = ACCION_INFO[r.accion];
                      return (
                        <tr key={`${r.codigo}-${i}`} className="border-b border-slate-100 last:border-0" title={r.detalle}>
                          <td className="py-2 px-3 text-[#1E293B]">
                            {r.codigo}
                            <div className="text-xs text-slate-400 truncate max-w-xs">{r.descripcion}</div>
                          </td>
                          <td className="py-2 px-3 text-slate-600 tabular-nums whitespace-nowrap">
                            {fmtMoneda(r.precioAnterior)}
                            {r.precioNuevo != null && <> → {fmtMoneda(r.precioNuevo)}</>}
                          </td>
                          <td className="py-2 px-3 tabular-nums text-slate-500">
                            {r.variacionPct != null ? `${r.variacionPct.toFixed(1)}%` : "—"}
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
                              style={{ background: info.bg, color: info.color }}
                            >
                              <info.Icon className="w-3 h-3" /> {info.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
