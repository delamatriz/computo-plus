"use client";

import { useState, useCallback, useMemo } from "react";
import { Scale, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

/* ─── Tipos ───────────────────────────────────────────────── */
interface RubroCosto {
  id: string;
  cantidad: number | null;
  precioUnit: number | null;
}

interface CapituloCosto {
  id: string;
  nombre: string;
  codigo?: string;
  rubros?: RubroCosto[];
}

interface CapituloVinculoCompromiso {
  capituloId: string;
}

interface Subcontratista {
  id: string;
  montoContratado: number | null;
  moneda: string;
  estado: string;
  capitulos: CapituloVinculoCompromiso[];
}

interface OrdenCompra {
  id: string;
  monto: number | null;
  moneda: string;
  estado: string;
  capitulos: CapituloVinculoCompromiso[];
}

interface Props {
  proyectoId: string;
  moneda: string;
  capitulos: CapituloCosto[];
}

/* ─── Formato ─────────────────────────────────────────────── */
function fmtMoneda(v: number, moneda: string): string {
  const fmt = Math.round(v).toLocaleString("es-UY");
  return moneda === "USD" ? `US$ ${fmt}` : `$ ${fmt}`;
}

function totalRubroC(r: RubroCosto): number {
  if (r.cantidad == null || r.precioUnit == null) return 0;
  return r.cantidad * r.precioUnit;
}

function presupuestadoCapitulo(cap: CapituloCosto): number {
  return (cap.rubros ?? []).reduce((s, r) => s + totalRubroC(r), 0);
}

/* ─── Cálculo de comprometido por moneda, por capítulo ────── */
// Cancelado no cuenta como compromiso real — un subcontrato o una orden
// cancelados ya no representan una salida de plata esperada, mismo
// criterio que llevó a que "Cancelado" reemplace el borrado en esos
// módulos (el registro queda, pero deja de pesar acá).
function esCompromisoVigente(estado: string): boolean {
  return estado !== "Cancelado";
}

type ComprometidoPorMoneda = Record<string, number>;

function sumarComprometido(
  capituloId: string,
  subcontratistas: Subcontratista[],
  ordenes: OrdenCompra[]
): ComprometidoPorMoneda {
  const acumulado: ComprometidoPorMoneda = {};
  const sumar = (moneda: string, monto: number) => {
    acumulado[moneda] = (acumulado[moneda] ?? 0) + monto;
  };
  for (const sub of subcontratistas) {
    if (!esCompromisoVigente(sub.estado)) continue;
    if (sub.montoContratado == null) continue;
    if (!sub.capitulos.some((c) => c.capituloId === capituloId)) continue;
    sumar(sub.moneda, sub.montoContratado);
  }
  for (const orden of ordenes) {
    if (!esCompromisoVigente(orden.estado)) continue;
    if (orden.monto == null) continue;
    if (!orden.capitulos.some((c) => c.capituloId === capituloId)) continue;
    sumar(orden.moneda, orden.monto);
  }
  return acumulado;
}

// Sin capítulo vinculado — no se puede atribuir a ninguna fila, pero no
// se puede perder del total general (sería plata comprometida real que
// desaparece en silencio del panel).
function sumarComprometidoSinCapitulo(
  subcontratistas: Subcontratista[],
  ordenes: OrdenCompra[]
): ComprometidoPorMoneda {
  const acumulado: ComprometidoPorMoneda = {};
  const sumar = (moneda: string, monto: number) => {
    acumulado[moneda] = (acumulado[moneda] ?? 0) + monto;
  };
  for (const sub of subcontratistas) {
    if (!esCompromisoVigente(sub.estado)) continue;
    if (sub.montoContratado == null) continue;
    if (sub.capitulos.length > 0) continue;
    sumar(sub.moneda, sub.montoContratado);
  }
  for (const orden of ordenes) {
    if (!esCompromisoVigente(orden.estado)) continue;
    if (orden.monto == null) continue;
    if (orden.capitulos.length > 0) continue;
    sumar(orden.moneda, orden.monto);
  }
  return acumulado;
}

function sumarPorMoneda(a: ComprometidoPorMoneda, b: ComprometidoPorMoneda): ComprometidoPorMoneda {
  const r: ComprometidoPorMoneda = { ...a };
  for (const [m, v] of Object.entries(b)) r[m] = (r[m] ?? 0) + v;
  return r;
}

/* ─── Desvío — solo cuando el compromiso está en una única moneda
    y coincide con la moneda del proyecto. Mezcla de monedas, o una
    única moneda distinta a la del proyecto, no da un % directo. ──── */
interface Desvio {
  monto: number;
  pct: number | null;
}

function calcularDesvio(
  presupuestado: number,
  comprometido: ComprometidoPorMoneda,
  monedaProyecto: string
): Desvio | null {
  const monedas = Object.keys(comprometido).filter((m) => comprometido[m] !== 0);
  if (monedas.length !== 1 || monedas[0] !== monedaProyecto) return null;
  const monto = comprometido[monedaProyecto] - presupuestado;
  const pct = presupuestado > 0 ? (monto / presupuestado) * 100 : null;
  return { monto, pct };
}

/* ─── Componente principal ────────────────────────────────── */
export default function SeccionControlCostos({ proyectoId, moneda, capitulos }: Props) {
  const [expandido, setExpandido] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [subcontratistas, setSubcontratistas] = useState<Subcontratista[]>([]);
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);

  const cargarDatos = useCallback(async () => {
    try {
      const [resSub, resOrd] = await Promise.all([
        fetch(`/api/proyectos/${proyectoId}/subcontratistas`),
        fetch(`/api/proyectos/${proyectoId}/ordenes-compra`),
      ]);
      const [dataSub, dataOrd] = await Promise.all([resSub.json(), resOrd.json()]);
      setSubcontratistas(Array.isArray(dataSub) ? dataSub : []);
      setOrdenes(Array.isArray(dataOrd) ? dataOrd : []);
    } catch (err) {
      console.error("[control-costos] error cargando datos", err);
    } finally {
      setCargado(true);
    }
  }, [proyectoId]);

  const abrirSeccion = () => {
    setExpandido((p) => !p);
    if (!cargado) cargarDatos();
  };

  const filas = useMemo(
    () =>
      capitulos.map((cap) => {
        const presupuestado = presupuestadoCapitulo(cap);
        const comprometido = sumarComprometido(cap.id, subcontratistas, ordenes);
        const desvio = calcularDesvio(presupuestado, comprometido, moneda);
        return { cap, presupuestado, comprometido, desvio };
      }),
    [capitulos, subcontratistas, ordenes, moneda]
  );

  const comprometidoSinCapitulo = useMemo(
    () => sumarComprometidoSinCapitulo(subcontratistas, ordenes),
    [subcontratistas, ordenes]
  );

  const totalPresupuestado = useMemo(() => filas.reduce((s, f) => s + f.presupuestado, 0), [filas]);
  const totalComprometido = useMemo(() => {
    let acum: ComprometidoPorMoneda = {};
    for (const f of filas) acum = sumarPorMoneda(acum, f.comprometido);
    acum = sumarPorMoneda(acum, comprometidoSinCapitulo);
    return acum;
  }, [filas, comprometidoSinCapitulo]);
  const desvioTotal = useMemo(
    () => calcularDesvio(totalPresupuestado, totalComprometido, moneda),
    [totalPresupuestado, totalComprometido, moneda]
  );

  const hayComprometidoSinCapitulo = Object.values(comprometidoSinCapitulo).some((v) => v !== 0);

  return (
    <div className="mt-6 bg-white rounded-[16px] border border-slate-300 shadow-sm overflow-hidden">
      <button
        onClick={abrirSeccion}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors text-left group"
      >
        <div className="flex items-center gap-2.5">
          <Scale className="w-4 h-4 text-[#2563EB]" />
          <h2 className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">Control de Costos</h2>
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
            <p className="text-xs text-slate-500 px-5 pt-4">
              Presupuestado (Rubros del capítulo) contra Comprometido Real (Subcontratistas + Órdenes de Compra
              vinculados). No incluye Certificación — esa mide avance/ingreso, no compromiso de gasto.
            </p>

            {capitulos.length === 0 ? (
              <p className="text-xs text-slate-400 italic px-5 py-5">
                Todavía no hay capítulos cargados en este proyecto.
              </p>
            ) : (
              <div className="px-5 py-4 space-y-2" style={{ background: "#F8FAFC" }}>
                {filas.map(({ cap, presupuestado, comprometido, desvio }) => (
                  <FilaCapitulo
                    key={cap.id}
                    cap={cap}
                    presupuestado={presupuestado}
                    moneda={moneda}
                    comprometido={comprometido}
                    desvio={desvio}
                  />
                ))}

                {hayComprometidoSinCapitulo && (
                  <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-[10px] bg-amber-50 border border-amber-200">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-700">
                      Hay subcontratistas/órdenes con monto comprometido sin ningún capítulo vinculado —{" "}
                      {Object.entries(comprometidoSinCapitulo)
                        .filter(([, v]) => v !== 0)
                        .map(([m, v]) => fmtMoneda(v, m))
                        .join(" + ")}
                      . No se atribuyen a ninguna fila, pero sí están incluidos en el total general de abajo.
                    </p>
                  </div>
                )}

                {/* Footer — total general */}
                <div className="rounded-[10px] border-2 border-slate-300 bg-white px-3.5 py-3">
                  <p className="text-[10px] font-bold text-[#1A3A5C] uppercase tracking-wide mb-1.5">Total general</p>
                  <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                    <DatoResumen label="Presupuestado" valor={fmtMoneda(totalPresupuestado, moneda)} />
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 mb-0.5">Comprometido</p>
                      <CeldaComprometido comprometido={totalComprometido} />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 mb-0.5">Desvío</p>
                      <CeldaDesvio desvio={desvioTotal} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Fila de capítulo ─────────────────────────────────────── */
function FilaCapitulo({
  cap,
  presupuestado,
  moneda,
  comprometido,
  desvio,
}: {
  cap: CapituloCosto;
  presupuestado: number;
  moneda: string;
  comprometido: ComprometidoPorMoneda;
  desvio: Desvio | null;
}) {
  return (
    <div className="rounded-[10px] border border-slate-200 bg-white px-3.5 py-3">
      <p className="text-sm font-bold text-[#1A3A5C] truncate mb-2">
        {cap.codigo ? `${cap.codigo} · ` : ""}{cap.nombre}
      </p>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5">
        <DatoResumen label="Presupuestado" valor={fmtMoneda(presupuestado, moneda)} />
        <div>
          <p className="text-[10px] font-semibold text-slate-400 mb-0.5">Comprometido</p>
          <CeldaComprometido comprometido={comprometido} />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-slate-400 mb-0.5">Desvío</p>
          <CeldaDesvio desvio={desvio} />
        </div>
      </div>
    </div>
  );
}

function DatoResumen({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-slate-400 mb-0.5">{label}</p>
      <p className="text-sm tabular-nums text-slate-700">{valor}</p>
    </div>
  );
}

function CeldaComprometido({ comprometido }: { comprometido: ComprometidoPorMoneda }) {
  const entradas = Object.entries(comprometido).filter(([, v]) => v !== 0);
  if (entradas.length === 0) {
    return <span className="text-xs text-slate-400 italic">Sin compromisos</span>;
  }
  return (
    <div className="space-y-0.5">
      {entradas.map(([m, v]) => (
        <div key={m} className="text-sm tabular-nums text-slate-700">
          {fmtMoneda(v, m)}
        </div>
      ))}
    </div>
  );
}

function CeldaDesvio({ desvio }: { desvio: Desvio | null }) {
  if (!desvio) {
    return <span className="text-xs text-slate-400">—</span>;
  }
  const esExceso = desvio.monto > 0;
  const color = esExceso ? "text-red-600" : desvio.monto < 0 ? "text-emerald-600" : "text-slate-500";
  return (
    <div className={cn("text-sm font-semibold tabular-nums", color)}>
      {esExceso ? "+" : ""}
      {desvio.monto.toLocaleString("es-UY", { maximumFractionDigits: 0 })}
      {desvio.pct != null && (
        <span className="block text-[10px] font-normal">
          {esExceso ? "+" : ""}
          {desvio.pct.toFixed(1)}%
        </span>
      )}
    </div>
  );
}
