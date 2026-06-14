"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronDown, ChevronRight, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

/* ─── Tipos ───────────────────────────────────────────────── */
interface RubroCronograma {
  id: string;
  cantidad: number | null;
  precioUnit: number | null;
}

interface CapituloCronograma {
  id: string;
  nombre: string;
  codigo?: string;
  color?: string;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  rubros?: RubroCronograma[];
}

interface CertificacionItemCronograma {
  rubroId: string;
  porcentajeAvance: number;
}

interface CertificacionCronograma {
  id: string;
  numero: number;
  fecha: string;
  items: CertificacionItemCronograma[];
}

interface Props {
  proyectoId: string;
  capitulos: CapituloCronograma[];
}

type Vista = "tabla" | "gantt" | "curva";

/* ─── Helpers de fecha ────────────────────────────────────── */
function toInputDate(v?: string | null): string {
  if (!v) return "";
  return v.slice(0, 10);
}

// Parsea "YYYY-MM-DD" como fecha local (evita el corrimiento de huso horario de `new Date(string)`)
function parseLocalDate(v: string): Date {
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function duracionDias(inicio: string, fin: string): number | null {
  if (!inicio || !fin) return null;
  const dias = diffDias(inicio, fin) + 1;
  return dias >= 0 ? dias : null;
}

function fmtFecha(v: string): string {
  if (!v) return "—";
  const [y, m, d] = v.split("-");
  return `${d}/${m}/${y}`;
}

function diffDias(a: string, b: string): number {
  return Math.round((parseLocalDate(b).getTime() - parseLocalDate(a).getTime()) / (1000 * 60 * 60 * 24));
}

function addDias(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/* ─── Totales ─────────────────────────────────────────────── */
function totalRubroC(r: RubroCronograma): number {
  if (r.cantidad == null || r.precioUnit == null) return 0;
  return r.cantidad * r.precioUnit;
}

function totalCapituloC(cap: CapituloCronograma): number {
  return (cap.rubros ?? []).reduce((s, r) => s + totalRubroC(r), 0);
}

/* ─── Generación de la escala de meses para el Gantt ─────────── */
function generarMeses(inicio: string, fin: string): { label: string; dias: number }[] {
  const meses: { label: string; dias: number }[] = [];
  const finDate = parseLocalDate(fin);
  let cursor = parseLocalDate(inicio);
  while (cursor <= finDate) {
    const finMes = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const finSegmento = finMes < finDate ? finMes : finDate;
    const dias = Math.round((finSegmento.getTime() - cursor.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const label = cursor.toLocaleDateString("es-UY", { month: "short", year: "numeric" });
    meses.push({ label: label.charAt(0).toUpperCase() + label.slice(1), dias });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return meses;
}

// Convierte un color hex a una versión pastel (mezclada con blanco)
function pastelizar(hex: string, mezcla = 0.45): string {
  const limpio = hex.replace("#", "");
  if (limpio.length !== 6) return hex;
  const r = parseInt(limpio.slice(0, 2), 16);
  const g = parseInt(limpio.slice(2, 4), 16);
  const b = parseInt(limpio.slice(4, 6), 16);
  const mezclar = (c: number) => Math.round(c + (255 - c) * mezcla);
  return `rgb(${mezclar(r)}, ${mezclar(g)}, ${mezclar(b)})`;
}

/* ─── Vista Gantt ─────────────────────────────────────────── */
function VistaGantt({
  capitulos,
  fechas,
}: {
  capitulos: CapituloCronograma[];
  fechas: Record<string, { inicio: string; fin: string }>;
}) {
  const conFechas = capitulos
    .map((cap) => ({ cap, f: fechas[cap.id] ?? { inicio: "", fin: "" } }))
    .filter(({ f }) => f.inicio && f.fin && f.fin >= f.inicio);

  if (conFechas.length === 0) {
    return (
      <p className="text-xs text-slate-400 italic px-5 py-5">
        Todavía no hay capítulos con fechas definidas para mostrar el Gantt.
      </p>
    );
  }

  const rangeInicio = conFechas.reduce((min, { f }) => (f.inicio < min ? f.inicio : min), conFechas[0].f.inicio);
  const rangeFin = conFechas.reduce((max, { f }) => (f.fin > max ? f.fin : max), conFechas[0].f.fin);
  const totalDias = diffDias(rangeInicio, rangeFin) + 1;
  const meses = generarMeses(rangeInicio, rangeFin);

  const anchoNombre = 200;

  return (
    <div className="px-5 py-4 overflow-x-auto">
      <div style={{ minWidth: 640 }}>
        {/* Escala de tiempo */}
        <div className="flex items-stretch border-b border-slate-200 pb-2 mb-1">
          <div style={{ width: anchoNombre, flexShrink: 0 }} />
          <div className="flex-1 flex">
            {meses.map((m, i) => (
              <div
                key={`${m.label}-${i}`}
                style={{ width: `${(m.dias / totalDias) * 100}%` }}
                className="text-center text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-l border-slate-100 first:border-l-0 px-1 truncate"
              >
                {m.label}
              </div>
            ))}
          </div>
        </div>

        {/* Filas */}
        {capitulos.map((cap, idx) => {
          const f = fechas[cap.id] ?? { inicio: "", fin: "" };
          const tieneFechas = f.inicio && f.fin && f.fin >= f.inicio;
          const color = cap.color || "#2563EB";

          let leftPct = 0;
          let widthPct = 0;
          let duracion = 0;
          if (tieneFechas) {
            const offsetDias = diffDias(rangeInicio, f.inicio);
            duracion = diffDias(f.inicio, f.fin) + 1;
            leftPct = (offsetDias / totalDias) * 100;
            widthPct = Math.max((duracion / totalDias) * 100, 1.5);
          }

          return (
            <div
              key={cap.id}
              className={cn("flex items-center", idx % 2 === 1 ? "bg-[#F8FAFC]" : "bg-white")}
              style={{ minHeight: 40 }}
            >
              <div style={{ width: anchoNombre, flexShrink: 0 }} className="pr-2 text-sm text-slate-700 font-medium truncate">
                {cap.codigo ? `${cap.codigo} · ` : ""}{cap.nombre}
              </div>
              <div className="flex-1 relative flex items-center" style={{ height: 24 }}>
                {tieneFechas ? (
                  <div
                    className="group absolute cursor-default"
                    style={{ left: `${leftPct}%`, width: `${widthPct}%`, height: 10, backgroundColor: pastelizar(color) }}
                  >
                    {/* Tooltip */}
                    <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-10 whitespace-nowrap">
                      <div className="rounded-[8px] bg-[#1A3A5C] text-white text-xs px-3 py-2 shadow-lg">
                        <div className="font-bold">{cap.codigo ? `${cap.codigo} · ` : ""}{cap.nombre}</div>
                        <div className="text-slate-200">{fmtFecha(f.inicio)} — {fmtFecha(f.fin)}</div>
                        <div className="text-slate-200">{duracion} día{duracion === 1 ? "" : "s"}</div>
                      </div>
                      <div className="w-2 h-2 -mt-1 rotate-45 bg-[#1A3A5C]" />
                    </div>
                  </div>
                ) : (
                  <span className="absolute inset-y-0 left-0 flex items-center text-xs text-slate-400 italic">
                    Sin fechas definidas
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Vista Curva S ───────────────────────────────────────── */
function VistaCurvaS({
  capitulos,
  fechas,
  certificaciones,
}: {
  capitulos: CapituloCronograma[];
  fechas: Record<string, { inicio: string; fin: string }>;
  certificaciones: CertificacionCronograma[];
}) {
  const capsConFechas = capitulos
    .map((cap) => ({ cap, f: fechas[cap.id] ?? { inicio: "", fin: "" }, total: totalCapituloC(cap) }))
    .filter(({ f }) => f.inicio && f.fin && f.fin >= f.inicio);

  const totalGeneral = capitulos.reduce((s, c) => s + totalCapituloC(c), 0);

  if (capsConFechas.length === 0 || certificaciones.length === 0 || totalGeneral <= 0) {
    return (
      <p className="text-xs text-slate-400 italic px-5 py-5">
        Cargá fechas en el cronograma y certificaciones para ver la curva de avance.
      </p>
    );
  }

  // Mapa de rubros (para calcular el monto certificado de cada certificación)
  const rubrosPorId = new Map<string, RubroCronograma>();
  capitulos.forEach((cap) => (cap.rubros ?? []).forEach((r) => rubrosPorId.set(r.id, r)));

  const montoCertificado = (cert: CertificacionCronograma): number =>
    cert.items.reduce((s, it) => {
      const r = rubrosPorId.get(it.rubroId);
      if (!r) return s;
      return s + (it.porcentajeAvance / 100) * totalRubroC(r);
    }, 0);

  // Curva real — acumulado de certificaciones ordenadas por fecha
  const certsOrdenadas = [...certificaciones].sort((a, b) => a.fecha.localeCompare(b.fecha));
  let acumReal = 0;
  const puntosReales = certsOrdenadas.map((c) => {
    acumReal += montoCertificado(c);
    return { fecha: toInputDate(c.fecha), pct: (acumReal / totalGeneral) * 100 };
  });

  // Rango de fechas — capítulos planificados + fechas de certificaciones
  let rangeInicio = capsConFechas.reduce((min, { f }) => (f.inicio < min ? f.inicio : min), capsConFechas[0].f.inicio);
  let rangeFin = capsConFechas.reduce((max, { f }) => (f.fin > max ? f.fin : max), capsConFechas[0].f.fin);
  for (const p of puntosReales) {
    if (p.fecha < rangeInicio) rangeInicio = p.fecha;
    if (p.fecha > rangeFin) rangeFin = p.fecha;
  }

  // Curva planificada — avance acumulado lineal por capítulo
  const planificadoEn = (fecha: string): number => {
    let acum = 0;
    for (const { f, total } of capsConFechas) {
      const duracion = duracionDias(f.inicio, f.fin) ?? 1;
      if (fecha < f.inicio) continue;
      if (fecha >= f.fin) acum += total;
      else acum += total * ((diffDias(f.inicio, fecha) + 1) / duracion);
    }
    return totalGeneral > 0 ? (acum / totalGeneral) * 100 : 0;
  };

  // Genera los puntos del eje X — diario si el rango es corto, semanal si es largo
  const totalDias = diffDias(rangeInicio, rangeFin) + 1;
  const paso = totalDias > 120 ? 7 : 1;

  const fechasSet = new Set<string>();
  const finDate = parseLocalDate(rangeFin);
  let cursor = parseLocalDate(rangeInicio);
  while (cursor <= finDate) {
    fechasSet.add(formatDate(cursor));
    cursor = addDias(cursor, paso);
  }
  fechasSet.add(rangeFin);
  puntosReales.forEach((p) => fechasSet.add(p.fecha));

  const realPorFecha = new Map(puntosReales.map((p) => [p.fecha, p.pct]));

  const data = Array.from(fechasSet)
    .sort()
    .map((fecha) => ({
      fecha,
      planificado: Math.min(planificadoEn(fecha), 100),
      real: realPorFecha.has(fecha) ? Math.min(realPorFecha.get(fecha)!, 100) : null,
    }));

  return (
    <div className="px-5 py-5">
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis
            dataKey="fecha"
            tickFormatter={fmtFecha}
            tick={{ fontSize: 11, fill: "#94A3B8" }}
            minTickGap={24}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fontSize: 11, fill: "#94A3B8" }}
            width={40}
          />
          <Tooltip
            labelFormatter={(v: string) => fmtFecha(v)}
            formatter={(value: number, name: string) => [
              `${value.toFixed(1)}%`,
              name === "planificado" ? "Planificado" : "Real",
            ]}
            contentStyle={{ borderRadius: 8, borderColor: "#E2E8F0", fontSize: 12 }}
          />
          <Legend
            formatter={(value: string) => (value === "planificado" ? "Planificado" : "Real")}
            wrapperStyle={{ fontSize: 12 }}
          />
          <Line
            type="monotone"
            dataKey="planificado"
            stroke="#94A3B8"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="real"
            stroke="#2563EB"
            strokeWidth={2}
            connectNulls
            dot={{ r: 4, fill: "#2563EB" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ─── Vista Tabla ─────────────────────────────────────────── */
function VistaTabla({
  capitulos,
  fechas,
  errores,
  actualizar,
  guardar,
  inicioObra,
  finObra,
  duracionTotal,
}: {
  capitulos: CapituloCronograma[];
  fechas: Record<string, { inicio: string; fin: string }>;
  errores: Record<string, string>;
  actualizar: (capId: string, campo: "inicio" | "fin", valor: string) => void;
  guardar: (capId: string) => void;
  inicioObra: string;
  finObra: string;
  duracionTotal: number | null;
}) {
  const thCls = "text-[10px] font-semibold text-slate-400 uppercase tracking-wider";

  return (
    <>
      {/* Encabezado de columnas */}
      <div className="flex items-center px-5 py-2 bg-slate-50 border-b border-slate-200">
        <div className={cn(thCls, "flex-1 pr-2")}>Capítulo</div>
        <div className={cn(thCls, "text-center")} style={{ width: 150 }}>Fecha inicio</div>
        <div className={cn(thCls, "text-center")} style={{ width: 150 }}>Fecha fin</div>
        <div className={cn(thCls, "text-right pr-1")} style={{ width: 110 }}>Duración</div>
      </div>

      {/* Filas */}
      {capitulos.map((cap, idx) => {
        const f = fechas[cap.id] ?? { inicio: "", fin: "" };
        const duracion = duracionDias(f.inicio, f.fin);
        const error = errores[cap.id];
        return (
          <div
            key={cap.id}
            className={cn("border-b border-slate-100 last:border-0", idx % 2 === 1 ? "bg-[#F8FAFC]" : "bg-white")}
          >
            <div className="flex items-center px-5" style={{ minHeight: 44 }}>
              <div className="flex-1 pr-2 text-sm text-slate-700 font-medium truncate">
                {cap.codigo ? `${cap.codigo} · ` : ""}{cap.nombre}
              </div>
              <div style={{ width: 150 }} className="px-1">
                <input
                  type="date"
                  value={f.inicio}
                  onChange={(e) => actualizar(cap.id, "inicio", e.target.value)}
                  onBlur={() => guardar(cap.id)}
                  className="w-full rounded-[8px] border border-slate-200 px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
                />
              </div>
              <div style={{ width: 150 }} className="px-1">
                <input
                  type="date"
                  value={f.fin}
                  onChange={(e) => actualizar(cap.id, "fin", e.target.value)}
                  onBlur={() => guardar(cap.id)}
                  className="w-full rounded-[8px] border border-slate-200 px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
                />
              </div>
              <div style={{ width: 110 }} className="text-sm tabular-nums text-slate-600 text-right pr-1">
                {duracion != null ? `${duracion} día${duracion === 1 ? "" : "s"}` : "—"}
              </div>
            </div>
            {error && (
              <div className="px-5 pb-2 -mt-1 text-xs text-red-500">{error}</div>
            )}
          </div>
        );
      })}

      {/* Footer — resumen general */}
      <div className="flex items-center px-5 py-3 border-t-2 border-slate-300 bg-white gap-4">
        <div className="flex-1 text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">
          Duración total estimada de la obra
        </div>
        <div className="text-sm text-slate-500">
          {inicioObra ? fmtFecha(inicioObra) : "—"} — {finObra ? fmtFecha(finObra) : "—"}
        </div>
        <div className="text-base font-bold tabular-nums text-[#1A3A5C] text-right" style={{ minWidth: 110 }}>
          {duracionTotal != null ? `${duracionTotal} días` : "—"}
        </div>
      </div>
    </>
  );
}

/* ─── Componente principal ────────────────────────────────── */
export default function SeccionCronograma({ proyectoId, capitulos }: Props) {
  const [expandido, setExpandido] = useState(false);
  const [vista, setVista] = useState<Vista>("tabla");
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [fechas, setFechas] = useState<Record<string, { inicio: string; fin: string }>>({});
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [certificaciones, setCertificaciones] = useState<CertificacionCronograma[]>([]);
  const [certsCargadas, setCertsCargadas] = useState(false);

  // Carga las certificaciones (lazy) para la curva S
  const cargarCertificaciones = useCallback(async () => {
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/certificaciones`);
      const data = await res.json();
      setCertificaciones(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("[cronograma] error cargando certificaciones", err);
    } finally {
      setCertsCargadas(true);
    }
  }, [proyectoId]);

  useEffect(() => {
    if (expandido && vista === "curva" && !certsCargadas) cargarCertificaciones();
  }, [expandido, vista, certsCargadas, cargarCertificaciones]);

  // Incorpora capítulos nuevos (o recién cargados) sin pisar ediciones en curso
  useEffect(() => {
    setFechas((prev) => {
      const next = { ...prev };
      for (const cap of capitulos) {
        if (!(cap.id in next)) {
          next[cap.id] = { inicio: toInputDate(cap.fechaInicio), fin: toInputDate(cap.fechaFin) };
        }
      }
      return next;
    });
  }, [capitulos]);

  const actualizar = (capId: string, campo: "inicio" | "fin", valor: string) => {
    setFechas((prev) => ({ ...prev, [capId]: { ...prev[capId], [campo]: valor } }));
  };

  const guardar = async (capId: string) => {
    const { inicio, fin } = fechas[capId] ?? { inicio: "", fin: "" };

    if (inicio && fin && fin < inicio) {
      setErrores((prev) => ({ ...prev, [capId]: "La fecha de fin no puede ser anterior a la de inicio" }));
      return;
    }
    setErrores((prev) => {
      const next = { ...prev };
      delete next[capId];
      return next;
    });

    try {
      await fetch(`/api/capitulos/${capId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fechaInicio: inicio || null,
          fechaFin: fin || null,
        }),
      });
    } catch (err) {
      console.error("[cronograma] error guardando fechas", err);
    }
  };

  /* ── Resumen general — fecha más temprana / más tardía ────── */
  const fechasInicio = Object.values(fechas).map((f) => f.inicio).filter(Boolean);
  const fechasFin = Object.values(fechas).map((f) => f.fin).filter(Boolean);
  const inicioObra = fechasInicio.length > 0 ? fechasInicio.reduce((a, b) => (a < b ? a : b)) : "";
  const finObra = fechasFin.length > 0 ? fechasFin.reduce((a, b) => (a > b ? a : b)) : "";
  const duracionTotal = useMemo(() => duracionDias(inicioObra, finObra), [inicioObra, finObra]);

  const tabBtnCls = (activa: boolean) =>
    cn(
      "px-3 py-1.5 rounded-[8px] text-xs font-semibold transition-colors",
      activa ? "bg-[#2563EB] text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
    );

  return (
    <div className="mt-6 bg-white rounded-[16px] border border-slate-300 shadow-sm overflow-hidden">
      {/* Header colapsable */}
      <button
        onClick={() => setExpandido((p) => !p)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors text-left group"
      >
        <div className="flex items-center gap-2.5">
          <CalendarDays className="w-4 h-4 text-[#2563EB]" />
          <h2 className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">Cronograma</h2>
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
            {capitulos.length === 0 ? (
              <p className="text-xs text-slate-400 italic px-5 py-5">
                Todavía no hay capítulos cargados en este proyecto.
              </p>
            ) : (
              <>
                {/* Tabs Tabla/Gantt + Abrir en panel */}
                <div className="flex items-center justify-between px-5 py-2.5 border-b border-slate-200 bg-white">
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setVista("tabla")} className={tabBtnCls(vista === "tabla")}>
                      Tabla
                    </button>
                    <button onClick={() => setVista("gantt")} className={tabBtnCls(vista === "gantt")}>
                      Gantt
                    </button>
                    <button onClick={() => setVista("curva")} className={tabBtnCls(vista === "curva")}>
                      Curva S
                    </button>
                  </div>
                  <button
                    onClick={() => setPanelAbierto(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-slate-300 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    📊 Abrir en panel
                  </button>
                </div>

                {vista === "tabla" ? (
                  <VistaTabla
                    capitulos={capitulos}
                    fechas={fechas}
                    errores={errores}
                    actualizar={actualizar}
                    guardar={guardar}
                    inicioObra={inicioObra}
                    finObra={finObra}
                    duracionTotal={duracionTotal}
                  />
                ) : vista === "gantt" ? (
                  <VistaGantt capitulos={capitulos} fechas={fechas} />
                ) : (
                  <VistaCurvaS capitulos={capitulos} fechas={fechas} certificaciones={certificaciones} />
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Split view — Gantt en panel ────────────────────── */}
      <AnimatePresence>
        {panelAbierto && (
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="fixed inset-0 z-50 bg-white flex flex-col lg:left-[60%] lg:inset-y-0 lg:right-0 lg:border-l lg:border-slate-200 lg:shadow-xl"
          >
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200 flex-shrink-0">
              <span className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">
                Cronograma — Gantt
              </span>
              <button
                onClick={() => setPanelAbierto(false)}
                aria-label="Cerrar panel de cronograma"
                className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              <VistaGantt capitulos={capitulos} fechas={fechas} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
