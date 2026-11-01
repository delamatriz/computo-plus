"use client";

import { useState, useCallback, useMemo } from "react";
import { Scale, ChevronDown, ChevronRight, AlertTriangle, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { PALETA } from "@/lib/paletaPresupuesto";
import { totalesJornales, type JornalParaCalculo } from "@/lib/jornalesPagados";
import { presupuestoContratado, type ContratoParaPresupuesto } from "@/lib/presupuestoContratado";

/* ─── Tipos ───────────────────────────────────────────────── */
interface RubroCosto {
  id: string;
  cantidad: number | null;
  precioUnit: number | null;
  // Costo directo unitario del APU (sin utilidad); null si el rubro no tiene APU.
  costoUnit?: number | null;
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
  empresa: string;
  montoContratado: number | null;
  moneda: string;
  estado: string;
  capitulos: CapituloVinculoCompromiso[];
}

interface OrdenCompra {
  id: string;
  proveedor: string;
  monto: number | null;
  moneda: string;
  estado: string;
  capitulos: CapituloVinculoCompromiso[];
  items?: { precioUnit: number | null }[];
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

// Lo presupuestado se compara A COSTO (costo directo del APU × cantidad, sin
// utilidad): lo comprometido —OC, subcontratos, jornales— es costo, y contra
// el precio de venta el desvío salía inflado por la utilidad. Un rubro sin APU
// no permite separar la utilidad: entra con su precio entero.
function costoRubro(r: RubroCosto): number {
  if (r.cantidad == null) return 0;
  const unit = r.costoUnit ?? r.precioUnit;
  return unit == null ? 0 : r.cantidad * unit;
}

function presupuestadoCapitulo(cap: CapituloCosto): number {
  return (cap.rubros ?? []).reduce((s, r) => s + costoRubro(r), 0);
}

/* ─── Cálculo de comprometido por moneda, por capítulo ────── */
// Cancelado no cuenta como compromiso real — un subcontrato o una orden
// cancelados ya no representan una salida de plata esperada, mismo
// criterio que llevó a que "Cancelado" reemplace el borrado en esos
// módulos (el registro queda, pero deja de pesar acá). "En negociación"
// tampoco: todavía no hay nada firmado.
function esCompromisoVigente(estado: string): boolean {
  return estado !== "Cancelado" && estado !== "En negociación";
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

// Desglose del total por origen (Subcontratos / Órdenes de compra), solo
// compromisos vigentes, con o sin capítulo vinculado.
function sumarPorOrigen(items: { monto: number | null; moneda: string; estado: string }[]): ComprometidoPorMoneda {
  const acumulado: ComprometidoPorMoneda = {};
  for (const it of items) {
    if (!esCompromisoVigente(it.estado) || it.monto == null) continue;
    acumulado[it.moneda] = (acumulado[it.moneda] ?? 0) + it.monto;
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
  const [actualizando, setActualizando] = useState(false);
  const [subcontratistas, setSubcontratistas] = useState<Subcontratista[]>([]);
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);
  const [jornales, setJornales] = useState<JornalParaCalculo[]>([]);
  const [contrato, setContrato] = useState<ContratoParaPresupuesto | null>(null);

  const cargarDatos = useCallback(async () => {
    setActualizando(true);
    try {
      const [resSub, resOrd, resJor, resCon] = await Promise.all([
        fetch(`/api/proyectos/${proyectoId}/subcontratistas`),
        fetch(`/api/proyectos/${proyectoId}/ordenes-compra`),
        fetch(`/api/proyectos/${proyectoId}/jornales`),
        fetch(`/api/proyectos/${proyectoId}/contrato`),
      ]);
      const [dataSub, dataOrd, dataJor, dataCon] = await Promise.all([
        resSub.json(),
        resOrd.json(),
        resJor.json().catch(() => null),
        resCon.ok ? resCon.json().catch(() => null) : null,
      ]);
      setContrato(dataCon?.contrato ? { monto: dataCon.contrato.monto, moneda: dataCon.contrato.moneda } : null);
      setSubcontratistas(Array.isArray(dataSub) ? dataSub : []);
      setOrdenes(Array.isArray(dataOrd) ? dataOrd : []);
      setJornales(Array.isArray(dataJor?.registros) ? dataJor.registros : []);
    } catch (err) {
      console.error("[control-costos] error cargando datos", err);
    } finally {
      setCargado(true);
      setActualizando(false);
    }
  }, [proyectoId]);

  // Se recarga cada vez que se abre: las órdenes, subcontratos y jornales se
  // editan en otras secciones de la misma página, y con una sola carga
  // inicial el panel mostraba compromisos viejos hasta recargar.
  const abrirSeccion = () => {
    if (!expandido) cargarDatos();
    setExpandido((p) => !p);
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

  // Mano de obra ejecutada (Planilla de Jornales): bruto + aportes
  // patronales, en pesos. Los jornales se pagan por persona y semana, no por
  // capítulo, así que entra solo al total general — mismo criterio que los
  // compromisos sin capítulo vinculado.
  const moEjecutada = useMemo(() => totalesJornales(jornales).total, [jornales]);
  const moEjecutadaPorMoneda = useMemo<ComprometidoPorMoneda>(
    () => (moEjecutada > 0 ? { UYU: moEjecutada } : ({} as ComprometidoPorMoneda)),
    [moEjecutada]
  );

  const totalPresupuestado = useMemo(() => filas.reduce((s, f) => s + f.presupuestado, 0), [filas]);
  const totalComprometido = useMemo(() => {
    let acum: ComprometidoPorMoneda = {};
    for (const f of filas) acum = sumarPorMoneda(acum, f.comprometido);
    acum = sumarPorMoneda(acum, comprometidoSinCapitulo);
    acum = sumarPorMoneda(acum, moEjecutadaPorMoneda);
    return acum;
  }, [filas, comprometidoSinCapitulo, moEjecutadaPorMoneda]);
  const desglose = useMemo(
    () => [
      {
        label: "Subcontratos",
        valor: sumarPorOrigen(subcontratistas.map((s) => ({ monto: s.montoContratado, moneda: s.moneda, estado: s.estado }))),
      },
      { label: "Órdenes de compra", valor: sumarPorOrigen(ordenes) },
      { label: "MO ejecutada", valor: moEjecutadaPorMoneda },
    ],
    [subcontratistas, ordenes, moEjecutadaPorMoneda]
  );
  const desvioTotal = useMemo(
    () => calcularDesvio(totalPresupuestado, totalComprometido, moneda),
    [totalPresupuestado, totalComprometido, moneda]
  );

  const hayComprometidoSinCapitulo = Object.values(comprometidoSinCapitulo).some((v) => v !== 0);

  // Referencia económica: presupuesto contratado (contrato firmado o suma de
  // rubros) y lo que queda entre eso y el costo presupuestado.
  const sumaRubros = useMemo(
    () => capitulos.reduce((s, c) => s + (c.rubros ?? []).reduce((t, r) => t + (r.cantidad ?? 0) * (r.precioUnit ?? 0), 0), 0),
    [capitulos]
  );
  const contratado = presupuestoContratado(contrato, sumaRubros, moneda);
  const rubrosSinApu = capitulos.reduce((n, c) => n + (c.rubros ?? []).filter((r) => r.costoUnit == null).length, 0);
  const negociacion = subcontratistas.filter((s) => s.estado === "En negociación" && s.montoContratado != null);

  // Órdenes vigentes que el total no puede contar completas: sin monto (no
  // suman nada) o con ítems sin precio (el monto es solo la suma de los
  // ítems con precio, ver lib/ordenCompra.ts).
  const ordenesVigentes = ordenes.filter((o) => esCompromisoVigente(o.estado));
  const ordenesSinMonto = ordenesVigentes.filter((o) => o.monto == null);
  const ordenesConItemsSinPrecio = ordenesVigentes.filter(
    (o) => o.monto != null && (o.items ?? []).some((it) => it.precioUnit == null)
  );

  return (
    <div className="mt-6 bg-white rounded-[16px] border border-slate-300 shadow-sm overflow-hidden">
      <button
        onClick={abrirSeccion}
        className={`w-full flex items-center justify-between px-5 py-3.5 transition-colors text-left group ${PALETA.capituloFila}`}
      >
        <div className="flex items-center gap-2.5">
          <Scale className="w-4 h-4 text-[#1D4435]" />
          <h2 className="text-sm font-bold text-[#1D4435] uppercase tracking-wide">Control de Costos</h2>
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
              Costo presupuestado (costo directo de los rubros del capítulo, sin utilidad) contra lo comprometido
              (subcontratos y órdenes de compra vigentes vinculados) y la mano de obra ejecutada de la Planilla de
              Jornales. No incluye Certificación — esa mide avance/ingreso, no compromiso de gasto.
              {cargado && actualizando && <span className="ml-1 text-[#2563EB]">Actualizando…</span>}
            </p>

            {!cargado ? (
              <p className="text-xs text-slate-400 italic px-5 py-5">Cargando compromisos…</p>
            ) : capitulos.length === 0 ? (
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

                {(ordenesSinMonto.length > 0 || ordenesConItemsSinPrecio.length > 0) && (
                  <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-[10px] bg-amber-50 border border-amber-200">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div className="text-[11px] text-amber-700 space-y-1">
                      {ordenesSinMonto.length > 0 && (
                        <p>
                          {ordenesSinMonto.length === 1 ? "1 orden de compra" : `${ordenesSinMonto.length} órdenes de compra`}{" "}
                          sin monto, que no suman al comprometido:{" "}
                          <span className="font-semibold">{nombresProveedores(ordenesSinMonto)}</span>. Cargales el monto
                          o los precios de sus ítems en Órdenes de Compra.
                        </p>
                      )}
                      {ordenesConItemsSinPrecio.length > 0 && (
                        <p>
                          {ordenesConItemsSinPrecio.length === 1
                            ? "1 orden de compra tiene"
                            : `${ordenesConItemsSinPrecio.length} órdenes de compra tienen`}{" "}
                          ítems sin precio, así que su monto es parcial:{" "}
                          <span className="font-semibold">{nombresProveedores(ordenesConItemsSinPrecio)}</span>.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {negociacion.length > 0 && (
                  <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-[10px] bg-[#EFF6FF] border border-blue-100">
                    <Info className="w-3.5 h-3.5 text-[#2563EB] flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] text-[#1A3A5C]">
                      {negociacion.length === 1 ? "1 subcontrato en negociación" : `${negociacion.length} subcontratos en negociación`}{" "}
                      (<span className="font-semibold">{negociacion.map((s) => s.empresa).join(", ")}</span>) no cuenta como
                      comprometido hasta que pase a otro estado.
                    </p>
                  </div>
                )}

                {rubrosSinApu > 0 && (
                  <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-[10px] bg-amber-50 border border-amber-200">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-700">
                      {rubrosSinApu === 1 ? "1 rubro no tiene" : `${rubrosSinApu} rubros no tienen`} análisis de precio:
                      su costo se toma del precio unitario entero (con utilidad), así que el costo presupuestado queda alto.
                    </p>
                  </div>
                )}

                {moEjecutada > 0 && (
                  <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-[10px] bg-[#EFF6FF] border border-blue-100">
                    <Info className="w-3.5 h-3.5 text-[#2563EB] flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] text-[#1A3A5C]">
                      Mano de obra ejecutada (Planilla de Jornales, con aportes patronales):{" "}
                      <span className="font-semibold">{fmtMoneda(moEjecutada, "UYU")}</span>. Se paga por trabajador y
                      semana, no por capítulo: está incluida en el total general de abajo, no en cada fila.
                    </p>
                  </div>
                )}

                {/* Footer — total general */}
                <div className="rounded-[10px] border-2 border-slate-300 bg-white px-3.5 py-3">
                  <p className="text-[10px] font-bold text-[#1A3A5C] uppercase tracking-wide mb-1.5">Total general</p>
                  <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                    <DatoResumen label="Costo presupuestado" valor={fmtMoneda(totalPresupuestado, moneda)} />
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 mb-0.5">Costo real comprometido</p>
                      <CeldaComprometido comprometido={totalComprometido} />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 mb-0.5">Desvío</p>
                      <CeldaDesvio desvio={desvioTotal} moneda={moneda} />
                    </div>
                  </div>
                  <div className="mt-2.5 pt-2.5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-x-5 gap-y-1.5">
                    {desglose.map((d) => (
                      <div key={d.label}>
                        <p className="text-[10px] font-semibold text-slate-400 mb-0.5">{d.label}</p>
                        <CeldaComprometido comprometido={d.valor} vacio="—" />
                      </div>
                    ))}
                  </div>
                  {contratado.monto > 0 && (
                    <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex flex-wrap gap-x-5 gap-y-1.5">
                      <div>
                        <p className="text-[10px] font-semibold text-slate-400 mb-0.5">Presupuesto contratado</p>
                        <p className="text-sm tabular-nums text-slate-700">{fmtMoneda(contratado.monto, moneda)}</p>
                        <p className="text-[10px] text-slate-400">
                          {contratado.fuente === "contrato" ? "Contrato firmado" : "Suma de rubros, sin IVA"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-slate-400 mb-0.5">Margen sobre costo presupuestado</p>
                        <p
                          className={cn(
                            "text-sm font-semibold tabular-nums",
                            contratado.monto - totalPresupuestado < 0 ? "text-red-600" : "text-slate-700"
                          )}
                        >
                          {fmtMoneda(contratado.monto - totalPresupuestado, moneda)}
                        </p>
                        <p className="text-[10px] text-slate-400">Para gastos generales, imprevistos y utilidad</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function nombresProveedores(ordenes: OrdenCompra[]): string {
  return [...new Set(ordenes.map((o) => o.proveedor))].join(", ");
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
        <DatoResumen label="Costo presupuestado" valor={fmtMoneda(presupuestado, moneda)} />
        <div>
          <p className="text-[10px] font-semibold text-slate-400 mb-0.5">Contratado/Comprado</p>
          <CeldaComprometido comprometido={comprometido} />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-slate-400 mb-0.5">Desvío</p>
          <CeldaDesvio desvio={desvio} moneda={moneda} />
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

function CeldaComprometido({ comprometido, vacio }: { comprometido: ComprometidoPorMoneda; vacio?: string }) {
  const entradas = Object.entries(comprometido).filter(([, v]) => v !== 0);
  if (entradas.length === 0) {
    return <span className="text-xs text-slate-400 italic">{vacio ?? "Sin compromisos"}</span>;
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

// Desvío = comprometido − costo presupuestado. Positivo: se pasó (rojo).
// Negativo: lo que todavía no está comprometido — no es ahorro mientras la
// obra no termine, así que va en gris.
function CeldaDesvio({ desvio, moneda }: { desvio: Desvio | null; moneda: string }) {
  if (!desvio) {
    return <span className="text-xs text-slate-400">—</span>;
  }
  const esExceso = desvio.monto > 0.5;
  return (
    <div className={cn("text-sm font-semibold tabular-nums", esExceso ? "text-red-600" : "text-slate-600")}>
      {esExceso ? "+" : desvio.monto < -0.5 ? "−" : ""}
      {fmtMoneda(Math.abs(desvio.monto), moneda)}
      <span className="block text-[10px] font-normal">
        {desvio.pct != null && `${esExceso ? "+" : desvio.pct < 0 ? "−" : ""}${Math.abs(desvio.pct).toLocaleString("es-UY", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% · `}
        {esExceso ? "sobre lo presupuestado" : "sin comprometer"}
      </span>
    </div>
  );
}
