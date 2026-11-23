"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Layers, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { RESERVA_COLA_TABLA } from "@/lib/layoutTablaPresupuesto";
import { PALETA } from "@/lib/paletaPresupuesto";
import { NotaInfoIcono } from "@/components/NotaInfoIcono";

function fmtMoneda(v: number, moneda: string): string {
  if (!v) return "—";
  const fmt = Math.round(v).toLocaleString("es-UY");
  return moneda === "USD" ? `U$S ${fmt}` : `$ ${fmt}`;
}

// Espaciador invisible — reserva el mismo ancho de cola que la tabla de
// capítulos/rubros (COL_PCT + COL_ACCION × 2, ver layoutTablaPresupuesto.ts)
// después del monto, menos el gap-3 (12px) que ya separa el monto de este
// espaciador en el flex de cada tarjeta — así el borde derecho del monto
// queda en la misma columna vertical que el TOTAL de la tabla, en vez de
// alinearse solo contra el chevron de las tarjetas colapsables vecinas
// (que era la referencia anterior, antes de esta corrección).
function EspaciadorChevron() {
  return <span style={{ width: `calc(${RESERVA_COLA_TABLA} - 12px)` }} className="flex-shrink-0" aria-hidden="true" />;
}

// Tarjeta apilada suelta — fondo blanco, borde fino, sombra sutil, sin el
// peso visual de una tarjeta con borde grueso (eso queda reservado para
// "Precio Final", la única realmente "destacada" de la cascada, con su
// monto a propósito más grande que su título — es el número final de
// toda la obra). En el resto (Costo Total acá; Costo Directo, Gastos
// Generales y Leyes Sociales/BPS en sus propios archivos), el monto en
// negrita usa el MISMO tamaño que su título — antes se veía más grande,
// desequilibrando la fila. IVA no entra en esta variante — su monto no
// es negrita, queda con su propio tamaño sin tocar (ver JSX inline en
// TarjetaCostoTotalPrecioFinal).
function TarjetaSuelta({
  label,
  monto,
  moneda,
  destacado = false,
  pie,
}: {
  label: string;
  monto: number;
  moneda: string;
  destacado?: boolean;
  // Línea chica debajo del monto (solo en la destacada): equivalente en UR.
  pie?: ReactNode;
}) {
  if (destacado) {
    return (
      // Total del presupuesto — azul medio de la paleta (ver PALETA).
      <div
        className="border-2 rounded-lg px-5 py-4 flex justify-between items-center"
        style={{ background: PALETA.totalFondo, borderColor: PALETA.totalFondo, color: PALETA.totalTexto }}
      >
        <span className="text-sm font-bold uppercase tracking-wide">{label}</span>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-lg font-bold">{fmtMoneda(monto, moneda)}</span>
            {pie}
          </div>
          <EspaciadorChevron />
        </div>
      </div>
    );
  }
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-5 py-3 flex justify-between items-center">
      <span className="text-sm font-bold text-slate-700 uppercase tracking-wide">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-sm font-bold text-slate-900">{fmtMoneda(monto, moneda)}</span>
        <EspaciadorChevron />
      </div>
    </div>
  );
}

// ── Tooltips complementos (mismo texto que SeccionComplementosSalariales) ─────
const NOTA_HORAS_LLUVIA =
  "Horas de lluvia y barro (Convenio SUNCA, art. 9 conv. 2023): cuando llueve, el capataz puede suspender las tareas. El obrero cobra igual hasta 6 horas por jornada, descontadas de una bolsa cuatrimestral (36 h nov–feb / 48 h mar–jun / 60 h jul–oct). Más horas adicionales por barro (6/8/10 h por cuatrimestre). Se paga en el recibo del obrero, no al BPS.\n\nReferencia orientativa: obra de verano ~5%, obra de otoño/invierno ~10%, obra anual ~8%. Ajustá según la época de la obra.";
const NOTA_DESGASTE_ROPA =
  "Desgaste de ropa de trabajo (Convenio SUNCA, art. 7): la empresa paga al obrero un complemento por el desgaste de la ropa que usa en obra. Se liquida en el recibo junto al jornal, no al BPS. Default 5% sobre el monto imponible (aproximación práctica); el valor exacto depende del jornal de referencia × jornadas trabajadas.";
const NOTA_DESGASTE_HERRAMIENTAS =
  "Desgaste de herramientas manuales (Convenio SUNCA, art. 8): la empresa paga al obrero un complemento por el uso y desgaste de sus herramientas personales (cuchara, llana, mazo, etc.). Se liquida en el recibo, no al BPS. Default 2% sobre el monto imponible.";
const NOTA_TRANSPORTE =
  "Complemento de transporte (Convenio SUNCA, art. 10): pago al obrero por el costo del transporte hasta la obra. 4,37% del jornal de referencia por jornada trabajada. Se liquida en el recibo, no al BPS. Default 4,37% sobre el monto imponible (aproximación práctica).";

function fmtPct(v: number): string {
  return (v * 100).toLocaleString("es-UY", { minimumFractionDigits: 1, maximumFractionDigits: 4 });
}

function PctInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      <input
        type="number"
        step="any"
        value={value === 0 ? "" : String(Number((value * 100).toFixed(4)))}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          onChange(isNaN(n) ? 0 : n / 100);
        }}
        className="w-14 text-right text-sm font-semibold text-slate-600 bg-transparent border-b border-dashed border-slate-300 focus:outline-none focus:border-[#2563EB] focus:text-[#2563EB] tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <span className="text-xs text-slate-400">%</span>
    </span>
  );
}

// Props de complementos salariales opcionales — solo se muestran cuando
// la obra no es pública y hay leyes sociales cargadas.
export interface ComplementosSalarialesProps {
  montoImponibleMO: number;
  horasLluviaPct: number;
  desgasteRopaPct: number;
  desgasteHerramientasPct: number;
  complementoTransportePct: number;
  onChangeHorasLluvia: (v: number) => void;
  onChangeDesgasteRopa: (v: number) => void;
  onChangeDesgasteHerramientas: (v: number) => void;
  onChangeTransporte: (v: number) => void;
  onGuardar: () => Promise<void>;
  guardando: boolean;
}

// 1ra tarjeta de la cascada — Costo Directo agregado del proyecto (Σ
// Materiales + Mano de Obra con Aportes Patronales + Equipos de cada
// rubro). "Gastos Generales y Beneficio" (componente aparte, con su propio
// desglose colapsable) va justo después de esta, y antes de
// TarjetaCostoTotalPrecioFinal — ver proyectos/[id]/page.tsx.
export interface RubroSinApuDetalle {
  id: string;
  /** Título (solo con 2+ títulos) y capítulo. */
  ubicacion: string[];
  nombre: string;
}

export function TarjetaCostoDirecto({
  moneda,
  costoDirecto,
  costoDirectoBase,
  complementos,
  metodoCostoDirecto,
  rubrosSinApu,
  rubrosSinApuDetalle,
}: {
  moneda: string;
  /** Total con complementos incluidos (lo que muestra el header). */
  costoDirecto: number;
  /** Solo los rubros de obra, sin complementos (para la fila de desglose). */
  costoDirectoBase: number;
  /** Props de complementos — undefined en obra pública o sin leyes cargadas. */
  complementos?: ComplementosSalarialesProps;
  // "estimado" si al menos un rubro no tiene APU propio (ver
  // calcularCostoDirectoAgregado en costoAgregado.ts) — ese rubro entra
  // completo como Costo Directo, sin poder separar cuánto sería Utilidad.
  metodoCostoDirecto: "apu" | "estimado";
  rubrosSinApu: number;
  /** Los mismos rubros que cuenta rubrosSinApu, con su ubicación. */
  rubrosSinApuDetalle: RubroSinApuDetalle[];
}) {
  const hayComplementos = !!complementos;
  const [desglosAbierto, setDesglosAbierto] = useState(false);
  // Panel del aviso ámbar: se abre al pasar el mouse o al tocarlo, y se cierra al tocar afuera,
  // con Esc o tocando el aviso otra vez. Si se abrió solo por el hover, se vuelve a cerrar al sacar
  // el mouse (con una pequeña demora para poder cruzar del aviso a la lista); un clic mientras está
  // abierto por hover lo deja fijo, y recién el siguiente clic lo cierra.
  const [panelAbierto, setPanelAbierto] = useState(false);
  const abiertoPorHover = useRef(false);
  const timerCierre = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const contenedorRef = useRef<HTMLDivElement>(null);
  useEffect(() => () => clearTimeout(timerCierre.current), []);
  const alEntrarMouse = () => {
    clearTimeout(timerCierre.current);
    if (!panelAbierto) {
      abiertoPorHover.current = true;
      setPanelAbierto(true);
    }
  };
  const alSalirMouse = () => {
    if (!abiertoPorHover.current) return;
    clearTimeout(timerCierre.current);
    timerCierre.current = setTimeout(() => {
      abiertoPorHover.current = false;
      setPanelAbierto(false);
    }, 150);
  };
  useEffect(() => {
    if (!panelAbierto) return;
    const alTocar = (e: MouseEvent) => {
      if (!contenedorRef.current?.contains(e.target as Node)) {
        abiertoPorHover.current = false;
        setPanelAbierto(false);
      }
    };
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        abiertoPorHover.current = false;
        setPanelAbierto(false);
      }
    };
    document.addEventListener("mousedown", alTocar);
    document.addEventListener("keydown", alTeclear);
    return () => {
      document.removeEventListener("mousedown", alTocar);
      document.removeEventListener("keydown", alTeclear);
    };
  }, [panelAbierto]);

  // Cálculo de complementos para el desglose interno
  const totalComplementos = complementos
    ? complementos.montoImponibleMO * (
        complementos.horasLluviaPct +
        complementos.desgasteRopaPct +
        complementos.desgasteHerramientasPct +
        complementos.complementoTransportePct
      )
    : 0;

  return (
    <div className="flex flex-col gap-2 mt-2">
      {metodoCostoDirecto === "estimado" && (
        <div ref={contenedorRef} className="relative" onMouseEnter={alEntrarMouse} onMouseLeave={alSalirMouse}>
          <button
            type="button"
            onClick={() => {
              if (abiertoPorHover.current) {
                abiertoPorHover.current = false;
                return;
              }
              setPanelAbierto((v) => !v);
            }}
            aria-expanded={panelAbierto}
            className="w-full flex items-start gap-2 rounded-[8px] bg-amber-50 border border-amber-200 px-3 py-2 text-left hover:bg-amber-100/70 transition-colors"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="flex-1 text-xs text-amber-700">
              {rubrosSinApu} rubro{rubrosSinApu !== 1 ? "s" : ""} sin Análisis de Precio Unitario — se usó su precio
              cargado a mano como Costo Directo completo, sin poder separar cuánto de eso sería Utilidad.
            </p>
            <ChevronDown
              className={`w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5 transition-transform ${panelAbierto ? "rotate-180" : ""}`}
            />
          </button>
          {panelAbierto && (
            <div className="absolute left-0 top-full mt-2 z-20 w-[26rem] max-w-full rounded-[10px] border border-slate-200 bg-white shadow-lg">
              <p className="px-4 pt-3 pb-3 text-xs leading-relaxed text-slate-600 border-b border-slate-100">
                {rubrosSinApu === 1
                  ? "Este rubro tiene el precio cargado a mano, sin desglose de materiales y mano de obra. Entra igual en el total, pero no se actualiza con la fórmula paramétrica ni con el % de Utilidad general (el ajuste por ICCV sí lo toma). Para completarlo, abrí el rubro y cargá su APU."
                  : "Estos rubros tienen el precio cargado a mano, sin desglose de materiales y mano de obra. Entran igual en el total, pero no se actualizan con la fórmula paramétrica ni con el % de Utilidad general (el ajuste por ICCV sí los toma). Para completarlos, abrí cada rubro y cargá su APU."}
              </p>
              <p className="px-4 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {rubrosSinApu === 1 ? "Rubro sin APU" : `Rubros sin APU (${rubrosSinApu})`}
              </p>
              <ul className="max-h-64 overflow-y-auto px-4 pb-3 space-y-1.5">
                {rubrosSinApuDetalle.map((r) => (
                  <li key={r.id} className="text-xs leading-snug">
                    <span className="text-slate-400">{r.ubicacion.join(" › ")} › </span>
                    <span className="font-medium text-slate-700">{r.nombre}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Tarjeta Costo Directo — colapsable si hay complementos */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {/* Header — siempre visible */}
        <button
          type="button"
          onClick={() => hayComplementos && setDesglosAbierto((v) => !v)}
          className={`w-full flex items-center justify-between px-5 py-3.5 text-left ${hayComplementos ? "hover:bg-slate-50 transition-colors cursor-pointer group" : "cursor-default"}`}
          disabled={!hayComplementos}
        >
          <div className="flex items-center gap-2.5">
            <Layers className="w-4 h-4 text-[#2563EB]" />
            <span className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">Costo Directo</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-slate-900 tabular-nums">{fmtMoneda(costoDirecto, moneda)}</span>
            {hayComplementos && (
              <span className="text-slate-400 group-hover:text-slate-600 transition-colors">
                {desglosAbierto
                  ? <ChevronDown className="w-4 h-4" />
                  : <ChevronRight className="w-4 h-4" />
                }
              </span>
            )}
            <EspaciadorChevron />
          </div>
        </button>

        {/* Panel desplegable — desglose: Rubros de obra + Complementos salariales */}
        {hayComplementos && (
          <AnimatePresence initial={false}>
            {desglosAbierto && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden border-t border-slate-100"
              >
                <div style={{ background: "#F8FAFC" }}>
                  {/* Fila: Rubros de obra */}
                  <div className="flex items-center justify-between px-5 py-2.5 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-sm text-slate-600">Rubros de obra</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-700 tabular-nums">{fmtMoneda(costoDirectoBase, moneda)}</span>
                  </div>

                  {/* Fila expandible: Complementos salariales */}
                  <div>
                    {/* Sub-header de complementos */}
                    <div className="flex items-center justify-between px-5 py-2.5">
                      <div className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-sm text-slate-600">Complementos salariales</span>
                        <span className="text-[11px] text-slate-400">Convenio SUNCA</span>
                      </div>
                      <span className="text-sm font-semibold text-slate-700 tabular-nums">{fmtMoneda(totalComplementos, moneda)}</span>
                    </div>

                    {/* Filas de cada complemento con sus inputs editables */}
                    <div className="mx-5 mb-3 rounded-[10px] border border-slate-200 bg-white overflow-hidden">
                      {/* Horas lluvia */}
                      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-slate-50">
                        <span className="flex-1 text-sm text-slate-600">
                          Horas de lluvia y barro
                          <NotaInfoIcono texto={NOTA_HORAS_LLUVIA} />
                        </span>
                        <PctInput value={complementos!.horasLluviaPct} onChange={complementos!.onChangeHorasLluvia} />
                        <span className="text-sm font-semibold text-[#2563EB] tabular-nums w-24 text-right">
                          {fmtMoneda(complementos!.montoImponibleMO * complementos!.horasLluviaPct, moneda)}
                        </span>
                      </div>
                      {/* Desgaste ropa */}
                      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-slate-50">
                        <span className="flex-1 text-sm text-slate-600">
                          Desgaste de ropa
                          <NotaInfoIcono texto={NOTA_DESGASTE_ROPA} />
                        </span>
                        <PctInput value={complementos!.desgasteRopaPct} onChange={complementos!.onChangeDesgasteRopa} />
                        <span className="text-sm font-semibold text-[#2563EB] tabular-nums w-24 text-right">
                          {fmtMoneda(complementos!.montoImponibleMO * complementos!.desgasteRopaPct, moneda)}
                        </span>
                      </div>
                      {/* Desgaste herramientas */}
                      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-slate-50">
                        <span className="flex-1 text-sm text-slate-600">
                          Desgaste de herramientas
                          <NotaInfoIcono texto={NOTA_DESGASTE_HERRAMIENTAS} />
                        </span>
                        <PctInput value={complementos!.desgasteHerramientasPct} onChange={complementos!.onChangeDesgasteHerramientas} />
                        <span className="text-sm font-semibold text-[#2563EB] tabular-nums w-24 text-right">
                          {fmtMoneda(complementos!.montoImponibleMO * complementos!.desgasteHerramientasPct, moneda)}
                        </span>
                      </div>
                      {/* Transporte */}
                      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-slate-100">
                        <span className="flex-1 text-sm text-slate-600">
                          Complemento transporte
                          <NotaInfoIcono texto={NOTA_TRANSPORTE} />
                        </span>
                        <PctInput value={complementos!.complementoTransportePct} onChange={complementos!.onChangeTransporte} />
                        <span className="text-sm font-semibold text-[#2563EB] tabular-nums w-24 text-right">
                          {fmtMoneda(complementos!.montoImponibleMO * complementos!.complementoTransportePct, moneda)}
                        </span>
                      </div>
                      {/* Total complementos */}
                      <div className="flex items-center gap-2 px-4 py-2 bg-slate-50">
                        <span className="flex-1 text-xs font-bold text-[#1A3A5C] uppercase tracking-wide">Total complementos</span>
                        <span className="text-xs text-slate-400 tabular-nums">
                          {fmtPct(complementos!.horasLluviaPct + complementos!.desgasteRopaPct + complementos!.desgasteHerramientasPct + complementos!.complementoTransportePct)}%
                        </span>
                        <span className="text-sm font-bold text-[#1A3A5C] tabular-nums w-24 text-right">
                          {fmtMoneda(totalComplementos, moneda)}
                        </span>
                      </div>
                    </div>

                    {/* Botón guardar */}
                    <div className="flex justify-end px-5 pb-4">
                      <button
                        type="button"
                        onClick={complementos!.onGuardar}
                        disabled={complementos!.guardando}
                        className="px-4 py-2 rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-colors disabled:opacity-50"
                      >
                        {complementos!.guardando ? "Guardando…" : "Guardar"}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

// Últimas 3 tarjetas de la cascada — Costo Total = Costo Directo + el
// monto combinado de "Gastos Generales y Beneficio" (Costos Indirectos +
// Utilidad, ya sumados en ese componente) — sin ninguna línea intermedia
// adicional (no existe "Base Imponible" como concepto separado).
export function TarjetaCostoTotalPrecioFinal({
  moneda,
  costoDirecto,
  montoGastosGeneralesYBeneficio,
  montoIVA,
  facturaConIva = true,
  precioFinal,
  equivalenteUR,
}: {
  moneda: string;
  costoDirecto: number;
  montoGastosGeneralesYBeneficio: number;
  // Calculados en page.tsx (costoAgregado.ts) y no acá — la base del IVA
  // no es simplemente costoTotal × 22% desde que existen ítems exentos
  // (ej. Timbres CJP) dentro de Gastos Generales Detallado; recalcularlo
  // acá con la fórmula vieja volvería a ignorar la exención, mismo bug
  // que ya pasó una vez con el PDF (ver gastosGenerales.ts).
  montoIVA: number;
  // false = la empresa no factura IVA (literal E o monotributo): la fila
  // lo dice en vez de mostrar un monto. Ver Proyecto.facturaConIva.
  facturaConIva?: boolean;
  precioFinal: number;
  // Obra pública con contrato en UR (ver page.tsx): precio final ya pasado a
  // pesos y el valor de la UR cargado en /editar (null si falta). Sin esto
  // (privada, o contrato en pesos), la tarjeta queda como siempre.
  equivalenteUR?: { valorUR: number | null; precioFinalPesos: number } | null;
}) {
  const costoTotal = costoDirecto + montoGastosGeneralesYBeneficio;

  let pieUR: ReactNode = null;
  if (equivalenteUR) {
    const { valorUR, precioFinalPesos } = equivalenteUR;
    pieUR = valorUR && valorUR > 0 ? (
      <p className="text-sm font-semibold tabular-nums opacity-90">
        = {(precioFinalPesos / valorUR).toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} UR
      </p>
    ) : (
      <p className="text-xs font-normal opacity-80">Cargá el valor de la UR para ver el total en UR</p>
    );
  }

  return (
    <div className="flex flex-col gap-2 mt-2">
      <TarjetaSuelta label="Costo Total" monto={costoTotal} moneda={moneda} />
      {/* IVA no lleva monto en negrita (sigue font-semibold, no bold) —
          pero mismo tamaño que el resto de la cascada (text-sm), para
          no desequilibrar la fila. */}
      <div className="bg-white border border-slate-200 rounded-lg px-5 py-3 flex justify-between items-center">
        <span className="text-sm font-bold text-slate-700 uppercase tracking-wide">IVA (22%)</span>
        <div className="flex items-center gap-3">
          {facturaConIva ? (
            <span className="text-sm font-semibold text-slate-900">+ {fmtMoneda(montoIVA, moneda)}</span>
          ) : (
            <span className="text-sm text-slate-500">No se factura (literal E / monotributo)</span>
          )}
          <EspaciadorChevron />
        </div>
      </div>
      <TarjetaSuelta label="Precio Final" monto={precioFinal} moneda={moneda} destacado pie={pieUR} />
    </div>
  );
}
