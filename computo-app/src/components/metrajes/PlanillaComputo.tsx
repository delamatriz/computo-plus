"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Plus, X, ChevronDown, Sparkles, Loader2, Calculator, AlertTriangle, CheckCircle2, Ruler } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtNum, fmtUnidad, subtotalFila, rubroCompatibleConFila, type MetrajeFila, type RubroOption, type ActualizacionComputo } from "./metrajeFila";

// Estado del modal de "Aplicar al presupuesto" — dos pasos (preview sin
// tocar la base → confirmar y aplicar de verdad) más los estados de
// carga/error de cada uno. Ver diseño confirmado y
// POST /api/proyectos/[id]/aplicar-computo.
type EstadoModalAplicar =
  | { paso: "cargando" }
  | { paso: "preview"; actualizaciones: ActualizacionComputo[] }
  | { paso: "aplicando"; actualizaciones: ActualizacionComputo[] }
  | { paso: "resultado"; actualizaciones: ActualizacionComputo[] }
  | { paso: "error"; mensaje: string };

// Input de Largo/Ancho/Alto/Cantidad — comparten el mismo problema: un
// <input type="number"> nativo solo acepta punto como separador
// decimal, así que tipear "0,45" (convención uruguaya) pierde la coma y
// termina guardando 45. Acá se usa type="text" + inputMode="decimal" en
// su lugar, aceptando coma o punto al tipear (se normaliza a punto antes
// de subir el cambio, así onActualizarFila/parseFloat en page.tsx no
// necesitan cambiar). En reposo (sin foco) se muestra fmtNum(value) —
// 2 decimales fijos con coma, igual que el resto de la Planilla — y al
// enfocar arranca la edición desde esa misma versión redondeada (no
// desde el valor crudo guardado, que en filas medidas sobre el plano
// puede traer ruido de punto flotante — ej. 0.6125099412434896 — y se
// veía horrible apenas se tocaba el campo). Esto es solo lo que se
// MUESTRA al arrancar a editar: no dispara ningún guardado — el PATCH
// solo sale de manejarCambio, cuando el usuario efectivamente tipea
// algo, así que enfocar y desenfocar sin tocar nada nunca reescribe el
// valor guardado con la versión redondeada.
function InputNumericoFila({
  value,
  onChange,
  placeholder = "—",
  className,
}: {
  value: number | null;
  /** Ya normalizado (coma convertida a punto) — se pasa directo a
   * onActualizarFila, que hace value === "" ? null : parseFloat(value). */
  onChange: (valorCrudo: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [enfocado, setEnfocado] = useState(false);
  const [texto, setTexto] = useState("");

  const manejarFoco = () => {
    setTexto(value != null ? fmtNum(value) : "");
    setEnfocado(true);
  };

  const manejarCambio = (e: React.ChangeEvent<HTMLInputElement>) => {
    const crudo = e.target.value;
    setTexto(crudo);
    const normalizado = crudo.replace(",", ".");
    // No propaga estados intermedios claramente inválidos (una coma o un
    // guión solos, recién tipeados) — evita guardar NaN/0 espurios a
    // mitad de tipeo; en cuanto el texto vuelve a parsear bien (o queda
    // vacío del todo) se propaga normal.
    if (normalizado === "" || !isNaN(parseFloat(normalizado))) {
      onChange(normalizado);
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={enfocado ? texto : value != null ? fmtNum(value) : ""}
      onFocus={manejarFoco}
      onBlur={() => setEnfocado(false)}
      onChange={manejarCambio}
      placeholder={placeholder}
      className={className}
    />
  );
}

// Planilla de cómputo — vive dentro del Visor (Página 2), arriba del
// documento principal (ver UI_UX_REDESIGN.md 2quinquies). El estado de
// las filas lo dueña la página /proyectos/[id]/visor (necesita `filas`
// también para exportar a Excel); este componente es presentacional.
// La Calculadora rápida se sacó de acá — quedó redundante con el botón
// flotante circular (CalculadoraFlotante, global en toda la app), que
// es ahora la única forma de acceder a ella desde esta página.
export default function PlanillaComputo({
  filas,
  rubrosDisponibles,
  totalGeneral,
  iaTexto,
  iaCargando,
  onActualizarFila,
  onAgregarFila,
  onEliminarFila,
  onIaTextoChange,
  onAgregarFilaIA,
  onExportarExcel,
  onAplicarComputoPreview,
  onAplicarComputoConfirmar,
  onMedirAnchoParaFila,
}: {
  filas: MetrajeFila[];
  rubrosDisponibles: RubroOption[];
  totalGeneral: number;
  iaTexto: string;
  iaCargando: boolean;
  onActualizarFila: (id: string, field: keyof MetrajeFila, value: string) => void;
  onAgregarFila: () => void;
  onEliminarFila: (id: string) => void;
  onIaTextoChange: (value: string) => void;
  onAgregarFilaIA: () => void;
  onExportarExcel: () => void;
  onAplicarComputoPreview: () => Promise<ActualizacionComputo[]>;
  onAplicarComputoConfirmar: () => Promise<ActualizacionComputo[]>;
  /** Arranca el modo "medir ANCHO hacia esta fila" directo en el plano
   * (ícono de regla, ver Visor.tsx ControlesMedicion.medicionObjetivo) —
   * undefined mientras el Visor no expuso sus controles todavía (recién
   * montado, o documento principal sin PDF/calibración). Solo se ofrece
   * en filas con medicionId (nacidas de un trazo) — una fila manual/IA
   * no tiene un plano de origen del que medir nada. */
  onMedirAnchoParaFila?: (filaId: string, descripcion: string) => void;
}) {
  const inputCls =
    "w-full text-sm text-slate-600 bg-transparent focus:outline-none focus:bg-white focus:rounded focus:ring-1 focus:ring-[#2563EB]/20 placeholder:text-slate-300";

  // Colapsable — arriba del Visor ya no hay tanta altura de sobra como
  // antes (columna al costado); con pantallas más bajas (ej. 1280x720)
  // Planilla+Visor no entran ambos cómodos sin colapsar uno de los dos.
  // Empieza expandida (el pedido de este cambio fue "que sea más
  // visible"), con la opción de colapsarla para recuperar alto para el
  // documento — ver nota en SeccionMetrajesPresupuesto.tsx.
  const [expandido, setExpandido] = useState(true);

  const [modalAplicar, setModalAplicar] = useState<EstadoModalAplicar | null>(null);

  const abrirModalAplicar = async () => {
    setModalAplicar({ paso: "cargando" });
    try {
      const actualizaciones = await onAplicarComputoPreview();
      setModalAplicar({ paso: "preview", actualizaciones });
    } catch {
      setModalAplicar({ paso: "error", mensaje: "No se pudo calcular la actualización. Probá de nuevo." });
    }
  };

  const confirmarAplicar = async () => {
    setModalAplicar((m) => (m && m.paso === "preview" ? { paso: "aplicando", actualizaciones: m.actualizaciones } : m));
    try {
      const actualizaciones = await onAplicarComputoConfirmar();
      setModalAplicar({ paso: "resultado", actualizaciones });
    } catch {
      setModalAplicar({ paso: "error", mensaje: "No se pudo aplicar al presupuesto. Probá de nuevo." });
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Planilla de cómputo ───────────────────────────── */}
      <div className="bg-white rounded-[16px] border border-slate-300 shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-3.5 border-b border-slate-200">
          <button
            onClick={() => setExpandido((v) => !v)}
            className="flex items-center gap-2 text-left group flex-1 min-w-0"
          >
            <span className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">
              Planilla de cómputo
            </span>
            <ChevronDown
              className={cn(
                "w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-transform flex-shrink-0",
                !expandido && "-rotate-90"
              )}
            />
          </button>
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:flex-shrink-0">
            <button
              onClick={abrirModalAplicar}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[#2563EB] text-white text-xs font-semibold hover:bg-[#1D4ED8] transition-colors"
            >
              <Calculator className="w-3.5 h-3.5" /> Aplicar al presupuesto
            </button>
            <button
              onClick={onExportarExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-slate-300 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Exportar Excel
            </button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {expandido && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
        <div className="overflow-x-auto">
          <div className="min-w-[880px]">
            {/* Cabecera */}
            <div className="flex items-center bg-slate-50 border-b border-slate-200" style={{ height: 32 }}>
              <div className="flex-1 px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Descripción</div>
              <div style={{ width: 88, flexShrink: 0 }} className="px-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-right">Largo</div>
              <div style={{ width: 108, flexShrink: 0 }} className="px-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-right">Ancho</div>
              <div style={{ width: 88, flexShrink: 0 }} className="px-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-right">Alto</div>
              <div style={{ width: 80, flexShrink: 0 }} className="px-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-right">Cant.</div>
              <div style={{ width: 110, flexShrink: 0 }} className="px-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-right">Subtotal</div>
              <div style={{ width: 220, flexShrink: 0 }} className="px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Rubro vinculado</div>
              <div style={{ width: 36, flexShrink: 0 }} />
            </div>

            {/* Filas */}
            {filas.map((fila, idx) => {
              const subtotal = subtotalFila(fila);
              return (
                <div
                  key={fila.id}
                  className={cn(
                    "flex items-center hover:bg-blue-50/20 transition-colors",
                    idx % 2 === 1 ? "bg-[#F8FAFC]" : "bg-white"
                  )}
                  style={{ minHeight: 36, borderBottom: "1px solid #F1F5F9" }}
                >
                  <div className="flex-1 px-3">
                    <input
                      type="text"
                      value={fila.descripcion}
                      onChange={(e) => onActualizarFila(fila.id, "descripcion", e.target.value)}
                      placeholder="Descripción del elemento"
                      className={inputCls}
                    />
                  </div>
                  <div style={{ width: 88, flexShrink: 0 }} className="px-2">
                    <InputNumericoFila
                      value={fila.largo}
                      onChange={(v) => onActualizarFila(fila.id, "largo", v)}
                      className={cn(inputCls, "text-right")}
                    />
                  </div>
                  <div style={{ width: 108, flexShrink: 0 }} className="px-2 flex items-center gap-1">
                    <InputNumericoFila
                      value={fila.ancho}
                      onChange={(v) => onActualizarFila(fila.id, "ancho", v)}
                      className={cn(inputCls, "text-right")}
                    />
                    {/* Espacio del ícono reservado con ancho fijo SIEMPRE
                        presente (tenga o no medicionId la fila) — si no,
                        el input de Ancho competía por ese ancho contra el
                        ícono cuando aparecía, quedando ~20px más angosto
                        que Largo/Alto/Cantidad y descolocando toda la fila
                        (ver ronda de investigación del bug "descentrado"). */}
                    <div style={{ width: 16, flexShrink: 0 }} className="flex items-center justify-center">
                      {fila.medicionId && onMedirAnchoParaFila && (
                        <button
                          type="button"
                          onClick={() => onMedirAnchoParaFila(fila.id, fila.descripcion || "elemento sin descripción")}
                          title="Medir el ancho directo en el plano"
                          className="p-0.5 rounded text-slate-300 hover:text-[#2563EB] hover:bg-blue-50 transition-colors"
                        >
                          <Ruler className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ width: 88, flexShrink: 0 }} className="px-2">
                    <InputNumericoFila
                      value={fila.alto}
                      onChange={(v) => onActualizarFila(fila.id, "alto", v)}
                      className={cn(inputCls, "text-right")}
                    />
                  </div>
                  <div style={{ width: 80, flexShrink: 0 }} className="px-2">
                    <InputNumericoFila
                      value={fila.cantidad}
                      onChange={(v) => onActualizarFila(fila.id, "cantidad", v)}
                      className={cn(inputCls, "text-right")}
                    />
                  </div>
                  <div style={{ width: 110, flexShrink: 0 }} className="px-2 text-right">
                    <span className={cn("text-sm font-semibold tabular-nums whitespace-nowrap", subtotal > 0 ? "text-[#2563EB]" : "text-slate-300")}>
                      {subtotal > 0 ? fmtNum(subtotal) : "—"}
                    </span>
                    {subtotal > 0 && fila.unidad && (
                      <span className="text-[10px] font-normal text-slate-400 ml-0.5">{fmtUnidad(fila.unidad)}</span>
                    )}
                  </div>
                  <div style={{ width: 220, flexShrink: 0 }} className="px-3 py-1.5">
                    <select
                      value={fila.rubroId ?? ""}
                      onChange={(e) => onActualizarFila(fila.id, "rubroId", e.target.value)}
                      className={cn(inputCls, "cursor-pointer", !fila.rubroId && "text-slate-400")}
                    >
                      <option value="">Sin vincular</option>
                      {Object.entries(
                        rubrosDisponibles.reduce<Record<string, RubroOption[]>>((acc, r) => {
                          (acc[r.capituloNombre] ??= []).push(r);
                          return acc;
                        }, {})
                      ).map(([capNombre, rubros]) => (
                        <optgroup key={capNombre} label={capNombre}>
                          {rubros.map((r) => {
                            // Si la fila ya tiene una unidad propia (cargada a
                            // mano o heredada de una medición — ver
                            // guardarMedicion en page.tsx), no se puede vincular
                            // a un rubro de unidad distinta (m² vs m³, etc) —
                            // salvo que el rubro sea "GL" (ítem Global, no
                            // depende de ninguna unidad), ver
                            // rubroCompatibleConFila en metrajeFila.ts.
                            const incompatible = !!fila.unidad && !rubroCompatibleConFila(fila.unidad, r.unidad);
                            return (
                              <option
                                key={r.id}
                                value={r.id}
                                disabled={incompatible}
                                title={incompatible ? `Unidad distinta: fila en ${fila.unidad}, rubro en ${r.unidad}` : undefined}
                              >
                                {r.nombre} ({r.unidad}){incompatible ? " — unidad distinta" : ""}
                              </option>
                            );
                          })}
                        </optgroup>
                      ))}
                    </select>
                    {(() => {
                      // Si NINGÚN rubro del proyecto es compatible (ni por
                      // unidad exacta ni por la excepción GL), el <select>
                      // queda con todas las opciones deshabilitadas salvo
                      // "Sin vincular" — sin este mensaje, eso se veía
                      // idéntico a un desplegable roto (el único indicio era
                      // el sufijo "— unidad distinta" dentro de cada opción
                      // larga, y el title, que no sirve en mobile porque
                      // depende de hover). Visible siempre que aplica, sin
                      // necesitar hover ni tap.
                      const unidadFila = fila.unidad;
                      if (!unidadFila) return null;
                      const hayCompatible = rubrosDisponibles.some((r) => rubroCompatibleConFila(unidadFila, r.unidad));
                      if (hayCompatible) return null;
                      return (
                        <p className="text-[10px] text-red-500 mt-0.5 leading-tight">
                          Ningún rubro tiene unidad {unidadFila} (ni es Global) — no se puede vincular
                        </p>
                      );
                    })()}
                  </div>
                  <div style={{ width: 36, flexShrink: 0 }} className="flex items-center justify-center">
                    <button
                      onClick={() => onEliminarFila(fila.id)}
                      className="text-slate-300 hover:text-red-500 transition-colors"
                      aria-label="Eliminar fila"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Agregar fila */}
            <div className="flex items-center pl-3" style={{ height: 32, borderTop: "1px solid #F1F5F9" }}>
              <button
                onClick={onAgregarFila}
                className="flex items-center gap-1.5 text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
              >
                <Plus className="w-3 h-3" /> Agregar fila
              </button>
            </div>

            {/* Fila IA */}
            <div className="flex items-center gap-2 px-3 py-2.5 border-t border-slate-100 bg-[#F0F7FF]">
              <Sparkles className="w-4 h-4 text-[#2563EB] flex-shrink-0" />
              <input
                type="text"
                value={iaTexto}
                onChange={(e) => onIaTextoChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onAgregarFilaIA()}
                placeholder="Describí el elemento (ej: tabique de durlock 2.40m x 3.10m, 4 unidades) y la IA completa la fila"
                className="flex-1 min-w-0 text-sm text-slate-700 bg-white border border-blue-200 rounded-[8px] px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] placeholder:text-slate-400"
              />
              <button
                onClick={onAgregarFilaIA}
                disabled={!iaTexto.trim() || iaCargando}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-sm font-semibold transition-colors flex-shrink-0",
                  !iaTexto.trim() || iaCargando
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
                )}
              >
                {iaCargando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Generar fila
              </button>
            </div>

            {/* Total general */}
            <div className="flex items-center border-t-2 border-slate-300 bg-white" style={{ height: 40 }}>
              <div className="flex-1 px-3 text-sm font-bold text-slate-400 uppercase tracking-wide">Total general</div>
              <div style={{ width: 88 }} />
              <div style={{ width: 108 }} />
              <div style={{ width: 88 }} />
              <div style={{ width: 80 }} />
              <div style={{ width: 110, flexShrink: 0 }} className="px-2 text-right">
                <span className="text-base font-bold tabular-nums" style={{ color: "#1A3A5C" }}>
                  {fmtNum(totalGeneral)}
                </span>
              </div>
              <div style={{ width: 220 }} />
              <div style={{ width: 36 }} />
            </div>
          </div>
        </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Modal "Aplicar al presupuesto" — preview → confirmar → resultado.
          Mismo patrón visual que el modal de actualización de precios por
          índice (SeccionActualizacionPrecios.tsx): overlay + card centrada. ── */}
      <AnimatePresence>
        {modalAplicar && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
            onClick={() => modalAplicar.paso !== "aplicando" && modalAplicar.paso !== "cargando" && setModalAplicar(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-[16px] shadow-xl max-w-2xl w-full p-6"
            >
              {modalAplicar.paso === "cargando" && (
                <div className="flex items-center gap-3 py-6 justify-center text-slate-500">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Calculando totales por rubro...</span>
                </div>
              )}

              {modalAplicar.paso === "error" && (
                <>
                  <h3 className="text-base font-bold text-[#1A3A5C] mb-2">Aplicar al presupuesto</h3>
                  <div className="flex items-start gap-2 rounded-[10px] bg-red-50 border border-red-200 px-4 py-3 mb-5">
                    <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-red-800">{modalAplicar.mensaje}</p>
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={() => setModalAplicar(null)}
                      className="px-4 py-2.5 rounded-[10px] text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      Cerrar
                    </button>
                  </div>
                </>
              )}

              {(modalAplicar.paso === "preview" || modalAplicar.paso === "aplicando" || modalAplicar.paso === "resultado") && (
                <>
                  <h3 className="text-base font-bold text-[#1A3A5C] mb-1">
                    {modalAplicar.paso === "resultado" ? "Presupuesto actualizado" : "Aplicar al presupuesto"}
                  </h3>
                  <p className="text-sm text-slate-600 mb-4">
                    {modalAplicar.paso === "resultado"
                      ? `${modalAplicar.actualizaciones.length} ${modalAplicar.actualizaciones.length === 1 ? "rubro actualizado" : "rubros actualizados"}.`
                      : "Suma las filas de la Planilla vinculadas a cada rubro, cruzando todos los documentos del proyecto."}
                  </p>

                  {modalAplicar.actualizaciones.length === 0 ? (
                    <p className="text-sm text-slate-500 py-4">
                      No hay filas vinculadas a ningún rubro todavía — vinculá filas en la columna &quot;Rubro vinculado&quot; antes de aplicar.
                    </p>
                  ) : (
                    <div className="max-h-[360px] overflow-y-auto rounded-[10px] border border-slate-200 mb-5">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 sticky top-0">
                          <tr>
                            <th className="text-left px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Rubro</th>
                            <th className="text-right px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Actual</th>
                            <th className="text-right px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Nuevo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {modalAplicar.actualizaciones.map((a) => (
                            <tr key={a.rubroId} className={cn("border-t border-slate-100", a.requiereConfirmacion && "bg-amber-50")}>
                              <td className="px-3 py-2 align-top">
                                <p className="text-slate-700">{a.nombre}</p>
                                <p className="text-[11px] text-slate-400">{a.capituloNombre}</p>
                                {a.desglosePorDocumento.length > 1 && (
                                  <p className="text-[11px] text-slate-500 mt-0.5">
                                    {a.desglosePorDocumento.map((d, i) => (
                                      <span key={i}>
                                        {i > 0 && " + "}
                                        {fmtNum(d.cantidad)} {a.unidad} ({d.documentoNombre}
                                        {d.paginaPDF ? `, pág ${d.paginaPDF}` : ""})
                                      </span>
                                    ))}
                                  </p>
                                )}
                                {a.requiereConfirmacion && (
                                  <p className="text-[11px] text-amber-700 flex items-center gap-1 mt-0.5">
                                    <AlertTriangle className="w-3 h-3 flex-shrink-0" /> Tiene una cantidad cargada a mano
                                  </p>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums text-slate-500 align-top whitespace-nowrap">
                                {fmtNum(a.cantidadActual)} {a.unidad}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums font-semibold align-top whitespace-nowrap" style={{ color: "#1A3A5C" }}>
                                {fmtNum(a.cantidadNueva)} {a.unidad}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-3">
                    {modalAplicar.paso === "resultado" ? (
                      <button
                        onClick={() => setModalAplicar(null)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1A3A5C] transition-colors"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Listo
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => setModalAplicar(null)}
                          disabled={modalAplicar.paso === "aplicando"}
                          className="px-4 py-2.5 rounded-[10px] text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-60"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={confirmarAplicar}
                          disabled={modalAplicar.paso === "aplicando" || modalAplicar.actualizaciones.length === 0}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1A3A5C] transition-colors disabled:opacity-60"
                        >
                          {modalAplicar.paso === "aplicando" && <Loader2 className="w-4 h-4 animate-spin" />}
                          {modalAplicar.paso === "aplicando" ? "Aplicando..." : "Confirmar y aplicar"}
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
