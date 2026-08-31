"use client";

import { useState } from "react";
import { Percent, ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  CATEGORIAS_GASTOS_GENERALES_FIJAS,
  normalizarCategoriasGastosGenerales,
  sumarGastosGeneralesDetallado,
  type ItemGastoGeneral,
  type CategoriaGastoGeneral,
  type ModoGastosGenerales,
} from "@/lib/gastosGenerales";
import { RESERVA_COLA_TABLA } from "@/lib/layoutTablaPresupuesto";

// Re-exportado desde @/lib/gastosGenerales (lógica pura, compartida con
// pdf/route.ts) — se mantiene acá para no tener que tocar los imports
// existentes de page.tsx.
export {
  CATEGORIAS_GASTOS_GENERALES_FIJAS,
  normalizarCategoriasGastosGenerales,
  sumarGastosGeneralesDetallado,
};
export type { ItemGastoGeneral, CategoriaGastoGeneral, ModoGastosGenerales };

interface Props {
  moneda: string;
  modo: ModoGastosGenerales;
  // null = todavía no se guardó ningún default explícito — se usa 15/10
  // (mismo comportamiento que antes de esta feature).
  gastosGeneralesPctDefault: number | null;
  utilidadPctDefault: number | null;
  categorias: CategoriaGastoGeneral[] | null;
  // Ya calculados a nivel proyecto (ver costoAgregado.ts) — se muestran
  // combinados ($ único) en el header colapsado, mismo patrón que ya usa
  // Leyes Sociales. No se recalculan acá, son la misma fuente de verdad
  // que usa la cascada Costo Directo → Costo Total → Precio Final.
  costosIndirectosAgregados: number;
  utilidadAgregada: number;
  // Timbres CJP e Ítems extra — antes se editaban en "Resumen del
  // Presupuesto" (ver git history); se mudaron acá por conveniencia de
  // UX, no de cálculo: siguen sin formar parte de montoCombinado
  // (Costos Indirectos + Utilidad) de abajo, van directo a "Costo" en
  // la cascada (ver page.tsx) y a la línea "GASTOS GENERALES" del PDF,
  // sin pasar por costoAgregado.ts.
  timbresCJP: number;
  gastosGeneralesItems: ItemGastoGeneral[];
  onChangeModo: (modo: ModoGastosGenerales) => void;
  onChangeGastosGeneralesPctDefault: (v: number) => void;
  onChangeUtilidadPctDefault: (v: number) => void;
  onChangeCategorias: (categorias: CategoriaGastoGeneral[]) => void;
  onChangeTimbresCJP: (v: number) => void;
  onChangeGastosGeneralesItems: (items: ItemGastoGeneral[]) => void;
}

function fmtMoneda(v: number, moneda: string): string {
  if (!v) return "—";
  const fmt = Math.round(v).toLocaleString("es-UY");
  return moneda === "USD" ? `U$S ${fmt}` : `$ ${fmt}`;
}

/** Input de porcentaje en puntos enteros (15 = 15%), no fracción — mismo
 *  formato en que se guardan APU.gastosGeneralesPct/utilidadPct. */
function PctInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="number"
        step="0.5"
        value={value}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          onChange(isNaN(n) ? 0 : n);
        }}
        className="w-20 px-2 py-1 text-right text-sm font-semibold text-slate-700 tabular-nums bg-white border border-slate-200 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <span className="text-sm text-slate-400">%</span>
    </span>
  );
}

export default function SeccionGastosGeneralesUtilidades({
  moneda,
  modo,
  gastosGeneralesPctDefault,
  utilidadPctDefault,
  categorias,
  costosIndirectosAgregados,
  utilidadAgregada,
  timbresCJP,
  gastosGeneralesItems,
  onChangeModo,
  onChangeGastosGeneralesPctDefault,
  onChangeUtilidadPctDefault,
  onChangeCategorias,
  onChangeTimbresCJP,
  onChangeGastosGeneralesItems,
}: Props) {
  const [expandido, setExpandido] = useState(false);

  const pctGGEfectivo = gastosGeneralesPctDefault ?? 15;
  const pctUtilEfectivo = utilidadPctDefault ?? 10;
  const categoriasNormalizadas = normalizarCategoriasGastosGenerales(categorias);
  const totalDetallado = categoriasNormalizadas.reduce(
    (s, cat) => s + cat.items.reduce((si, it) => si + (it.monto || 0), 0),
    0
  );
  // Monto combinado para el header colapsado — Costos Indirectos +
  // Utilidad, ya calculados a nivel proyecto (props), mismo patrón que
  // Leyes Sociales ("$X" único junto al chevron).
  const montoCombinado = costosIndirectosAgregados + utilidadAgregada;

  const agregarItem = (categoriaId: string) => {
    onChangeCategorias(
      categoriasNormalizadas.map((cat) =>
        cat.id !== categoriaId
          ? cat
          : { ...cat, items: [...cat.items, { id: `gg-${Date.now()}`, descripcion: "", monto: 0 }] }
      )
    );
  };

  const actualizarItem = (categoriaId: string, itemId: string, campo: "descripcion" | "monto", valor: string) => {
    onChangeCategorias(
      categoriasNormalizadas.map((cat) =>
        cat.id !== categoriaId
          ? cat
          : {
              ...cat,
              items: cat.items.map((it) =>
                it.id !== itemId ? it : { ...it, [campo]: campo === "monto" ? parseFloat(valor) || 0 : valor }
              ),
            }
      )
    );
  };

  const eliminarItem = (categoriaId: string, itemId: string) => {
    onChangeCategorias(
      categoriasNormalizadas.map((cat) =>
        cat.id !== categoriaId ? cat : { ...cat, items: cat.items.filter((it) => it.id !== itemId) }
      )
    );
  };

  // Ítems extra — lista plana, independiente de las 5 categorías del modo
  // Detallado (esos van con categoriaId; estos no tienen categoría).
  const agregarItemExtra = () => {
    onChangeGastosGeneralesItems([
      ...gastosGeneralesItems,
      { id: `gg-${Date.now()}`, descripcion: "", monto: 0 },
    ]);
  };

  const actualizarItemExtra = (id: string, campo: "descripcion" | "monto", valor: string) => {
    onChangeGastosGeneralesItems(
      gastosGeneralesItems.map((item) =>
        item.id !== id ? item : { ...item, [campo]: campo === "monto" ? parseFloat(valor) || 0 : valor }
      )
    );
  };

  const eliminarItemExtra = (id: string) => {
    onChangeGastosGeneralesItems(gastosGeneralesItems.filter((item) => item.id !== id));
  };

  const inputCls = "px-2 py-1 text-sm text-slate-700 bg-white border border-slate-200 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]";

  return (
    <div className="mt-6 bg-white rounded-[16px] border border-slate-300 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpandido((p) => !p)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors text-left group"
      >
        <div className="flex items-center gap-2.5">
          <Percent className="w-4 h-4 text-[#2563EB]" />
          <h2 className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">Gastos Generales y Beneficio</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs font-normal text-slate-400 whitespace-nowrap">
              Gastos Generales + Beneficio
            </span>
            {/* Negro, no azul — el azul acento (#2563EB) queda reservado
                solo para Precio Final y Leyes Sociales/BPS. Mismo tamaño
                que el título (text-sm) — antes se veía más grande y
                desequilibraba la fila. */}
            <span className="text-sm font-bold text-slate-900 tabular-nums">{fmtMoneda(montoCombinado, moneda)}</span>
          </div>
          <span className="text-slate-400 group-hover:text-slate-600 transition-colors">
            {expandido ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </span>
          {/* Mismo ancho de cola que la tabla de capítulos/rubros después
              del chevron (ver layoutTablaPresupuesto.ts) — sin esto, el
              monto quedaba alineado solo contra el chevron, no contra el
              TOTAL de la tabla. */}
          <span style={{ width: `calc(${RESERVA_COLA_TABLA} - 40px)` }} className="flex-shrink-0" aria-hidden="true" />
        </div>
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
            <div className="px-5 py-5 space-y-5" style={{ background: "#F8FAFC" }}>
              <p className="text-xs text-slate-400">
                Estos valores se usan como default para rubros nuevos — los rubros que ya tienen un APU guardado
                quedan con su valor congelado, aunque cambies el default acá después. Editables por rubro en el
                Análisis de Precios Unitarios, igual que siempre.
              </p>

              {/* Gastos Generales */}
              <div className="rounded-[10px] border border-slate-200 bg-white overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200">
                  <span className="text-xs font-bold text-[#1A3A5C] uppercase tracking-wide">Gastos Generales</span>
                  <div className="flex items-center gap-1 rounded-[8px] bg-slate-200/60 p-0.5">
                    {(["PORCENTAJE", "DETALLADO"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => onChangeModo(m)}
                        className={cn(
                          "px-2.5 py-1 rounded-[6px] text-xs font-medium transition-colors",
                          modo === m ? "bg-white text-[#1A3A5C] shadow-sm" : "text-slate-500 hover:text-slate-700"
                        )}
                      >
                        {m === "PORCENTAJE" ? "Porcentaje" : "Detallado"}
                      </button>
                    ))}
                  </div>
                </div>

                {modo === "PORCENTAJE" ? (
                  <div className="flex items-center px-4 py-3">
                    <div className="flex-1 min-w-0 pr-3">
                      <p className="text-sm text-slate-700">Gastos Generales por defecto</p>
                      <p className="text-xs text-slate-400 mt-0.5">Se precarga en el APU de cada rubro nuevo.</p>
                    </div>
                    <PctInput value={pctGGEfectivo} onChange={onChangeGastosGeneralesPctDefault} />
                  </div>
                ) : (
                  <div>
                    <div className="px-4 py-2.5 border-b border-slate-100 bg-amber-50/60">
                      <p className="text-xs text-amber-700">
                        En modo Detallado, los rubros nuevos arrancan con 0% de Gastos Generales en su propio APU —
                        el monto se cobra una sola vez acá y se suma al Resumen del Presupuesto.
                      </p>
                    </div>
                    {categoriasNormalizadas.map((cat) => {
                      const subtotalCat = cat.items.reduce((s, it) => s + (it.monto || 0), 0);
                      return (
                        <div key={cat.id} className="border-b border-slate-100 last:border-0">
                          <div className="flex items-center px-4 py-2 bg-slate-50/60">
                            <span className="flex-1 min-w-0 text-xs font-semibold text-slate-600">{cat.nombre}</span>
                            <span className="text-xs font-semibold tabular-nums text-slate-500">
                              {fmtMoneda(subtotalCat, moneda)}
                            </span>
                          </div>
                          {cat.items.map((item) => (
                            <div key={item.id} className="flex items-center gap-2 px-4 py-1.5">
                              <input
                                type="text"
                                value={item.descripcion}
                                onChange={(e) => actualizarItem(cat.id, item.id, "descripcion", e.target.value)}
                                placeholder="Descripción del ítem"
                                className={cn(inputCls, "flex-1 min-w-0")}
                              />
                              <input
                                type="number"
                                value={item.monto === 0 ? "" : item.monto}
                                onChange={(e) => actualizarItem(cat.id, item.id, "monto", e.target.value)}
                                placeholder="0"
                                className={cn(inputCls, "w-28 text-right tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none")}
                              />
                              <button
                                onClick={() => eliminarItem(cat.id, item.id)}
                                className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0"
                                aria-label="Quitar ítem"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                          <div className="px-4 py-1.5">
                            <button
                              onClick={() => agregarItem(cat.id)}
                              className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-[#2563EB] transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" /> Agregar ítem
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    <div className="flex items-center px-4 py-2 bg-slate-50">
                      <div className="flex-1 min-w-0 text-xs font-bold text-[#1A3A5C] uppercase tracking-wide">
                        Total Gastos Generales
                      </div>
                      <div className="text-base font-bold tabular-nums text-[#1A3A5C] pl-3">
                        {fmtMoneda(totalDetallado, moneda)}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Utilidades */}
              <div className="rounded-[10px] border border-slate-200 bg-white overflow-hidden">
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
                  <span className="text-xs font-bold text-[#1A3A5C] uppercase tracking-wide">Utilidades</span>
                </div>
                <div className="flex items-center px-4 py-3">
                  <div className="flex-1 min-w-0 pr-3">
                    <p className="text-sm text-slate-700">Utilidad por defecto</p>
                    <p className="text-xs text-slate-400 mt-0.5">Se precarga en el APU de cada rubro nuevo.</p>
                  </div>
                  <PctInput value={pctUtilEfectivo} onChange={onChangeUtilidadPctDefault} />
                </div>
              </div>

              {/* Timbres CJP e Ítems extra — conceptualmente distintos de
                  Costos Indirectos/Utilidad de arriba (no entran en
                  montoCombinado, van directo a "Costo" en la cascada, ver
                  page.tsx) — viven acá solo por conveniencia de edición. */}
              <div className="rounded-[10px] border border-slate-200 bg-white overflow-hidden">
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
                  <span className="text-xs font-bold text-[#1A3A5C] uppercase tracking-wide">Timbres CJP e ítems extra</span>
                </div>

                <div className="flex items-center px-4 py-1.5 border-b border-slate-50">
                  <div className="flex-1 min-w-0 text-sm text-slate-700">Timbres CJP</div>
                  <input
                    type="number"
                    value={timbresCJP === 0 ? "" : timbresCJP}
                    onChange={(e) => onChangeTimbresCJP(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className={cn(inputCls, "w-28 text-right tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none")}
                  />
                </div>

                {gastosGeneralesItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 px-4 py-1.5 border-b border-slate-50">
                    <input
                      type="text"
                      value={item.descripcion}
                      onChange={(e) => actualizarItemExtra(item.id, "descripcion", e.target.value)}
                      placeholder="Descripción del ítem"
                      className={cn(inputCls, "flex-1 min-w-0")}
                    />
                    <input
                      type="number"
                      value={item.monto === 0 ? "" : item.monto}
                      onChange={(e) => actualizarItemExtra(item.id, "monto", e.target.value)}
                      placeholder="0"
                      className={cn(inputCls, "w-28 text-right tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none")}
                    />
                    <button
                      onClick={() => eliminarItemExtra(item.id)}
                      className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0"
                      aria-label="Quitar ítem"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                <div className="px-4 py-2">
                  <button
                    onClick={agregarItemExtra}
                    className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-[#2563EB] transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar ítem
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
