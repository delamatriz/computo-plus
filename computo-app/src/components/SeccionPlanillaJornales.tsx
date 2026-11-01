"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { Wallet, ChevronDown, ChevronRight, CalendarPlus, Trash2, UserPlus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { PALETA } from "@/lib/paletaPresupuesto";
import { hoyUruguayISO } from "@/lib/fechaUruguay";
import { brutoDe, aportesDe, totalesJornales, lunesDeSemana } from "@/lib/jornalesPagados";
import CampoFecha from "@/components/CampoFecha";

// Planilla de Jornales / Mano de Obra Ejecutada — lo que se le paga de
// verdad a cada obrero, semana a semana, con sus aportes patronales. El
// personal sale de Personal y Cuadrillas; el jornal sugerido, de su categoría
// laboral. Ver model JornalPagado y lib/jornalesPagados.ts.

/* ─── Tipos ───────────────────────────────────────────────── */
interface Registro {
  id: string;
  personalObraId: string;
  personalObra: { id: string; nombre: string; cuadrilla: string };
  semana: string; // ISO, lunes
  diasTrabajados: number;
  jornal: number;
  categoria: string;
  aportesPatronalesPct: number;
}

interface Persona {
  id: string;
  nombre: string;
  activo: boolean;
  categoriaLaboral: { nombre: string; jornal: number };
}

interface Props {
  proyectoId: string;
}

/* ─── Formato ─────────────────────────────────────────────── */
function fmtPesos(v: number): string {
  if (!v) return "—";
  return `$ ${Math.round(v).toLocaleString("es-UY")}`;
}

function fmtNum(v: number, decimales = 1): string {
  return v.toLocaleString("es-UY", { minimumFractionDigits: 0, maximumFractionDigits: decimales });
}

function fmtSemana(iso: string): string {
  const desde = new Date(iso);
  const hasta = new Date(desde);
  hasta.setUTCDate(hasta.getUTCDate() + 6);
  const f = (d: Date, conAnio: boolean) =>
    d.toLocaleDateString("es-UY", { day: "numeric", month: "short", ...(conAnio ? { year: "numeric" } : {}), timeZone: "UTC" });
  return `${f(desde, false)} al ${f(hasta, true)}`;
}

// Acepta "5", "4,5", "4.5", "3200", "3.200" o "3.200,50"; null si no es un
// número. Con coma, el punto es separador de miles (formato uruguayo); sin
// coma, el punto es de miles solo si separa grupos de 3 ("3.200").
function parsearNumero(texto: string): number | null {
  let t = texto.trim().replace(/\s/g, "");
  if (t === "") return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// Valor para editar: sin separador de miles y con coma decimal ("3200", "4,5").
function paraEditar(v: number): string {
  return String(v).replace(".", ",");
}

/* ─── Componente principal ────────────────────────────────── */
export default function SeccionPlanillaJornales({ proyectoId }: Props) {
  const [expandido, setExpandido] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [personal, setPersonal] = useState<Persona[]>([]);
  const [pctAportes, setPctAportes] = useState<number | null>(null);
  const [semanaNueva, setSemanaNueva] = useState(() => lunesDeSemana(hoyUruguayISO()));
  const [cargandoSemana, setCargandoSemana] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [resJ, resP] = await Promise.all([
        fetch(`/api/proyectos/${proyectoId}/jornales`),
        fetch(`/api/proyectos/${proyectoId}/personal`),
      ]);
      const dataJ = await resJ.json();
      const dataP = await resP.json();
      setRegistros(Array.isArray(dataJ.registros) ? dataJ.registros : []);
      setPctAportes(typeof dataJ.aportesPatronalesPct === "number" ? dataJ.aportesPatronalesPct : null);
      setPersonal(Array.isArray(dataP) ? dataP : []);
    } catch (err) {
      console.error("[jornales] error cargando", err);
    } finally {
      setCargado(true);
    }
  }, [proyectoId]);

  const abrirSeccion = () => {
    setExpandido((p) => !p);
    if (!cargado) cargar();
  };

  const totales = useMemo(() => totalesJornales(registros), [registros]);

  const semanas = useMemo(() => {
    const m = new Map<string, Registro[]>();
    for (const r of registros) {
      const k = r.semana.slice(0, 10);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [registros]);

  const personalActivo = personal.filter((p) => p.activo);

  /* ── Alta: semana completa o una persona ───────────────── */
  const agregar = async (semana: string, personalObraIds: string[]) => {
    if (personalObraIds.length === 0) return;
    setAviso(null);
    const res = await fetch(`/api/proyectos/${proyectoId}/jornales`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ semana, personalObraIds }),
    });
    if (!res.ok) throw new Error("No se pudo cargar");
    const data: { creados: number; registros: Registro[] } = await res.json();
    const k = lunesDeSemana(semana);
    setRegistros((prev) => [...prev.filter((r) => r.semana.slice(0, 10) !== k), ...data.registros]);
    return data.creados;
  };

  const cargarSemana = async () => {
    setCargandoSemana(true);
    try {
      const creados = await agregar(semanaNueva, personalActivo.map((p) => p.id));
      if (creados === 0) setAviso("Todo el personal activo ya estaba en esa semana.");
    } catch (err) {
      console.error("[jornales] error cargando semana", err);
      setAviso("No se pudo cargar la semana. Probá de nuevo.");
    } finally {
      setCargandoSemana(false);
    }
  };

  /* ── Edición inline y baja ─────────────────────────────── */
  // Optimista; si falla se recarga la planilla del servidor (no se restaura
  // una copia local: con dos ediciones seguidas fallando, la copia de la
  // segunda ya traía aplicada la primera y la pantalla quedaba distinta de
  // la base).
  const actualizar = async (registroId: string, cambios: { diasTrabajados?: number; jornal?: number }) => {
    setRegistros((prev) => prev.map((r) => (r.id === registroId ? { ...r, ...cambios } : r)));
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/jornales/${registroId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cambios),
      });
      if (!res.ok) throw new Error("No se pudo guardar");
      setAviso(null);
    } catch (err) {
      console.error("[jornales] error guardando", err);
      setAviso("No se pudo guardar el cambio. Probá de nuevo.");
      cargar();
    }
  };

  const quitar = async (registroId: string) => {
    setRegistros((prev) => prev.filter((r) => r.id !== registroId));
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/jornales/${registroId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("No se pudo quitar");
    } catch (err) {
      console.error("[jornales] error quitando", err);
      setAviso("No se pudo quitar. Probá de nuevo.");
      cargar();
    }
  };

  return (
    <div className="mt-6 bg-white rounded-[16px] border border-slate-300 shadow-sm overflow-hidden">
      <button
        onClick={abrirSeccion}
        className={`w-full flex items-center justify-between px-5 py-3.5 transition-colors text-left group ${PALETA.capituloFila}`}
      >
        <div className="flex items-center gap-2.5">
          <Wallet className="w-4 h-4 text-[#1D4435]" />
          <h2 className="text-sm font-bold text-[#1D4435] uppercase tracking-wide">Planilla de Jornales</h2>
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
            <div className="px-5 py-5 space-y-4" style={{ background: "#F8FAFC" }}>
              <p className="text-xs text-slate-500 -mt-1">
                Mano de obra ejecutada: lo que se le paga a cada trabajador semana a semana y sus aportes patronales.
                Es el costo real — la mano de obra del presupuesto es la estimada.
              </p>

              {/* Totales — siempre a la vista */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Indicador label="Jornales pagados" valor={totales.jornales ? fmtNum(totales.jornales) : "—"} />
                <Indicador label="Total bruto" valor={fmtPesos(totales.bruto)} />
                <Indicador
                  label="Aportes patronales"
                  valor={fmtPesos(totales.aportes)}
                  nota={pctAportes != null ? `${fmtNum(pctAportes, 4)}% vigente` : undefined}
                />
                <Indicador label="Costo real de MO" valor={fmtPesos(totales.total)} destacado />
              </div>

              {/* Cargar semana */}
              {cargado && personal.length === 0 ? (
                <p className="text-xs text-slate-500 rounded-[10px] border border-dashed border-slate-300 bg-white px-3.5 py-3">
                  Para armar la planilla primero cargá el personal de la obra en <strong>Personal y Cuadrillas</strong>{" "}
                  (Fase 3), con su categoría laboral.
                </p>
              ) : (
                <div className="rounded-[10px] border border-slate-200 bg-white px-3.5 py-3">
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="flex-1 min-w-[150px]">
                      <label className="text-xs font-semibold text-slate-500 mb-1 block">Semana</label>
                      <CampoFecha value={semanaNueva} onChange={(v) => v && setSemanaNueva(lunesDeSemana(v))} />
                    </div>
                    <button
                      onClick={cargarSemana}
                      disabled={cargandoSemana || personalActivo.length === 0}
                      className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-[8px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                      <CalendarPlus className="w-4 h-4" />
                      {cargandoSemana ? "Cargando…" : "Cargar semana"}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    Semana del {fmtSemana(`${semanaNueva}T00:00:00Z`)} · suma a las {personalActivo.length} personas
                    activas con su jornal (o el de su categoría); después completás los días.
                  </p>
                  {aviso && <p className="text-[11px] text-amber-700 mt-1.5">{aviso}</p>}
                </div>
              )}

              {semanas.length === 0 ? (
                cargado && (
                  <p className="text-xs text-slate-400 italic px-1 py-2">Todavía no hay jornales registrados.</p>
                )
              ) : (
                <div className="space-y-3">
                  {semanas.map(([semana, filas]) => (
                    <BloqueSemana
                      key={semana}
                      semana={semana}
                      filas={filas}
                      personal={personal}
                      onActualizar={actualizar}
                      onQuitar={quitar}
                      onAgregarPersona={(personaId) =>
                        agregar(semana, [personaId]).catch(() => setAviso("No se pudo agregar. Probá de nuevo."))
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Indicador de totales ────────────────────────────────── */
function Indicador({ label, valor, nota, destacado }: { label: string; valor: string; nota?: string; destacado?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-[10px] border px-3 py-2.5",
        destacado ? "border-blue-200 bg-[#EFF6FF]" : "border-slate-200 bg-white"
      )}
    >
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={cn("text-base font-bold tabular-nums mt-0.5", destacado ? "text-[#2563EB]" : "text-[#1A3A5C]")}>
        {valor}
      </p>
      {nota && <p className="text-[10px] text-slate-400 mt-0.5">{nota}</p>}
    </div>
  );
}

/* ─── Una semana de la planilla ───────────────────────────── */
function BloqueSemana({
  semana,
  filas,
  personal,
  onActualizar,
  onQuitar,
  onAgregarPersona,
}: {
  semana: string;
  filas: Registro[];
  personal: Persona[];
  onActualizar: (id: string, cambios: { diasTrabajados?: number; jornal?: number }) => void;
  onQuitar: (id: string) => void;
  onAgregarPersona: (personaId: string) => void;
}) {
  const t = totalesJornales(filas);
  const enSemana = new Set(filas.map((f) => f.personalObraId));
  const disponibles = personal.filter((p) => !enSemana.has(p.id));
  const thCls = "text-[10px] font-semibold text-slate-400 uppercase tracking-wider py-2";

  return (
    <div className="rounded-[10px] border border-slate-200 bg-white overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3.5 py-2.5 bg-[#F0F4F8] border-b border-slate-200">
        <span className="text-sm font-bold text-[#1A3A5C]">Semana del {fmtSemana(`${semana}T00:00:00Z`)}</span>
        <span className="text-xs text-slate-500 tabular-nums">
          {fmtNum(t.jornales)} jornales · <span className="font-bold text-[#1A3A5C]">{fmtPesos(t.total)}</span>
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[620px]">
          <thead>
            <tr className="border-b border-slate-100">
              <th className={cn(thCls, "text-left pl-3.5")}>Trabajador</th>
              <th className={cn(thCls, "text-right")} style={{ width: 64 }}>Días</th>
              <th className={cn(thCls, "text-right")} style={{ width: 92 }}>Jornal</th>
              <th className={cn(thCls, "text-right")} style={{ width: 92 }}>Bruto</th>
              <th className={cn(thCls, "text-right")} style={{ width: 88 }}>Aportes</th>
              <th className={cn(thCls, "text-right pr-2")} style={{ width: 96 }}>Total</th>
              <th style={{ width: 32 }} />
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                <td className="pl-3.5 py-1.5">
                  <p className="font-medium text-slate-700">{f.personalObra.nombre}</p>
                  <p className="text-[10px] text-slate-400">{f.categoria}</p>
                </td>
                <td className="py-1.5 text-right">
                  <CeldaNumero
                    valor={f.diasTrabajados}
                    decimales={1}
                    max={7}
                    resaltarCero
                    onGuardar={(v) => onActualizar(f.id, { diasTrabajados: v })}
                  />
                </td>
                <td className="py-1.5 text-right">
                  <CeldaNumero valor={f.jornal} decimales={0} prefijo="$" onGuardar={(v) => onActualizar(f.id, { jornal: v })} />
                </td>
                <td className="py-1.5 text-right tabular-nums text-slate-600">{fmtPesos(brutoDe(f))}</td>
                <td className="py-1.5 text-right tabular-nums text-slate-500" title={`${fmtNum(f.aportesPatronalesPct, 4)}%`}>
                  {fmtPesos(aportesDe(f))}
                </td>
                <td className="py-1.5 pr-2 text-right tabular-nums font-semibold text-[#1A3A5C]">
                  {fmtPesos(brutoDe(f) + aportesDe(f))}
                </td>
                <td className="py-1.5 text-center">
                  <button
                    onClick={() => onQuitar(f.id)}
                    className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                    title="Quitar de esta semana"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[#F8FAFC]">
              <td className="pl-3.5 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Subtotal</td>
              <td className="py-2 text-right tabular-nums font-semibold text-slate-600">{fmtNum(t.jornales)}</td>
              <td />
              <td className="py-2 text-right tabular-nums font-semibold text-slate-600">{fmtPesos(t.bruto)}</td>
              <td className="py-2 text-right tabular-nums font-semibold text-slate-500">{fmtPesos(t.aportes)}</td>
              <td className="py-2 pr-2 text-right tabular-nums font-bold text-[#1A3A5C]">{fmtPesos(t.total)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {disponibles.length > 0 && (
        <div className="px-3.5 py-2 border-t border-slate-100 flex items-center gap-2">
          <UserPlus className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <select
            value=""
            onChange={(e) => e.target.value && onAgregarPersona(e.target.value)}
            className="flex-1 min-w-0 text-xs text-slate-600 bg-transparent focus:outline-none cursor-pointer"
          >
            <option value="">Agregar a esta semana…</option>
            {disponibles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} — {p.categoriaLaboral.nombre}
                {p.activo ? "" : " (inactivo)"}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

/* ─── Celda numérica editable inline ──────────────────────── */
// Guarda al salir del campo o con Enter; Escape descarta. Un valor inválido
// o fuera de rango vuelve al anterior sin guardar.
function CeldaNumero({
  valor,
  decimales,
  max,
  prefijo,
  resaltarCero,
  onGuardar,
}: {
  valor: number;
  decimales: number;
  max?: number;
  prefijo?: string;
  resaltarCero?: boolean;
  onGuardar: (v: number) => void;
}) {
  const [borrador, setBorrador] = useState<string | null>(null);
  const descartar = useRef(false);
  const mostrado = borrador ?? fmtNum(valor, decimales);

  const confirmar = () => {
    if (descartar.current) {
      descartar.current = false;
      setBorrador(null);
      return;
    }
    if (borrador == null) return;
    const n = parsearNumero(borrador);
    setBorrador(null);
    if (n == null || n < 0 || (max != null && n > max) || n === valor) return;
    onGuardar(n);
  };

  return (
    <div className="inline-flex items-center justify-end gap-0.5">
      {prefijo && <span className="text-slate-400">{prefijo}</span>}
      <input
        type="text"
        inputMode="decimal"
        value={mostrado}
        onFocus={(e) => {
          setBorrador(paraEditar(valor));
          // Después del clic: si no, el mouseup ubica el cursor y deshace la
          // selección, y lo que se escribe queda pegado al valor anterior.
          const input = e.target;
          setTimeout(() => input.select(), 0);
        }}
        onChange={(e) => setBorrador(e.target.value)}
        onBlur={confirmar}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            descartar.current = true;
            (e.target as HTMLInputElement).blur();
          }
        }}
        className={cn(
          "w-full max-w-[76px] text-right tabular-nums rounded-[6px] border px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30",
          resaltarCero && valor === 0 && borrador == null
            ? "border-amber-200 bg-amber-50 text-amber-700"
            : "border-slate-200 bg-white text-slate-700"
        )}
      />
    </div>
  );
}
