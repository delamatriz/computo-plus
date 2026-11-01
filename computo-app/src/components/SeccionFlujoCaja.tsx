"use client";

import { useState, useCallback, useMemo } from "react";
import { Wallet, ChevronDown, ChevronRight, Plus, Pencil, X, Paperclip, FileText, Link2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { PALETA } from "@/lib/paletaPresupuesto";
import { hoyUruguayISO } from "@/lib/fechaUruguay";
import { CATEGORIAS_EGRESO, SIN_CATEGORIA, categoriasDe } from "@/lib/categoriasCaja";
import { reducirFotoObra } from "@/lib/reducirFotoObra";
import CampoFecha from "@/components/CampoFecha";

/* ─── Tipos ───────────────────────────────────────────────── */
const OPCIONES_TIPO = ["Ingreso", "Egreso"] as const;
type Tipo = (typeof OPCIONES_TIPO)[number];

interface Movimiento {
  id: string;
  tipo: Tipo;
  fecha: string;
  concepto: string;
  monto: number;
  moneda: string;
  categoria: string | null;
  referencia: string | null;
  comprobanteNombreArchivo: string | null;
  ordenCompra: { id: string; proveedor: string } | null;
  subcontratista: { id: string; empresa: string } | null;
  certificacion: { id: string; numero: number; nombre: string } | null;
}

// Entidades a las que se puede vincular un movimiento (ver
// lib/vinculoMovimientoCaja.ts): valor del select = "tipo:id".
interface OpcionVinculo {
  valor: string;
  etiqueta: string;
  paraTipo: Tipo;
}

function valorVinculo(m: Movimiento): string {
  if (m.ordenCompra) return `ordenCompra:${m.ordenCompra.id}`;
  if (m.subcontratista) return `subcontratista:${m.subcontratista.id}`;
  if (m.certificacion) return `certificacion:${m.certificacion.id}`;
  return "";
}

function etiquetaVinculo(m: Movimiento): string | null {
  if (m.ordenCompra) return `OC — ${m.ordenCompra.proveedor}`;
  if (m.subcontratista) return `Subcontrato — ${m.subcontratista.empresa}`;
  if (m.certificacion) return `Cert. Nº${m.certificacion.numero}`;
  return null;
}

interface Props {
  proyectoId: string;
}

/* ─── Formato ─────────────────────────────────────────────── */
function fmtFecha(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-UY", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

function fmtMoneda(v: number, moneda: string): string {
  const fmt = Math.round(Math.abs(v)).toLocaleString("es-UY");
  const signo = v < 0 ? "-" : "";
  return `${signo}${moneda === "USD" ? "US$" : "$"} ${fmt}`;
}

type SaldoPorMoneda = Record<string, number>;

type FormState = {
  tipo: Tipo;
  categoria: string;
  fecha: string;
  concepto: string;
  monto: string;
  moneda: "UYU" | "USD";
  referencia: string;
  vinculo: string; // "tipo:id" o ""
};

function formVacio(): FormState {
  return {
    tipo: "Egreso",
    categoria: "",
    fecha: hoyUruguayISO(),
    concepto: "",
    monto: "",
    moneda: "UYU",
    referencia: "",
    vinculo: "",
  };
}

function formDesdeMovimiento(m: Movimiento): FormState {
  return {
    tipo: m.tipo,
    categoria: m.categoria ?? "",
    fecha: m.fecha.slice(0, 10),
    concepto: m.concepto,
    monto: String(m.monto),
    moneda: m.moneda === "USD" ? "USD" : "UYU",
    referencia: m.referencia ?? "",
    vinculo: valorVinculo(m),
  };
}

// Un egreso necesita categoría (es lo que alimenta el desglose); en un
// ingreso es opcional.
function formCompleto(f: FormState): boolean {
  return f.concepto.trim() !== "" && f.monto.trim() !== "" && (f.tipo === "Ingreso" || f.categoria !== "");
}

/* ─── Componente principal ────────────────────────────────── */
export default function SeccionFlujoCaja({ proyectoId }: Props) {
  const [expandido, setExpandido] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);

  const [formularioAbierto, setFormularioAbierto] = useState<"nuevo" | string | null>(null);
  const [form, setForm] = useState<FormState>(formVacio());
  const [guardando, setGuardando] = useState(false);
  const [opcionesVinculo, setOpcionesVinculo] = useState<OpcionVinculo[] | null>(null);

  const cargarLista = useCallback(async () => {
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/flujo-caja`);
      const data = await res.json();
      setMovimientos(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("[flujo-caja] error cargando lista", err);
    } finally {
      setCargado(true);
    }
  }, [proyectoId]);

  const abrirSeccion = () => {
    setExpandido((p) => !p);
    if (!cargado) cargarLista();
  };

  // Órdenes, subcontratos y certificaciones del proyecto, para el select
  // "Vinculado a" del formulario (se cargan la primera vez que se abre).
  const cargarOpcionesVinculo = useCallback(async () => {
    try {
      const [oc, sub, cert] = await Promise.all(
        ["ordenes-compra", "subcontratistas", "certificaciones"].map((r) =>
          fetch(`/api/proyectos/${proyectoId}/${r}`).then((x) => (x.ok ? x.json() : []))
        )
      );
      setOpcionesVinculo([
        ...(Array.isArray(oc) ? oc : []).map((o: { id: string; proveedor: string }) => ({
          valor: `ordenCompra:${o.id}`,
          etiqueta: `Orden de compra — ${o.proveedor}`,
          paraTipo: "Egreso" as Tipo,
        })),
        ...(Array.isArray(sub) ? sub : []).map((x: { id: string; empresa: string }) => ({
          valor: `subcontratista:${x.id}`,
          etiqueta: `Subcontratista — ${x.empresa}`,
          paraTipo: "Egreso" as Tipo,
        })),
        ...(Array.isArray(cert) ? cert : []).map((c: { id: string; numero: number }) => ({
          valor: `certificacion:${c.id}`,
          etiqueta: `Certificación Nº${c.numero}`,
          paraTipo: "Ingreso" as Tipo,
        })),
      ]);
    } catch (err) {
      console.error("[flujo-caja] error cargando entidades para vincular", err);
      setOpcionesVinculo([]);
    }
  }, [proyectoId]);

  const abrirNuevo = () => {
    setForm(formVacio());
    setFormularioAbierto("nuevo");
    if (opcionesVinculo == null) cargarOpcionesVinculo();
  };

  const abrirEdicion = (mov: Movimiento) => {
    setForm(formDesdeMovimiento(mov));
    setFormularioAbierto(mov.id);
    if (opcionesVinculo == null) cargarOpcionesVinculo();
  };

  const cerrarFormulario = () => setFormularioAbierto(null);

  const guardar = async () => {
    if (!formCompleto(form)) return;
    setGuardando(true);
    try {
      const esEdicion = formularioAbierto !== "nuevo" && formularioAbierto != null;
      const url = esEdicion
        ? `/api/proyectos/${proyectoId}/flujo-caja/${formularioAbierto}`
        : `/api/proyectos/${proyectoId}/flujo-caja`;
      const [tipoVinculo, idVinculo] = form.vinculo.split(":");
      const body = {
        ...form,
        monto: Number(form.monto),
        categoria: form.categoria || null,
        vinculo: form.vinculo ? { tipo: tipoVinculo, id: idVinculo } : null,
      };
      const res = await fetch(url, {
        method: esEdicion ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("No se pudo guardar");
      // Recargamos la lista completa (en vez de mergear el registro
      // devuelto): si se editó la fecha, el movimiento puede haber
      // cambiado de posición en el orden cronológico, y con eso el
      // saldo acumulado de varios otros movimientos — más simple y
      // confiable recalcular todo desde la lista fresca del server.
      await cargarLista();
      setFormularioAbierto(null);
    } catch (err) {
      console.error("[flujo-caja] error guardando", err);
    } finally {
      setGuardando(false);
    }
  };

  // Saldo acumulado — recorre los movimientos en orden (ya vienen
  // ordenados por fecha desde el server) y va sumando/restando por
  // separado en un objeto {moneda: saldo}, sin mezclar. Decisión: una
  // sola tabla cronológica (no 2 tablas separadas) con el saldo de
  // ambas monedas mostrado apilado en cada fila — como un extracto
  // único con 2 "cuentas" en paralelo, más útil para ver la
  // secuencia real de movimientos que separar en 2 vistas.
  const filas = useMemo(() => {
    const saldo: SaldoPorMoneda = {};
    return movimientos.map((mov) => {
      const delta = mov.tipo === "Ingreso" ? mov.monto : -mov.monto;
      saldo[mov.moneda] = (saldo[mov.moneda] ?? 0) + delta;
      return { mov, saldoDespues: { ...saldo } };
    });
  }, [movimientos]);

  const totales = useMemo(() => {
    const ingresos: SaldoPorMoneda = {};
    const egresos: SaldoPorMoneda = {};
    const saldoFinal: SaldoPorMoneda = {};
    // Egresos por categoría, en el orden de la lista (los sin categoría al final).
    const porCategoria = new Map<string, SaldoPorMoneda>(
      [...CATEGORIAS_EGRESO, SIN_CATEGORIA].map((c) => [c, {}])
    );
    for (const mov of movimientos) {
      const acumulador = mov.tipo === "Ingreso" ? ingresos : egresos;
      acumulador[mov.moneda] = (acumulador[mov.moneda] ?? 0) + mov.monto;
      const delta = mov.tipo === "Ingreso" ? mov.monto : -mov.monto;
      saldoFinal[mov.moneda] = (saldoFinal[mov.moneda] ?? 0) + delta;
      if (mov.tipo === "Egreso") {
        const cat = porCategoria.get(mov.categoria ?? SIN_CATEGORIA) ?? porCategoria.get(SIN_CATEGORIA)!;
        cat[mov.moneda] = (cat[mov.moneda] ?? 0) + mov.monto;
      }
    }
    const egresosPorCategoria = [...porCategoria.entries()].filter(([, v]) => Object.values(v).some((x) => x !== 0));
    return { ingresos, egresos, saldoFinal, egresosPorCategoria };
  }, [movimientos]);

  return (
    <div className="mt-6 bg-white rounded-[16px] border border-slate-300 shadow-sm overflow-hidden">
      <button
        onClick={abrirSeccion}
        className={`w-full flex items-center justify-between px-5 py-3.5 transition-colors text-left group ${PALETA.capituloFila}`}
      >
        <div className="flex items-center gap-2.5">
          <Wallet className="w-4 h-4 text-[#1D4435]" />
          <h2 className="text-sm font-bold text-[#1D4435] uppercase tracking-wide">Flujo de Caja</h2>
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
            <div className="px-5 py-5 space-y-3" style={{ background: "#F8FAFC" }}>
              <p className="text-xs text-slate-500 -mt-1">
                Ingresos y egresos reales de esta obra, por categoría, con saldo acumulado por separado en cada
                moneda.
              </p>

              <button
                onClick={abrirNuevo}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-colors"
              >
                <Plus className="w-4 h-4" /> Agregar movimiento
              </button>

              {movimientos.length === 0 ? (
                <p className="text-xs text-slate-400 italic px-1 py-3">
                  Todavía no hay movimientos de caja registrados en este proyecto.
                </p>
              ) : (
                <>
                  <div className="space-y-2">
                    {filas.map(({ mov, saldoDespues }) => (
                      <FilaMovimiento
                        key={mov.id}
                        proyectoId={proyectoId}
                        mov={mov}
                        saldoDespues={saldoDespues}
                        onEditar={() => abrirEdicion(mov)}
                      />
                    ))}
                  </div>

                  {/* Footer — totales */}
                  <div className="rounded-[10px] border-2 border-slate-300 bg-white px-3.5 py-3">
                    <p className="text-[10px] font-bold text-[#1A3A5C] uppercase tracking-wide mb-1.5">
                      Totales
                    </p>
                    <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                      <div>
                        <p className="text-[10px] font-semibold text-slate-400 mb-0.5">Total ingresos</p>
                        <SaldoStack saldo={totales.ingresos} colorPositivo />
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-slate-400 mb-0.5">Total egresos</p>
                        <SaldoStack saldo={totales.egresos} colorNegativo />
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-slate-400 mb-0.5">Saldo disponible</p>
                        <SaldoStack saldo={totales.saldoFinal} />
                      </div>
                    </div>

                    {totales.egresosPorCategoria.length > 0 && (
                      <div className="mt-2.5 pt-2.5 border-t border-slate-100">
                        <p className="text-[10px] font-semibold text-slate-400 mb-1.5">Egresos por categoría</p>
                        <div className="space-y-1">
                          {totales.egresosPorCategoria.map(([cat, saldo]) => (
                            <div key={cat} className="flex items-start justify-between gap-3">
                              <span className={cn("text-xs", cat === SIN_CATEGORIA ? "text-slate-400 italic" : "text-slate-600")}>
                                {cat}
                              </span>
                              <div className="text-right">
                                {Object.entries(saldo)
                                  .filter(([, v]) => v !== 0)
                                  .map(([m, v]) => (
                                    <p key={m} className="text-xs font-semibold tabular-nums text-slate-700">
                                      {fmtMoneda(v, m)}
                                    </p>
                                  ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {formularioAbierto && (
          <FormularioMovimiento
            form={form}
            setForm={setForm}
            esEdicion={formularioAbierto !== "nuevo"}
            guardando={guardando}
            opcionesVinculo={opcionesVinculo}
            onGuardar={guardar}
            onCerrar={cerrarFormulario}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Saldo apilado por moneda ─────────────────────────────── */
function SaldoStack({
  saldo,
  colorPositivo,
  colorNegativo,
}: {
  saldo: SaldoPorMoneda;
  colorPositivo?: boolean;
  colorNegativo?: boolean;
}) {
  const entradas = Object.entries(saldo).filter(([, v]) => v !== 0);
  if (entradas.length === 0) {
    return <span className="text-xs text-slate-400">—</span>;
  }
  return (
    <div className="space-y-0.5">
      {entradas.map(([m, v]) => (
        <div
          key={m}
          className={cn(
            "text-sm font-semibold tabular-nums",
            colorPositivo ? "text-emerald-600" : colorNegativo ? "text-red-600" : v < 0 ? "text-red-600" : "text-[#1A3A5C]"
          )}
        >
          {fmtMoneda(v, m)}
        </div>
      ))}
    </div>
  );
}

/* ─── Fila de movimiento ───────────────────────────────────── */
function FilaMovimiento({
  proyectoId,
  mov,
  saldoDespues,
  onEditar,
}: {
  proyectoId: string;
  mov: Movimiento;
  saldoDespues: SaldoPorMoneda;
  onEditar: () => void;
}) {
  const esIngreso = mov.tipo === "Ingreso";
  const vinculo = etiquetaVinculo(mov);
  // Comprobante: se sube desde la fila (el movimiento ya existe), mismo
  // patrón que el remito de las órdenes de compra.
  const urlComprobante = `/api/proyectos/${proyectoId}/flujo-caja/${mov.id}/comprobante`;
  const [comprobante, setComprobante] = useState<string | null>(mov.comprobanteNombreArchivo);
  const [subiendo, setSubiendo] = useState(false);
  const [errorComprobante, setErrorComprobante] = useState(false);

  const subirComprobante = async (file: File) => {
    setSubiendo(true);
    setErrorComprobante(false);
    try {
      const esImagen = file.type.startsWith("image/");
      const archivo = esImagen
        ? await reducirFotoObra(file)
        : await new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result as string);
            r.onerror = reject;
            r.readAsDataURL(file);
          });
      const nombre = esImagen ? file.name.replace(/\.[^.]+$/, "") + ".jpg" : file.name;
      const res = await fetch(urlComprobante, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archivo, nombreArchivoOriginal: nombre }),
      });
      if (!res.ok) throw new Error("No se pudo subir");
      setComprobante(nombre);
    } catch (err) {
      console.error("[flujo-caja] error subiendo comprobante", err);
      setErrorComprobante(true);
    } finally {
      setSubiendo(false);
    }
  };

  const quitarComprobante = async () => {
    const anterior = comprobante;
    setComprobante(null);
    try {
      const res = await fetch(urlComprobante, { method: "DELETE" });
      if (!res.ok) throw new Error("No se pudo quitar");
    } catch (err) {
      console.error("[flujo-caja] error quitando comprobante", err);
      setComprobante(anterior);
    }
  };
  return (
    <div className="rounded-[10px] border border-slate-200 bg-white px-3.5 py-3">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={cn(
                "text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0",
                esIngreso ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"
              )}
            >
              {mov.tipo}
            </span>
            {mov.categoria && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-600 flex-shrink-0">
                {mov.categoria}
              </span>
            )}
            <span className="text-[11px] text-slate-400">{fmtFecha(mov.fecha)}</span>
          </div>
          <p className="text-sm text-slate-700 font-medium mt-1">{mov.concepto}</p>
          {(mov.referencia || vinculo) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
              {mov.referencia && <span className="text-[11px] text-slate-500">Ref. {mov.referencia}</span>}
              {vinculo && (
                <span className="inline-flex items-center gap-1 text-[11px] text-[#2563EB]">
                  <Link2 className="w-3 h-3" /> {vinculo}
                </span>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {comprobante ? (
              <>
                <a
                  href={urlComprobante}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2563EB] hover:underline"
                >
                  <FileText className="w-3.5 h-3.5" /> {comprobante}
                </a>
                <button
                  onClick={quitarComprobante}
                  className="text-slate-300 hover:text-red-500 transition-colors"
                  title="Quitar comprobante"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <label
                className={cn(
                  "inline-flex items-center gap-1 text-[11px] font-semibold",
                  subiendo ? "text-slate-400 cursor-wait" : "text-slate-500 hover:text-[#2563EB] cursor-pointer"
                )}
              >
                <Paperclip className="w-3.5 h-3.5" />
                {subiendo ? "Subiendo…" : "Adjuntar comprobante"}
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  disabled={subiendo}
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) subirComprobante(e.target.files[0]);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
            {errorComprobante && <span className="text-[11px] text-red-600">No se pudo subir. Probá de nuevo.</span>}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className={cn("text-sm font-bold tabular-nums", esIngreso ? "text-emerald-600" : "text-red-600")}>
            {esIngreso ? "+" : "-"}
            {fmtMoneda(mov.monto, mov.moneda).replace(/^-/, "")}
          </span>
          <button
            onClick={onEditar}
            className="flex items-center gap-1 text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
          >
            <Pencil className="w-3 h-3" /> Editar
          </button>
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-slate-100">
        <p className="text-[10px] font-semibold text-slate-400 mb-0.5">Saldo acumulado</p>
        <SaldoStack saldo={saldoDespues} />
      </div>
    </div>
  );
}

/* ─── Modal de formulario (nuevo / editar) ────────────────── */
function FormularioMovimiento({
  form,
  setForm,
  esEdicion,
  guardando,
  opcionesVinculo,
  onGuardar,
  onCerrar,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  esEdicion: boolean;
  guardando: boolean;
  opcionesVinculo: OpcionVinculo[] | null;
  onGuardar: () => void;
  onCerrar: () => void;
}) {
  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

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
        className="bg-white rounded-[16px] w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col shadow-xl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
          <h3 className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">
            {esEdicion ? "Editar movimiento" : "Agregar movimiento"}
          </h3>
          <button onClick={onCerrar} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className={labelCls}>Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              {OPCIONES_TIPO.map((op) => (
                <button
                  key={op}
                  type="button"
                  onClick={() =>
                    // Al cambiar el tipo, la categoría elegida puede no existir en el otro.
                    setForm((prev) => ({
                      ...prev,
                      tipo: op,
                      categoria: categoriasDe(op).includes(prev.categoria) ? prev.categoria : "",
                      // El vínculo depende del tipo (egreso: OC / subcontrato; ingreso: certificación).
                      vinculo:
                        opcionesVinculo?.find((o) => o.valor === prev.vinculo)?.paraTipo === op ? prev.vinculo : "",
                    }))
                  }
                  className={cn(
                    "py-2 rounded-[8px] text-sm font-semibold border transition-colors",
                    form.tipo === op
                      ? op === "Ingreso"
                        ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                        : "bg-red-50 border-red-300 text-red-700"
                      : "border-slate-200 text-slate-500 hover:border-slate-300"
                  )}
                >
                  {op}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>
              Categoría{form.tipo === "Ingreso" ? " (opcional)" : ""}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {categoriasDe(form.tipo).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => set("categoria", form.categoria === cat ? "" : cat)}
                  className={cn(
                    "px-2.5 py-1.5 rounded-[8px] text-xs font-semibold border transition-colors",
                    form.categoria === cat
                      ? "bg-[#EFF6FF] border-[#2563EB] text-[#2563EB]"
                      : "border-slate-200 text-slate-500 hover:border-slate-300"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>Fecha</label>
            <CampoFecha value={form.fecha} onChange={(v) => set("fecha", v)} />
          </div>

          <div>
            <label className={labelCls}>Concepto</label>
            <input
              type="text"
              value={form.concepto}
              onChange={(e) => set("concepto", e.target.value)}
              placeholder="ej: Anticipo del cliente, Pago a subcontratista"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Referencia (opcional)</label>
              <input
                type="text"
                value={form.referencia}
                onChange={(e) => set("referencia", e.target.value)}
                placeholder="Nº de factura o transferencia"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Vinculado a (opcional)</label>
              <select value={form.vinculo} onChange={(e) => set("vinculo", e.target.value)} className={inputCls}>
                <option value="">{opcionesVinculo == null ? "Cargando…" : "Sin vincular"}</option>
                {(opcionesVinculo ?? [])
                  .filter((o) => o.paraTipo === form.tipo)
                  .map((o) => (
                    <option key={o.valor} value={o.valor}>
                      {o.etiqueta}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>Monto</label>
              <input
                type="number"
                value={form.monto}
                onChange={(e) => set("monto", e.target.value)}
                placeholder="0"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Moneda</label>
              <select value={form.moneda} onChange={(e) => set("moneda", e.target.value as "UYU" | "USD")} className={inputCls}>
                <option value="UYU">UYU</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-200 flex gap-2 flex-shrink-0">
          <button
            onClick={onCerrar}
            className="flex-1 py-2.5 rounded-[10px] border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onGuardar}
            disabled={guardando || !formCompleto(form)}
            className="flex-1 py-2.5 rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {guardando ? "Guardando…" : esEdicion ? "Guardar cambios" : "Agregar movimiento"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
