"use client";

import { useState, useEffect } from "react";
import { Percent, ChevronDown, ChevronRight, Plus, X, Lock, Loader2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  CATEGORIAS_GASTOS_GENERALES_FIJAS,
  normalizarCategoriasGastosGenerales,
  sumarGastosGeneralesDetallado,
  sumarItemsExtraGastosGenerales,
  ITEMS_SUGERIDOS_GASTOS_ADMIN,
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
  // Para el preview/aplicar de "Aplicar a rubros existentes" (ver
  // POST /api/proyectos/[id]/propagar-utilidad).
  proyectoId: string;
  moneda: string;
  modo: ModoGastosGenerales;
  // null = todavía no se guardó ningún default explícito — se usa 15/10
  // (mismo comportamiento que antes de esta feature).
  gastosGeneralesPctDefault: number | null;
  utilidadPctDefault: number | null;
  // Imprevistos: % sobre el Costo Directo (null = 0%) y su monto ya
  // calculado (calcularImprevistos, gastosGenerales.ts) solo para
  // mostrarlo. El total real los trae sumados dentro de
  // costosIndirectosAgregados — esta tarjeta no recalcula nada del total.
  imprevistosPct: number | null;
  montoImprevistos: number;
  categorias: CategoriaGastoGeneral[] | null;
  // Ya calculados a nivel proyecto (ver costoAgregado.ts) — se muestran
  // combinados ($ único) en el header colapsado, mismo patrón que ya usa
  // Leyes Sociales. No se recalculan acá, son la misma fuente de verdad
  // que usa la cascada Costo Directo → Costo Total → Precio Final.
  costosIndirectosAgregados: number;
  utilidadAgregada: number;
  // Ítems extra — lista plana por monto (Proyecto.gastosGeneralesItems),
  // aparte de las 5 categorías del modo Detallado y válida en los dos
  // modos. SÍ suman: calcularCostosIndirectosAgregados (costoAgregado.ts)
  // los incluye dentro de costosIndirectosAgregados, así que ya están en
  // el monto combinado del header de esta tarjeta, en Costo Total / IVA /
  // Precio Final, en el PDF, el contrato y la liquidación final. Entran a
  // la base del IVA (no son exentos). Esta tarjeta solo los edita y
  // muestra su subtotal — no recalcula nada del total. Timbres CJP se sacó
  // de acá — ahora es un ítem más dentro de una categoría del modo
  // Detallado (ver personal_tecnico en gastosGenerales.ts), con exentoIVA
  // en vez de un campo aparte.
  gastosGeneralesItems: ItemGastoGeneral[];
  onChangeModo: (modo: ModoGastosGenerales) => void;
  onChangeGastosGeneralesPctDefault: (v: number) => void;
  onChangeUtilidadPctDefault: (v: number) => void;
  onChangeImprevistosPct: (v: number | null) => void;
  onChangeCategorias: (categorias: CategoriaGastoGeneral[]) => void;
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

/** Parsea el texto tipeado de un % con coma o punto decimal ("2,5" o
 *  "2.5" → 2.5). Solo cambia la coma por punto: a diferencia de
 *  parsearDineroTipeado (page.tsx, pensada para montos con "." de miles),
 *  acá el "." SIEMPRE es decimal — un porcentaje nunca llega a miles.
 *  "" = vacío = null (0%). Fuera de 0-100 o con basura = "invalido". */
function parsearPorcentaje(texto: string): number | null | "invalido" {
  const limpio = texto.trim().replace(",", ".");
  if (limpio === "") return null;
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(limpio)) return "invalido";
  const n = Number(limpio);
  if (!Number.isFinite(n) || n < 0 || n > 100) return "invalido";
  return n;
}

/** Input de porcentaje decimal con coma uruguaya ("2,5"), 0 a 100, vacío =
 *  0%. Guarda el texto tipeado aparte del número para poder escribir "2,"
 *  sin que se pise; solo avisa al padre cuando el valor es válido. */
function PctDecimalInput({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const aTexto = (v: number | null) => (v == null ? "" : String(v).replace(".", ","));
  const [texto, setTexto] = useState(aTexto(value));
  const [invalido, setInvalido] = useState(false);

  // Si el valor cambia desde afuera (ej. carga del proyecto) y no coincide
  // con lo tipeado, se refleja. Mientras se tipea un valor válido, padre y
  // texto coinciden y esto no hace nada.
  useEffect(() => {
    const actual = parsearPorcentaje(texto);
    if (actual !== "invalido" && actual !== value) setTexto(aTexto(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span className="inline-flex items-center gap-1">
        <input
          type="text"
          inputMode="decimal"
          value={texto}
          aria-label="Imprevistos %"
          placeholder="0"
          onChange={(e) => {
            const t = e.target.value;
            setTexto(t);
            const r = parsearPorcentaje(t);
            if (r === "invalido") {
              setInvalido(true);
              return;
            }
            setInvalido(false);
            onChange(r);
          }}
          className={cn(
            "w-20 px-2 py-1 text-right text-sm font-semibold text-slate-700 tabular-nums bg-white border rounded-[6px] focus:outline-none focus:ring-2",
            invalido
              ? "border-red-300 focus:ring-red-200 focus:border-red-400"
              : "border-slate-200 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
          )}
        />
        <span className="text-sm text-slate-400">%</span>
      </span>
      {invalido && <span className="text-xs text-red-600">Ingresá un valor entre 0 y 100</span>}
    </span>
  );
}

/** Id del <datalist> de sugerencias de un ítem según su categoría —
 *  un datalist por categoría, no uno global, para poder PRIORIZAR
 *  (ver sugerenciasOrdenadas) sin filtrar ni bloquear nada. */
function idDatalistGG(categoriaId: string): string {
  return `sugerencias-gg-${categoriaId}`;
}

/** Los 24 ítems sugeridos (ver ITEMS_SUGERIDOS_GASTOS_ADMIN), reordenados
 *  con los de la propia categoría primero — el navegador filtra por
 *  texto tipeado solo, así que esto es lo único que tenemos para
 *  "priorizar" con <datalist> nativo, sin bloquear que aparezcan los de
 *  otra categoría si el texto matchea igual. */
function sugerenciasOrdenadas(categoriaId: string) {
  const propios = ITEMS_SUGERIDOS_GASTOS_ADMIN.filter((it) => it.categoriaId === categoriaId);
  const otros = ITEMS_SUGERIDOS_GASTOS_ADMIN.filter((it) => it.categoriaId !== categoriaId);
  return [...propios, ...otros];
}

export default function SeccionGastosGeneralesUtilidades({
  proyectoId,
  moneda,
  modo,
  gastosGeneralesPctDefault,
  utilidadPctDefault,
  imprevistosPct,
  montoImprevistos,
  categorias,
  costosIndirectosAgregados,
  utilidadAgregada,
  gastosGeneralesItems,
  onChangeModo,
  onChangeGastosGeneralesPctDefault,
  onChangeUtilidadPctDefault,
  onChangeImprevistosPct,
  onChangeCategorias,
  onChangeGastosGeneralesItems,
}: Props) {
  const [expandido, setExpandido] = useState(false);

  const pctGGEfectivo = gastosGeneralesPctDefault ?? 15;
  const pctUtilEfectivo = utilidadPctDefault ?? 10;

  // ── Propagar Utilidad a rubros existentes ──────────────────────────────
  // Distinto del campo "Utilidad por defecto" de arriba (PctInput, solo
  // pre-carga rubros NUEVOS) — esto SÍ toca los existentes, salvo los que
  // tengan el candado (APU.utilidadFija). Mismo patrón de dos pasos
  // (dry-run → modal de confirmación → aplicar) que ya usa
  // SeccionActualizacionPrecios.tsx para ICCV/paramétrica.
  const [consultandoProp, setConsultandoProp] = useState(false);
  const [previewProp, setPreviewProp] = useState<{ actualizarian: number; protegidos: { rubroId: string; codigo: string; descripcion: string }[]; nuevoPct: number } | null>(null);
  const [errorProp, setErrorProp] = useState<string | null>(null);
  const [mostrarModalProp, setMostrarModalProp] = useState(false);
  const [aplicandoProp, setAplicandoProp] = useState(false);

  async function consultarPropagacion() {
    setConsultandoProp(true);
    setErrorProp(null);
    setPreviewProp(null);
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/propagar-utilidad`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ utilidadPct: pctUtilEfectivo, dryRun: true }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setErrorProp(data.mensaje ?? data.error ?? "No se pudo calcular la propagación. Probá de nuevo.");
        return;
      }
      setPreviewProp(data);
      setMostrarModalProp(true);
    } catch {
      setErrorProp("No se pudo calcular la propagación. Probá de nuevo.");
    } finally {
      setConsultandoProp(false);
    }
  }

  async function aplicarPropagacion() {
    if (!previewProp) return;
    setAplicandoProp(true);
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/propagar-utilidad`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ utilidadPct: previewProp.nuevoPct }),
      });
      if (!res.ok) throw new Error();
      setMostrarModalProp(false);
      window.location.reload();
    } catch {
      setErrorProp("No se pudo aplicar la propagación de Utilidad.");
      setAplicandoProp(false);
    }
  }
  const categoriasNormalizadas = normalizarCategoriasGastosGenerales(categorias);
  const totalDetallado = categoriasNormalizadas.reduce(
    (s, cat) => s + cat.items.reduce((si, it) => si + (it.monto || 0), 0),
    0
  );
  // Monto combinado para el header colapsado — Costos Indirectos +
  // Utilidad, ya calculados a nivel proyecto (props), mismo patrón que
  // Leyes Sociales ("$X" único junto al chevron).
  const montoCombinado = costosIndirectosAgregados + utilidadAgregada;
  // Solo para mostrar el subtotal del bloque "Ítems extra" — el total real
  // ya los trae sumados dentro de costosIndirectosAgregados.
  const sumaItemsExtra = sumarItemsExtraGastosGenerales(gastosGeneralesItems);

  const agregarItem = (categoriaId: string) => {
    onChangeCategorias(
      categoriasNormalizadas.map((cat) =>
        cat.id !== categoriaId
          ? cat
          : { ...cat, items: [...cat.items, { id: `gg-${Date.now()}`, descripcion: "", monto: 0, exentoIVA: false }] }
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

  const alternarExentoItem = (categoriaId: string, itemId: string) => {
    onChangeCategorias(
      categoriasNormalizadas.map((cat) =>
        cat.id !== categoriaId
          ? cat
          : { ...cat, items: cat.items.map((it) => (it.id !== itemId ? it : { ...it, exentoIVA: !it.exentoIVA })) }
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
      // exentoIVA sin efecto acá — los Ítems extra se suman siempre a la
      // base del IVA (calcularCostosIndirectosExento solo mira los ítems
      // de las categorías del Detallado, nunca estos).
      { id: `gg-${Date.now()}`, descripcion: "", monto: 0, exentoIVA: false },
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
                          {/* Sugerencias de autocompletado — los 24 ítems que
                              antes vivían en la Biblioteca (capítulo "Gastos
                              Administrativos y Conexiones", eliminado, ver
                              ITEMS_SUGERIDOS_GASTOS_ADMIN). Un <datalist>
                              nativo por categoría, mismo patrón ya usado en
                              ModalImportarPrecios.tsx (proveedores) — no
                              inventa un combobox nuevo. Nunca restringe texto
                              libre, solo sugiere. */}
                          <datalist id={idDatalistGG(cat.id)}>
                            {sugerenciasOrdenadas(cat.id).map((s) => (
                              <option key={s.descripcion} value={s.descripcion} />
                            ))}
                          </datalist>
                          {cat.items.map((item) => (
                            <div key={item.id} className="flex items-center gap-2 px-4 py-1.5">
                              <input
                                type="text"
                                list={idDatalistGG(cat.id)}
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
                              <label
                                className="flex items-center gap-1 flex-shrink-0 cursor-pointer"
                                title="Exento de IVA — no entra en la base del 22% (ej. Timbres CJP, tasas estatales)"
                              >
                                <input
                                  type="checkbox"
                                  checked={item.exentoIVA}
                                  onChange={() => alternarExentoItem(cat.id, item.id)}
                                  className="rounded border-slate-300"
                                />
                                <span className="text-[10px] text-slate-400 whitespace-nowrap">Exento IVA</span>
                              </label>
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

              {/* Imprevistos — reserva % sobre el Costo Directo que se suma
                  a Gastos Generales (dentro de costosIndirectosAgregados,
                  sin fila propia en la cascada) y entra en la base del
                  IVA. Vacío = 0%. */}
              <div className="rounded-[10px] border border-slate-200 bg-white overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200">
                  <span className="text-xs font-bold text-[#1A3A5C] uppercase tracking-wide">Imprevistos</span>
                  <span className="text-xs font-semibold tabular-nums text-slate-500">{fmtMoneda(montoImprevistos, moneda)}</span>
                </div>
                <div className="flex items-center px-4 py-3">
                  <div className="flex-1 min-w-0 pr-3">
                    <p className="text-sm text-slate-700">Imprevistos %</p>
                    <p className="text-xs text-slate-400 mt-0.5">Reserva para imprevistos sobre el Costo Directo. Se suma a Gastos Generales.</p>
                  </div>
                  <PctDecimalInput value={imprevistosPct} onChange={onChangeImprevistosPct} />
                </div>
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
                <div className="px-4 pb-3">
                  <button
                    onClick={consultarPropagacion}
                    disabled={consultandoProp}
                    className="flex items-center gap-1.5 text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors disabled:opacity-60"
                  >
                    {consultandoProp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Percent className="w-3.5 h-3.5" />}
                    {consultandoProp ? "Calculando..." : `Aplicar ${pctUtilEfectivo}% a rubros existentes`}
                  </button>
                  <p className="text-xs text-slate-400 mt-1">
                    Propaga este % a todos los rubros que ya tienen APU, salvo los que tengan el candado <Lock className="inline w-3 h-3 -mt-0.5" /> fijado.
                  </p>
                  {errorProp && (
                    <div className="flex items-start gap-2 rounded-[10px] bg-amber-50 border border-amber-200 px-3 py-2.5 mt-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-amber-800">{errorProp}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Ítems extra — montos fijos que se suman a Gastos
                  Generales en cualquiera de los dos modos (ya incluidos
                  en el monto del header, ver comentario de la prop
                  gastosGeneralesItems). Timbres CJP se sacó de este
                  bloque: ahora es un ítem más dentro de personal_tecnico,
                  arriba, en modo Detallado. */}
              <div className="rounded-[10px] border border-slate-200 bg-white overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200">
                  <span className="text-xs font-bold text-[#1A3A5C] uppercase tracking-wide">Ítems extra</span>
                  <span className="text-xs font-semibold tabular-nums text-slate-500">{fmtMoneda(sumaItemsExtra, moneda)}</span>
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
                <p className="px-4 pb-2.5 text-xs text-slate-400">
                  Montos fijos que se suman a Gastos Generales (en modo Porcentaje o Detallado) y entran en la base del IVA.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de confirmación — propagar Utilidad a rubros existentes.
          Mismo patrón visual que los modales de ICCV/paramétrica en
          SeccionActualizacionPrecios.tsx. */}
      <AnimatePresence>
        {mostrarModalProp && previewProp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
            onClick={() => !aplicandoProp && setMostrarModalProp(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-[16px] shadow-xl max-w-md w-full p-6"
            >
              <h3 className="text-base font-bold text-[#1A3A5C] mb-2">Confirmar Utilidad {previewProp.nuevoPct}% en rubros existentes</h3>
              <p className="text-sm text-slate-600 mb-3">
                <span className="font-semibold">{previewProp.actualizarian} rubro{previewProp.actualizarian === 1 ? "" : "s"}</span> se
                actualizaría{previewProp.actualizarian === 1 ? "" : "n"} a Utilidad {previewProp.nuevoPct}%, recalculando su precio unitario.
                {previewProp.protegidos.length > 0 && (
                  <> <span className="font-semibold">{previewProp.protegidos.length}</span> protegido{previewProp.protegidos.length === 1 ? "" : "s"} por candado no se toca{previewProp.protegidos.length === 1 ? "" : "n"}.</>
                )}
              </p>
              {previewProp.protegidos.length > 0 && (
                <div className="rounded-[10px] bg-amber-50 border border-amber-200 px-3 py-2 mb-4 max-h-40 overflow-y-auto">
                  <p className="text-[11px] font-medium text-amber-800 mb-1 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Rubros protegidos (no se tocan):
                  </p>
                  <ul className="space-y-0.5">
                    {previewProp.protegidos.map((r) => (
                      <li key={r.rubroId} className="text-[11px] text-amber-700">
                        {r.codigo} — {r.descripcion || "Rubro sin nombre"}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-sm text-slate-600 mb-6">Esta acción no se puede deshacer automáticamente. ¿Continuar?</p>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setMostrarModalProp(false)}
                  disabled={aplicandoProp}
                  className="px-4 py-2.5 rounded-[10px] text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  onClick={aplicarPropagacion}
                  disabled={aplicandoProp || previewProp.actualizarian === 0}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1A3A5C] transition-colors disabled:opacity-60"
                >
                  {aplicandoProp && <Loader2 className="w-4 h-4 animate-spin" />}
                  {aplicandoProp ? "Aplicando..." : `Aplicar a ${previewProp.actualizarian} rubro${previewProp.actualizarian === 1 ? "" : "s"}`}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
