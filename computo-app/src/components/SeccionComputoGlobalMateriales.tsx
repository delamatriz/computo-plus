"use client";

import { useState, useMemo } from "react";
import { ChevronRight, ChevronDown, FileText, Download, Send, X, Copy, Check, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  descargarExcelMateriales,
  materialSinPrecio,
  type FilaMaterialGlobal,
  type GrupoMaterialesCapitulo,
} from "@/lib/materialesGlobales";
import { PALETA } from "@/lib/paletaPresupuesto";
import CampoFecha from "@/components/CampoFecha";

function fmtMon(v: number): string {
  return Math.round(v).toLocaleString("es-UY");
}

function fmtCantidad(v: number): string {
  return v.toLocaleString("es-UY", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

const claveDe = (f: FilaMaterialGlobal) => `${f.descripcion}||${f.unidad}`;

interface Props {
  proyectoId: string;
  proyectoNombre: string;
  filas: FilaMaterialGlobal[];
  total: number;
  porCapitulo: GrupoMaterialesCapitulo[];
}

export default function SeccionComputoGlobalMateriales({ proyectoId, proyectoNombre, filas, total, porCapitulo }: Props) {
  const [expandido, setExpandido] = useState(false);
  // "lista": un material por renglón, sumado en toda la obra. "capitulo": el
  // mismo cómputo separado por capítulo (un material puede repetirse).
  const [vista, setVista] = useState<"lista" | "capitulo">("lista");
  // Selección para el pedido de cotización: un grupo para cada proveedor
  // (se arma el pedido del proveedor A, se limpia, se arma el del B…).
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [modalAbierto, setModalAbierto] = useState(false);

  // Si el cómputo cambia (se borró un rubro), lo que ya no existe sale solo.
  const seleccionadas = useMemo(() => filas.filter((f) => seleccion.has(claveDe(f))), [filas, seleccion]);
  const todasSeleccionadas = filas.length > 0 && seleccionadas.length === filas.length;

  const alternar = (clave: string) =>
    setSeleccion((prev) => {
      const s = new Set(prev);
      if (s.has(clave)) s.delete(clave);
      else s.add(clave);
      return s;
    });

  const alternarTodas = () => setSeleccion(todasSeleccionadas ? new Set() : new Set(filas.map(claveDe)));

  // Sin precio (o en $0): los que hay que cotizar.
  const sinPrecio = useMemo(() => filas.filter(materialSinPrecio), [filas]);

  if (filas.length === 0) return null;

  return (
    <div className="mt-6 bg-white rounded-[16px] border border-slate-300 shadow-sm overflow-hidden">
      <div className={`px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 ${PALETA.capituloFila}`}>
        <button
          onClick={() => setExpandido((p) => !p)}
          className="flex items-center gap-2.5 min-w-0 text-left group"
        >
          <span className="text-slate-400 group-hover:text-slate-600 transition-colors flex-shrink-0">
            {expandido ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </span>
          <h2 className="text-sm font-bold text-[#1D4435] uppercase tracking-wide">
            Cómputo global de materiales
          </h2>
        </button>
        <div className="flex items-center gap-2">
          <a
            href={`/api/proyectos/${proyectoId}/lista-materiales-pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-[8px] border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <FileText className="w-3.5 h-3.5" /> PDF
          </a>
          <button
            onClick={() => descargarExcelMateriales(proyectoNombre, filas, total)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-[8px] border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Excel
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
            <p className="text-xs text-slate-500 px-5 pt-4 pb-1">
              Suma de materiales de todos los rubros del proyecto, agregados por nombre y unidad. Marcá los que le
              querés pedir a un proveedor y generá el pedido de cotización.
            </p>

            <div className="px-5 pt-2 flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex p-0.5 rounded-[8px] bg-slate-100">
                {(
                  [
                    ["lista", "Lista"],
                    ["capitulo", "Por capítulo"],
                  ] as const
                ).map(([id, nombre]) => (
                  <button
                    key={id}
                    onClick={() => setVista(id)}
                    className={cn(
                      "px-3 py-1.5 rounded-[6px] text-xs font-semibold transition-colors",
                      vista === id ? "bg-white text-[#1A3A5C] shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    {nombre}
                  </button>
                ))}
              </div>
            </div>

            {sinPrecio.length > 0 && (
              <div className="mx-5 mt-2 flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-amber-200 bg-amber-50 px-3.5 py-2">
                <span className="flex items-center gap-1.5 text-xs text-amber-800">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                  {sinPrecio.length === 1
                    ? "1 material sin precio: necesita cotización."
                    : `${sinPrecio.length} materiales sin precio: necesitan cotización.`}
                </span>
                <button
                  onClick={() => setSeleccion(new Set(sinPrecio.map(claveDe)))}
                  className="text-xs font-semibold text-amber-800 underline hover:text-amber-900"
                >
                  Seleccionarlos
                </button>
              </div>
            )}

            {/* Barra de selección — visible mientras haya algo marcado */}
            <AnimatePresence initial={false}>
              {seleccionadas.length > 0 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden"
                >
                  <div className="mx-5 my-2 flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-blue-200 bg-[#EFF6FF] px-3.5 py-2">
                    <span className="text-sm font-semibold text-[#1A3A5C]">
                      {seleccionadas.length} material{seleccionadas.length !== 1 ? "es" : ""} seleccionado
                      {seleccionadas.length !== 1 ? "s" : ""}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSeleccion(new Set())}
                        className="px-2.5 py-1.5 rounded-[8px] text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
                      >
                        Limpiar
                      </button>
                      <button
                        onClick={() => setModalAbierto(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold transition-colors"
                      >
                        <Send className="w-3.5 h-3.5" /> Pedido de cotización
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="overflow-x-auto">
              <div className="min-w-[640px]">
                <div className="flex items-center px-5 py-2 bg-slate-50 border-b border-slate-200">
                  <div style={{ width: 28 }} className="flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={todasSeleccionadas}
                      ref={(el) => {
                        if (el) el.indeterminate = seleccionadas.length > 0 && !todasSeleccionadas;
                      }}
                      onChange={alternarTodas}
                      aria-label="Seleccionar todos los materiales"
                      className="rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]/30 cursor-pointer"
                    />
                  </div>
                  <div className="flex-1 pr-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Material</div>
                  <div style={{ width: 56 }} className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-center">Unidad</div>
                  <div style={{ width: 110 }} className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-right">Cantidad</div>
                  <div style={{ width: 100 }} className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-right">P. unit.</div>
                  <div style={{ width: 140 }} className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-right pr-4">Costo total</div>
                </div>
                {vista === "lista"
                  ? filas.map((f, idx) => (
                      <FilaMaterial
                        key={claveDe(f)}
                        f={f}
                        par={idx % 2 === 1}
                        marcada={seleccion.has(claveDe(f))}
                        onAlternar={() => alternar(claveDe(f))}
                      />
                    ))
                  : porCapitulo.map((g) => (
                      <div key={g.capituloId}>
                        <div className="flex items-center px-5 py-2 bg-[#F0F4F8] border-b border-slate-200">
                          <div style={{ width: 28 }} className="flex-shrink-0" />
                          <div className="flex-1 text-xs font-bold text-[#1A3A5C] uppercase tracking-wide truncate">
                            {g.codigo ? `${g.codigo} · ` : ""}
                            {g.nombre}
                          </div>
                          <div style={{ width: 140 }} className="text-xs font-bold tabular-nums text-[#1A3A5C] text-right pr-4">
                            {g.total > 0 ? `$ ${fmtMon(g.total)}` : "—"}
                          </div>
                        </div>
                        {g.filas.map((f, idx) => (
                          <FilaMaterial
                            key={claveDe(f)}
                            f={f}
                            par={idx % 2 === 1}
                            marcada={seleccion.has(claveDe(f))}
                            onAlternar={() => alternar(claveDe(f))}
                          />
                        ))}
                      </div>
                    ))}
                {/* Total materiales */}
                <div className="flex items-center px-5 py-3 border-t-2 border-slate-300 bg-white">
                  <div style={{ width: 28 }} className="flex-shrink-0" />
                  <div className="flex-1 text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">Total materiales</div>
                  <div style={{ width: 140 }} className="text-base font-bold tabular-nums text-[#1A3A5C] text-right pr-4">
                    {total > 0 ? `$ ${fmtMon(total)}` : "—"}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modalAbierto && (
          <ModalPedidoCotizacion
            proyectoId={proyectoId}
            proyectoNombre={proyectoNombre}
            materiales={seleccionadas}
            onCerrar={() => setModalAbierto(false)}
            onListo={() => {
              setModalAbierto(false);
              setSeleccion(new Set());
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Renglón de material ─────────────────────────────────── */
function FilaMaterial({
  f,
  par,
  marcada,
  onAlternar,
}: {
  f: FilaMaterialGlobal;
  par: boolean;
  marcada: boolean;
  onAlternar: () => void;
}) {
  const sinPrecio = materialSinPrecio(f);
  const costoTotal = !sinPrecio && f.precioUnit != null ? f.cantidadTotal * f.precioUnit : null;
  return (
    <label
      className={cn(
        "flex items-center px-5 border-b border-slate-100 last:border-0 cursor-pointer transition-colors",
        marcada ? "bg-[#EFF6FF]" : par ? "bg-[#F8FAFC] hover:bg-slate-100/70" : "bg-white hover:bg-slate-50"
      )}
      style={{ minHeight: 32 }}
    >
      <div style={{ width: 28 }} className="flex-shrink-0">
        <input
          type="checkbox"
          checked={marcada}
          onChange={onAlternar}
          className="rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]/30 cursor-pointer"
        />
      </div>
      <div className="flex-1 pr-2 text-sm text-slate-700 font-medium truncate" title={f.descripcion}>
        {f.descripcion}
      </div>
      <div style={{ width: 56 }} className="text-sm text-slate-500 text-center">{f.unidad}</div>
      <div style={{ width: 110 }} className="text-sm tabular-nums text-slate-700 font-semibold text-right">{fmtCantidad(f.cantidadTotal)}</div>
      <div style={{ width: 100 }} className="text-sm tabular-nums text-slate-500 text-right">
        {sinPrecio ? (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            Sin precio
          </span>
        ) : (
          fmtCantidad(f.precioUnit!)
        )}
      </div>
      <div style={{ width: 140 }} className="text-sm font-bold tabular-nums text-[#2563EB] text-right pr-4">{costoTotal != null ? fmtMon(costoTotal) : "—"}</div>
    </label>
  );
}

/* ─── Modal: datos del pedido y salida (PDF o texto) ──────── */
function ModalPedidoCotizacion({
  proyectoId,
  proyectoNombre,
  materiales,
  onCerrar,
  onListo,
}: {
  proyectoId: string;
  proyectoNombre: string;
  materiales: FilaMaterialGlobal[];
  onCerrar: () => void;
  onListo: () => void;
}) {
  const [proveedor, setProveedor] = useState("");
  const [fechaLimite, setFechaLimite] = useState("");
  const [nota, setNota] = useState("");
  const [generando, setGenerando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listo = proveedor.trim() !== "";

  // Texto para mandar por WhatsApp o mail, sin nuestros precios.
  const comoTexto = () => {
    const lineas = [
      `Pedido de cotización — ${proyectoNombre}`,
      `Proveedor: ${proveedor.trim()}`,
      "",
      ...materiales.map((m, i) => `${i + 1}. ${m.descripcion} — ${fmtCantidad(m.cantidadTotal)} ${m.unidad}`),
    ];
    if (fechaLimite) {
      const f = new Date(`${fechaLimite}T00:00:00Z`).toLocaleDateString("es-UY", { day: "numeric", month: "long", timeZone: "UTC" });
      lineas.push("", `Cotizar antes del ${f}.`);
    }
    if (nota.trim()) lineas.push("", nota.trim());
    lineas.push("", "Por favor indicar precio unitario, plazo de entrega y condiciones de pago. Gracias.");
    return lineas.join("\n");
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(comoTexto());
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setError("No se pudo copiar. Probá con el PDF.");
    }
  };

  const generarPdf = async () => {
    setError(null);
    setGenerando(true);
    // La pestaña se abre antes del await para que el navegador no la bloquee.
    const pestana = window.open("", "_blank");
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/pedido-cotizacion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proveedor: proveedor.trim(),
          fechaLimite: fechaLimite || null,
          nota,
          items: materiales.map((m) => ({ descripcion: m.descripcion, unidad: m.unidad, cantidad: m.cantidadTotal })),
        }),
      });
      if (!res.ok) throw new Error("No se pudo generar");
      const url = URL.createObjectURL(await res.blob());
      if (pestana) pestana.location.href = url;
      else window.location.assign(url);
      onListo();
    } catch (err) {
      console.error("[pedido-cotizacion] error generando", err);
      pestana?.close();
      setError("No se pudo generar el PDF. Probá de nuevo.");
    } finally {
      setGenerando(false);
    }
  };

  const inputCls =
    "w-full text-sm text-slate-700 bg-white border border-slate-200 rounded-[8px] px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30";
  const labelCls = "text-xs font-semibold text-slate-500 mb-1 block";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3 md:p-6"
      onClick={onCerrar}
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-[16px] w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-xl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
          <h3 className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">Pedido de cotización</h3>
          <button onClick={onCerrar} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className={labelCls}>Proveedor</label>
            <input
              type="text"
              autoFocus
              value={proveedor}
              onChange={(e) => setProveedor(e.target.value)}
              placeholder="ej: Barraca Montevideo"
              className={inputCls}
            />
          </div>
          <div className="sm:w-1/2">
            <label className={labelCls}>Cotizar antes del (opcional)</label>
            <CampoFecha value={fechaLimite} onChange={(v) => setFechaLimite(v)} />
          </div>
          <div>
            <label className={labelCls}>Nota para el proveedor (opcional)</label>
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              rows={2}
              placeholder="ej: entrega en obra, horario 7 a 16 h"
              className={cn(inputCls, "resize-y")}
            />
          </div>

          <div>
            <p className={labelCls}>
              {materiales.length} material{materiales.length !== 1 ? "es" : ""} — sin precios, el proveedor completa los suyos
            </p>
            <div className="border border-slate-200 rounded-[8px] max-h-48 overflow-y-auto divide-y divide-slate-100">
              {materiales.map((m) => (
                <div key={claveDe(m)} className="flex items-center justify-between gap-3 px-3 py-1.5 text-xs">
                  <span className="text-slate-700 truncate">{m.descripcion}</span>
                  <span className="text-slate-500 tabular-nums flex-shrink-0">
                    {fmtCantidad(m.cantidadTotal)} {m.unidad}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-slate-200 flex gap-2 flex-shrink-0">
          <button
            onClick={copiar}
            disabled={!listo}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-[10px] border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {copiado ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            {copiado ? "Copiado" : "Copiar como texto"}
          </button>
          <button
            onClick={generarPdf}
            disabled={!listo || generando}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            <FileText className="w-4 h-4" /> {generando ? "Generando…" : "Generar PDF"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
