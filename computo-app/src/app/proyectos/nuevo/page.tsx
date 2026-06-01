"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  ChevronLeft,
  Plus,
  X,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Tipos ─────────────────────────────────────────────── */
interface FormData {
  nombre: string;
  cliente: string;
  tipo: string;
  rut: string;
  razonSocial: string;
  telefono: string;
  correo: string;
  direccion: string;
  trabajos: string;
  moneda: "UYU" | "USD";
  area: string;
  fechaInicio: string;
  plazoMeses: string;
  descripcion: string;
  capitulos: Capitulo[];
}

interface Capitulo {
  id: string;
  nombre: string;
  color: string;
  activo: boolean;
}

/* ─── Datos de referencia ─────────────────────────────── */
const TIPOS_OBRA = [
  { id: "REPARACIONES", label: "Reparaciones" },
  { id: "REFORMA",      label: "Reforma / Ampliación" },
  { id: "VIVIENDA",     label: "Vivienda unifamiliar" },
  { id: "PH",           label: "Propiedad Horizontal" },
  { id: "COMERCIAL",    label: "Local comercial" },
  { id: "INDUSTRIAL",   label: "Industrial" },
];

const CAPITULOS_SUGERIDOS: Record<string, Array<{ nombre: string; color: string }>> = {
  VIVIENDA: [
    { nombre: "Trabajos preliminares",           color: "#94A3B8" },
    { nombre: "Movimiento de tierra y fundaciones", color: "#78716C" },
    { nombre: "Estructura",                      color: "#2563EB" },
    { nombre: "Mampostería y muros",             color: "#3B82F6" },
    { nombre: "Cubierta",                        color: "#1D4ED8" },
    { nombre: "Revoques y enlucidos",            color: "#60A5FA" },
    { nombre: "Revestimientos y pisos",          color: "#8B5CF6" },
    { nombre: "Carpintería",                     color: "#EC4899" },
    { nombre: "Instalación sanitaria",           color: "#10B981" },
    { nombre: "Instalación eléctrica",           color: "#F59E0B" },
    { nombre: "Instalación de gas",              color: "#F97316" },
    { nombre: "Instalaciones embutidas",         color: "#A78BFA" },
    { nombre: "Calefacción",                     color: "#EF4444" },
    { nombre: "Pintura",                         color: "#06B6D4" },
    { nombre: "Vidriería",                       color: "#22D3EE" },
    { nombre: "Herrería y metálica",             color: "#6B7280" },
    { nombre: "Obras exteriores y paisajismo",   color: "#22C55E" },
    { nombre: "Honorarios profesionales",        color: "#1A3A5C" },
    { nombre: "Imprevistos",                     color: "#64748B" },
  ],
  REFORMA: [
    { nombre: "Demoliciones",        color: "#EF4444" },
    { nombre: "Estructura y refuerzos", color: "#2563EB" },
    { nombre: "Mampostería",         color: "#3B82F6" },
    { nombre: "Instalaciones",       color: "#10B981" },
    { nombre: "Revestimientos y pisos", color: "#8B5CF6" },
    { nombre: "Carpintería",         color: "#EC4899" },
    { nombre: "Pintura",             color: "#06B6D4" },
    { nombre: "Imprevistos",         color: "#64748B" },
  ],
  COMERCIAL: [
    { nombre: "Obra gruesa",              color: "#2563EB" },
    { nombre: "Instalaciones técnicas",  color: "#10B981" },
    { nombre: "Revestimientos y pisos",  color: "#8B5CF6" },
    { nombre: "Carpintería y vidriería", color: "#EC4899" },
    { nombre: "Aire acondicionado",      color: "#06B6D4" },
    { nombre: "Mobiliario y equipamiento", color: "#F59E0B" },
    { nombre: "Señalética y branding",   color: "#EF4444" },
    { nombre: "Imprevistos",             color: "#64748B" },
  ],
};

const CAPITULOS_DEFAULT = CAPITULOS_SUGERIDOS.VIVIENDA;

const COLORS = [
  "#2563EB", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#06B6D4", "#22C55E", "#78716C", "#64748B",
];

const STEPS = [
  { id: 1, label: "1. Datos" },
  { id: 2, label: "2. Detalles" },
  { id: 3, label: "3. Capítulos" },
  { id: 4, label: "4. Confirmar" },
];

/* ─── Componente principal ───────────────────────────── */
export default function NuevoProyectoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modoCompleto = searchParams.get("modo") === "completo";

  const [paso, setPaso] = useState(1);
  const [guardando, setGuardando] = useState(false);

  const [form, setForm] = useState<FormData>({
    nombre: "",
    cliente: "",
    tipo: searchParams.get("tipo")?.toUpperCase() ?? "VIVIENDA",
    rut: "",
    razonSocial: "",
    telefono: "",
    correo: "",
    direccion: "",
    trabajos: "",
    moneda: "USD",
    area: searchParams.get("area") ?? "",
    fechaInicio: "",
    plazoMeses: "",
    descripcion: "",
    capitulos: [],
  });

  const set = useCallback(<K extends keyof FormData>(key: K, val: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  }, []);

  const handleTipoChange = (tipo: string) => {
    set("tipo", tipo);
    const sugeridos = CAPITULOS_SUGERIDOS[tipo] ?? CAPITULOS_DEFAULT;
    set("capitulos", sugeridos.map((c, i) => ({
      id: String(i), nombre: c.nombre, color: c.color, activo: true,
    })));
  };

  const cargarSugeridos = () => {
    const sugeridos = CAPITULOS_SUGERIDOS[form.tipo] ?? CAPITULOS_DEFAULT;
    set("capitulos", sugeridos.map((c, i) => ({
      id: String(i), nombre: c.nombre, color: c.color, activo: true,
    })));
  };

  const toggleCapitulo = (id: string) => {
    set("capitulos", form.capitulos.map((c) => c.id === id ? { ...c, activo: !c.activo } : c));
  };

  const agregarCapitulo = () => {
    const color = COLORS[form.capitulos.length % COLORS.length];
    set("capitulos", [...form.capitulos, { id: String(Date.now()), nombre: "", color, activo: true }]);
  };

  const renombrarCapitulo = (id: string, nombre: string) => {
    set("capitulos", form.capitulos.map((c) => c.id === id ? { ...c, nombre } : c));
  };

  const eliminarCapitulo = (id: string) => {
    set("capitulos", form.capitulos.filter((c) => c.id !== id));
  };

  const puedeAvanzar = () => {
    if (paso === 1) return form.nombre.trim().length >= 2;
    if (paso === 2) return true;
    if (paso === 3) return form.capitulos.filter((c) => c.activo && c.nombre.trim()).length > 0;
    return true;
  };

  const handleGuardar = async () => {
    setGuardando(true);
    await new Promise((r) => setTimeout(r, 1200));
    router.push("/dashboard");
  };

  const capitularActivos = form.capitulos.filter((c) => c.activo && c.nombre.trim());

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto" style={{ minHeight: "100%", background: "#F0F4F8" }}>

      {/* Stepper */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-8"
      >
        <div className="flex items-center gap-0">
          {STEPS.map((step, i) => {
            const done   = paso > step.id;
            const active = paso === step.id;
            return (
              <div key={step.id} className="flex items-center flex-1 last:flex-none">
                <button
                  onClick={() => done && setPaso(step.id)}
                  disabled={!done}
                  className={cn(
                    "text-sm font-semibold whitespace-nowrap transition-colors",
                    active ? "text-[#2563EB]" : done ? "text-slate-500 cursor-pointer hover:text-[#2563EB]" : "text-slate-300"
                  )}
                >
                  {step.label}
                </button>
                {i < STEPS.length - 1 && (
                  <div className={cn(
                    "h-0.5 flex-1 mx-3 rounded transition-all",
                    paso > step.id ? "bg-[#2563EB]" : "bg-slate-200"
                  )} />
                )}
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Contenido del paso */}
      <AnimatePresence mode="wait">
        <motion.div
          key={paso}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.22 }}
        >

          {/* ── PASO 1: Datos de la obra ───────────────────── */}
          {paso === 1 && (
            <div className="space-y-5">
              <div className="mb-1">
                <h2 className="text-lg font-bold text-[#1A3A5C]">Datos de la obra</h2>
                <p className="text-sm text-slate-400">Lo esencial para identificar el proyecto</p>
              </div>

              <div className="bg-white rounded-[16px] border border-slate-300 p-6 space-y-4 shadow-sm">

                <Field label="Nombre del proyecto *">
                  <input
                    autoFocus
                    type="text"
                    value={form.nombre}
                    onChange={(e) => set("nombre", e.target.value)}
                    placeholder="ej: Vivienda unifamiliar — Pocitos"
                    className={inputCls}
                  />
                </Field>

                <Field label="Tipo de obra">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {TIPOS_OBRA.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => handleTipoChange(t.id)}
                        className={cn(
                          "px-3.5 py-2.5 rounded-[10px] border text-sm font-medium text-center transition-all",
                          form.tipo === t.id
                            ? "border-[#2563EB] bg-blue-50 text-[#2563EB]"
                            : "border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-800"
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Cliente / Comitente">
                  <input
                    type="text"
                    value={form.cliente}
                    onChange={(e) => set("cliente", e.target.value)}
                    placeholder="Nombre del cliente o comitente"
                    className={inputCls}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="RUT">
                    <input
                      type="text"
                      value={form.rut}
                      onChange={(e) => set("rut", e.target.value)}
                      placeholder="ej: 21234567-8"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Razón social">
                    <input
                      type="text"
                      value={form.razonSocial}
                      onChange={(e) => set("razonSocial", e.target.value)}
                      placeholder="ej: González Construcciones S.R.L."
                      className={inputCls}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Teléfono">
                    <input
                      type="text"
                      value={form.telefono}
                      onChange={(e) => set("telefono", e.target.value)}
                      placeholder="ej: 099 123 456"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Correo electrónico">
                    <input
                      type="email"
                      value={form.correo}
                      onChange={(e) => set("correo", e.target.value)}
                      placeholder="ej: contacto@empresa.com.uy"
                      className={inputCls}
                    />
                  </Field>
                </div>

                <Field label="Dirección / Ubicación de la obra">
                  <input
                    type="text"
                    value={form.direccion}
                    onChange={(e) => set("direccion", e.target.value)}
                    placeholder="ej: Bulevar España 2345, Montevideo"
                    className={inputCls}
                  />
                </Field>

                <Field label="Descripción / Trabajos a realizar">
                  <textarea
                    value={form.trabajos}
                    onChange={(e) => set("trabajos", e.target.value)}
                    placeholder="Describí brevemente los trabajos a realizar: construcción, reforma, instalaciones, terminaciones..."
                    rows={4}
                    className={cn(inputCls, "resize-none")}
                  />
                </Field>

                <Field label="Otros datos">
                  <textarea
                    value={form.descripcion}
                    onChange={(e) => set("descripcion", e.target.value)}
                    placeholder="Contacto administrador, inmobiliaria, observaciones generales..."
                    rows={3}
                    className={cn(inputCls, "resize-none")}
                  />
                </Field>
              </div>
            </div>
          )}

          {/* ── PASO 2: Detalles ──────────────────────────── */}
          {paso === 2 && (
            <div className="space-y-5">
              <div className="mb-1">
                <h2 className="text-lg font-bold text-[#1A3A5C]">Detalles del proyecto</h2>
                <p className="text-sm text-slate-400">Moneda, área y datos de referencia</p>
              </div>

              <div className="bg-white rounded-[16px] border border-slate-300 p-6 space-y-4 shadow-sm">

                <Field label="Moneda principal">
                  <div className="grid grid-cols-2 gap-3">
                    {(["USD", "UYU"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => set("moneda", m)}
                        className={cn(
                          "py-3 rounded-[12px] border text-center font-bold text-sm transition-all",
                          form.moneda === m
                            ? "border-[#2563EB] bg-blue-50 text-[#2563EB]"
                            : "border-slate-300 text-slate-600 hover:border-slate-400"
                        )}
                      >
                        {m === "USD" ? "U$S — Dólar" : "$ — Peso uruguayo"}
                      </button>
                    ))}
                  </div>
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Área total (m²)">
                    <div className="relative">
                      <input
                        type="number"
                        value={form.area}
                        onChange={(e) => set("area", e.target.value)}
                        placeholder="120"
                        min={1}
                        className={inputCls}
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">
                        m²
                      </span>
                    </div>
                  </Field>

                  <Field label="Fecha inicio estimada">
                    <input
                      type="date"
                      value={form.fechaInicio}
                      onChange={(e) => set("fechaInicio", e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                </div>

                <Field label="Plazo de obra (meses)">
                  <div className="relative max-w-[160px]">
                    <input
                      type="number"
                      value={form.plazoMeses}
                      onChange={(e) => set("plazoMeses", e.target.value)}
                      placeholder="ej: 8"
                      min={1}
                      className={inputCls}
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">
                      meses
                    </span>
                  </div>
                </Field>

                {modoCompleto && (
                  <div className="p-3.5 rounded-[10px] bg-blue-50 border border-blue-200 flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-[#2563EB] mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-[#2563EB] mb-0.5">Modo Proyecto Completo</p>
                      <p className="text-xs text-blue-500">
                        Se habilitarán ficha BPS, análisis de precios unitarios y
                        gestión de subcontratos al crear el proyecto.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── PASO 3: Capítulos ────────────────────────── */}
          {paso === 3 && (
            <div className="space-y-5">
              <div className="mb-1">
                <h2 className="text-lg font-bold text-[#1A3A5C]">Capítulos de la obra</h2>
                <p className="text-sm text-slate-400">Organizá el presupuesto en capítulos. Podés modificarlos después.</p>
              </div>

              <div className="bg-white rounded-[16px] border border-slate-300 p-5 shadow-sm">
                {form.capitulos.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-sm font-medium text-slate-500 mb-4">No hay capítulos todavía</p>
                    <button
                      onClick={cargarSugeridos}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-blue-50 text-[#2563EB] text-sm font-semibold hover:bg-blue-100 transition-colors"
                    >
                      <Sparkles className="w-4 h-4" />
                      Cargar sugeridos para {TIPOS_OBRA.find((t) => t.id === form.tipo)?.label}
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm text-slate-400">
                        {capitularActivos.length} capítulo{capitularActivos.length !== 1 ? "s" : ""} activo{capitularActivos.length !== 1 ? "s" : ""}
                      </p>
                      <button
                        onClick={cargarSugeridos}
                        className="text-xs text-[#2563EB] font-medium hover:text-[#1D4ED8] transition-colors flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3" />
                        Recargar sugeridos
                      </button>
                    </div>

                    <div className="space-y-1.5 mb-4 max-h-80 overflow-y-auto pr-1">
                      {form.capitulos.map((cap, idx) => (
                        <motion.div
                          key={cap.id}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.15, delay: idx * 0.03 }}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-[10px] border transition-all",
                            cap.activo ? "border-slate-200 bg-slate-50" : "border-slate-100 bg-slate-50/50 opacity-50"
                          )}
                        >
                          <span className="text-xs font-bold tabular-nums w-6 text-right flex-shrink-0" style={{ color: cap.activo ? "#2563EB" : "#94A3B8" }}>
                            {String(idx + 1).padStart(2, "0")}
                          </span>
                          <input
                            type="text"
                            value={cap.nombre}
                            onChange={(e) => renombrarCapitulo(cap.id, e.target.value)}
                            placeholder="Nombre del capítulo"
                            className="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                          />
                          <button
                            onClick={() => toggleCapitulo(cap.id)}
                            className={cn(
                              "w-9 h-5 rounded-full transition-colors flex-shrink-0",
                              cap.activo ? "bg-[#2563EB]" : "bg-slate-200"
                            )}
                          >
                            <span className={cn(
                              "block w-4 h-4 rounded-full bg-white shadow transition-transform mx-0.5",
                              cap.activo ? "translate-x-4" : "translate-x-0"
                            )} />
                          </button>
                          <button
                            onClick={() => eliminarCapitulo(cap.id)}
                            className="w-6 h-6 flex items-center justify-center rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </motion.div>
                      ))}
                    </div>

                    <button
                      onClick={agregarCapitulo}
                      className="flex items-center gap-2 w-full px-3 py-2.5 rounded-[10px] border border-dashed border-slate-300 text-sm text-slate-400 hover:text-slate-600 hover:border-slate-400 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      Agregar capítulo
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── PASO 4: Confirmar ──────────────────────── */}
          {paso === 4 && (
            <div className="space-y-5">
              <div className="mb-1">
                <h2 className="text-lg font-bold text-[#1A3A5C]">Confirmar y crear</h2>
                <p className="text-sm text-slate-400">Revisá los datos antes de crear el proyecto</p>
              </div>

              <div className="bg-white rounded-[16px] border border-slate-300 overflow-hidden shadow-sm">
                <div className="p-5 border-b border-slate-200">
                  <h3 className="font-bold text-[#1A3A5C]">{form.nombre || "Sin nombre"}</h3>
                  <p className="text-sm text-slate-400 mt-0.5">
                    {form.cliente || "Sin cliente"} · {TIPOS_OBRA.find((t) => t.id === form.tipo)?.label}
                  </p>
                </div>

                <div className="grid grid-cols-2 divide-x divide-y divide-slate-100">
                  {[
                    { label: "Moneda",    value: form.moneda },
                    { label: "Área",      value: form.area ? `${form.area} m²` : "—" },
                    { label: "Dirección", value: form.direccion || "—" },
                    { label: "Inicio",    value: form.fechaInicio ? new Date(form.fechaInicio).toLocaleDateString("es-UY") : "—" },
                  ].map(({ label, value }) => (
                    <div key={label} className="px-5 py-3.5">
                      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
                      <p className="text-sm font-semibold text-[#1A3A5C]">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="p-5 border-t border-slate-100">
                  <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-3">
                    {capitularActivos.length} Capítulos
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {capitularActivos.map((c) => (
                      <span
                        key={c.id}
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border"
                        style={{ color: c.color, borderColor: c.color + "40", background: c.color + "12" }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.color }} />
                        {c.nombre}
                      </span>
                    ))}
                  </div>
                </div>

                {form.descripcion && (
                  <div className="px-5 pb-5 border-t border-slate-100 pt-4">
                    <p className="text-xs text-slate-400 mb-1">Descripción</p>
                    <p className="text-sm text-slate-600">{form.descripcion}</p>
                  </div>
                )}
              </div>

              {modoCompleto && (
                <div className="p-4 rounded-[12px] bg-blue-50 border border-blue-200">
                  <p className="text-sm text-[#2563EB] font-semibold mb-0.5">Proyecto Completo activado</p>
                  <p className="text-xs text-blue-400">
                    Tras crear el proyecto podés completar ficha BPS, subcontratos
                    y análisis de precios unitarios.
                  </p>
                </div>
              )}
            </div>
          )}

        </motion.div>
      </AnimatePresence>

      {/* ─── Navegación inferior ────────────────────────────── */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-200">
        <button
          onClick={() => setPaso((p) => p - 1)}
          disabled={paso === 1}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-sm font-medium transition-all",
            paso === 1
              ? "text-slate-300 cursor-default"
              : "text-slate-500 hover:text-slate-700 hover:bg-white border border-slate-300"
          )}
        >
          <ChevronLeft className="w-4 h-4" />
          Atrás
        </button>

        <div className="flex items-center gap-1.5">
          {STEPS.map((s) => (
            <span
              key={s.id}
              className={cn(
                "rounded-full transition-all",
                paso === s.id ? "w-5 h-2 bg-[#2563EB]" : paso > s.id ? "w-2 h-2 bg-[#2563EB]/40" : "w-2 h-2 bg-slate-200"
              )}
            />
          ))}
        </div>

        {paso < 4 ? (
          <button
            onClick={() => {
              if (paso === 1 && form.capitulos.length === 0) handleTipoChange(form.tipo);
              setPaso((p) => p + 1);
            }}
            disabled={!puedeAvanzar()}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-sm font-semibold transition-all",
              puedeAvanzar()
                ? "bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            )}
            style={puedeAvanzar() ? { boxShadow: "0 4px 12px 0 rgb(37 99 235 / 0.25)" } : {}}
          >
            {paso === 3 ? "Revisar" : "Siguiente"}
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleGuardar}
            disabled={guardando}
            className="flex items-center gap-2 px-5 py-2.5 rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-all disabled:opacity-70"
            style={{ boxShadow: "0 4px 12px 0 rgb(37 99 235 / 0.25)" }}
          >
            {guardando ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creando...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Crear proyecto
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Componentes auxiliares ─────────────────────────── */
const inputCls =
  "w-full px-3.5 py-2.5 rounded-[10px] border border-slate-300 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-[#1A3A5C] mb-1.5">{label}</label>
      {children}
    </div>
  );
}
