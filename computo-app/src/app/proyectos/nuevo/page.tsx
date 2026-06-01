"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  User,
  MapPin,
  DollarSign,
  Calendar,
  Layers,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Plus,
  X,
  Sparkles,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Tipos ─────────────────────────────────────────────── */
interface FormData {
  // Paso 1
  nombre: string;
  cliente: string;
  tipo: string;
  direccion: string;
  // Paso 2
  moneda: "UYU" | "USD";
  area: string;
  fechaInicio: string;
  descripcion: string;
  // Paso 3
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
  { id: "VIVIENDA",   label: "Vivienda",        emoji: "🏠", desc: "Casa, chalet, vivienda unifamiliar" },
  { id: "APARTAMENTO",label: "Apartamento",      emoji: "🏢", desc: "Unidades en edificio" },
  { id: "EDIFICIO",   label: "Edificio",         emoji: "🏗️", desc: "Edificio de varios pisos" },
  { id: "COMERCIAL",  label: "Local comercial",  emoji: "🏪", desc: "Oficina, local, showroom" },
  { id: "INDUSTRIAL", label: "Industrial",       emoji: "🏭", desc: "Galpón, planta, depósito" },
  { id: "REFORMA",    label: "Reforma",          emoji: "🔨", desc: "Reforma, ampliación, refacción" },
];

const CAPITULOS_SUGERIDOS: Record<string, Array<{ nombre: string; color: string }>> = {
  VIVIENDA: [
    { nombre: "Trabajos preliminares", color: "#94A3B8" },
    { nombre: "Movimiento de tierra y fundaciones", color: "#78716C" },
    { nombre: "Estructura", color: "#2563EB" },
    { nombre: "Mampostería y muros", color: "#3B82F6" },
    { nombre: "Cubierta", color: "#1D4ED8" },
    { nombre: "Instalación sanitaria", color: "#10B981" },
    { nombre: "Instalación eléctrica", color: "#F59E0B" },
    { nombre: "Revestimientos y pisos", color: "#8B5CF6" },
    { nombre: "Carpintería", color: "#EC4899" },
    { nombre: "Pintura y terminaciones", color: "#06B6D4" },
    { nombre: "Paisajismo y exteriores", color: "#22C55E" },
    { nombre: "Imprevistos", color: "#64748B" },
  ],
  REFORMA: [
    { nombre: "Demoliciones", color: "#EF4444" },
    { nombre: "Estructura y refuerzos", color: "#2563EB" },
    { nombre: "Mampostería", color: "#3B82F6" },
    { nombre: "Instalaciones", color: "#10B981" },
    { nombre: "Revestimientos y pisos", color: "#8B5CF6" },
    { nombre: "Carpintería", color: "#EC4899" },
    { nombre: "Pintura", color: "#06B6D4" },
    { nombre: "Imprevistos", color: "#64748B" },
  ],
  COMERCIAL: [
    { nombre: "Obra gruesa", color: "#2563EB" },
    { nombre: "Instalaciones técnicas", color: "#10B981" },
    { nombre: "Revestimientos y pisos", color: "#8B5CF6" },
    { nombre: "Carpintería y vidriería", color: "#EC4899" },
    { nombre: "Aire acondicionado", color: "#06B6D4" },
    { nombre: "Mobiliario y equipamiento", color: "#F59E0B" },
    { nombre: "Señalética y branding", color: "#EF4444" },
    { nombre: "Imprevistos", color: "#64748B" },
  ],
};

// Fallback para tipos sin sugerencia específica
const CAPITULOS_DEFAULT = CAPITULOS_SUGERIDOS.VIVIENDA;

const COLORS = [
  "#2563EB", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#06B6D4", "#22C55E", "#78716C", "#64748B",
];

const STEPS = [
  { id: 1, label: "Datos de la obra", icon: Building2 },
  { id: 2, label: "Detalles",          icon: FileText },
  { id: 3, label: "Capítulos",         icon: Layers },
  { id: 4, label: "Confirmar",         icon: CheckCircle2 },
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
    direccion: "",
    moneda: "USD",
    area: searchParams.get("area") ?? "",
    fechaInicio: "",
    descripcion: "",
    capitulos: [],
  });

  /* Actualizar campo del form */
  const set = useCallback(<K extends keyof FormData>(key: K, val: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  }, []);

  /* Cuando cambia el tipo, sugerir capítulos */
  const handleTipoChange = (tipo: string) => {
    set("tipo", tipo);
    const sugeridos = CAPITULOS_SUGERIDOS[tipo] ?? CAPITULOS_DEFAULT;
    set("capitulos", sugeridos.map((c, i) => ({
      id: String(i),
      nombre: c.nombre,
      color: c.color,
      activo: true,
    })));
  };

  /* Cargar capítulos sugeridos */
  const cargarSugeridos = () => {
    const sugeridos = CAPITULOS_SUGERIDOS[form.tipo] ?? CAPITULOS_DEFAULT;
    set("capitulos", sugeridos.map((c, i) => ({
      id: String(i),
      nombre: c.nombre,
      color: c.color,
      activo: true,
    })));
  };

  /* Toggle capítulo */
  const toggleCapitulo = (id: string) => {
    set("capitulos", form.capitulos.map((c) =>
      c.id === id ? { ...c, activo: !c.activo } : c
    ));
  };

  /* Agregar capítulo nuevo */
  const agregarCapitulo = () => {
    const color = COLORS[form.capitulos.length % COLORS.length];
    set("capitulos", [...form.capitulos, {
      id: String(Date.now()),
      nombre: "",
      color,
      activo: true,
    }]);
  };

  /* Renombrar capítulo */
  const renombrarCapitulo = (id: string, nombre: string) => {
    set("capitulos", form.capitulos.map((c) =>
      c.id === id ? { ...c, nombre } : c
    ));
  };

  /* Eliminar capítulo */
  const eliminarCapitulo = (id: string) => {
    set("capitulos", form.capitulos.filter((c) => c.id !== id));
  };

  /* Validaciones por paso */
  const puedeAvanzar = () => {
    if (paso === 1) return form.nombre.trim().length >= 2;
    if (paso === 2) return true;
    if (paso === 3) return form.capitulos.filter((c) => c.activo && c.nombre.trim()).length > 0;
    return true;
  };

  /* Guardar proyecto (mock) */
  const handleGuardar = async () => {
    setGuardando(true);
    await new Promise((r) => setTimeout(r, 1200));
    router.push("/dashboard");
  };

  const capitularActivos = form.capitulos.filter((c) => c.activo && c.nombre.trim());

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto">

      {/* Stepper */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-8"
      >
        <div className="flex items-center gap-0">
          {STEPS.map((step, i) => {
            const done    = paso > step.id;
            const active  = paso === step.id;
            const Icon    = step.icon;
            return (
              <div key={step.id} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1.5">
                  <button
                    onClick={() => done && setPaso(step.id)}
                    disabled={!done}
                    className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all font-bold text-sm",
                      done
                        ? "bg-brand-accent border-brand-accent text-white cursor-pointer hover:bg-brand-light"
                        : active
                        ? "border-brand-accent bg-white text-brand-accent"
                        : "border-border bg-white text-text-muted"
                    )}
                  >
                    {done ? (
                      <CheckCircle2 className="w-4.5 h-4.5" strokeWidth={2.5} />
                    ) : (
                      <Icon className="w-4 h-4" strokeWidth={active ? 2.5 : 1.75} />
                    )}
                  </button>
                  <span className={cn(
                    "text-[11px] font-medium whitespace-nowrap hidden sm:block",
                    active ? "text-brand-accent" : done ? "text-text-secondary" : "text-text-muted"
                  )}>
                    {step.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn(
                    "h-0.5 flex-1 mx-2 mb-5 rounded transition-all",
                    paso > step.id ? "bg-brand-accent" : "bg-border"
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
              <StepHeader
                icon={Building2}
                title="Datos de la obra"
                desc="Lo esencial para identificar el proyecto"
              />

              <div className="bg-bg-card rounded-[16px] border border-border p-6 space-y-4"
                style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.06)" }}>

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

                <Field label="Cliente">
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                    <input
                      type="text"
                      value={form.cliente}
                      onChange={(e) => set("cliente", e.target.value)}
                      placeholder="Nombre del cliente o comitente"
                      className={cn(inputCls, "pl-10")}
                    />
                  </div>
                </Field>

                <Field label="Tipo de obra">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {TIPOS_OBRA.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => handleTipoChange(t.id)}
                        className={cn(
                          "flex items-start gap-2.5 p-3 rounded-[10px] border text-left transition-all",
                          form.tipo === t.id
                            ? "border-brand-accent bg-brand-pale"
                            : "border-border hover:border-brand-muted"
                        )}
                      >
                        <span className="text-lg leading-none mt-0.5">{t.emoji}</span>
                        <div>
                          <p className={cn("text-sm font-semibold",
                            form.tipo === t.id ? "text-brand-accent" : "text-text-primary"
                          )}>
                            {t.label}
                          </p>
                          <p className="text-[11px] text-text-muted leading-snug mt-0.5">
                            {t.desc}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Dirección / Ubicación">
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                    <input
                      type="text"
                      value={form.direccion}
                      onChange={(e) => set("direccion", e.target.value)}
                      placeholder="ej: Bulevar España 2345, Montevideo"
                      className={cn(inputCls, "pl-10")}
                    />
                  </div>
                </Field>
              </div>
            </div>
          )}

          {/* ── PASO 2: Detalles ──────────────────────────── */}
          {paso === 2 && (
            <div className="space-y-5">
              <StepHeader
                icon={FileText}
                title="Detalles del proyecto"
                desc="Moneda, área y datos de referencia"
              />

              <div className="bg-bg-card rounded-[16px] border border-border p-6 space-y-4"
                style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.06)" }}>

                <Field label="Moneda principal">
                  <div className="grid grid-cols-2 gap-3">
                    {(["USD", "UYU"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => set("moneda", m)}
                        className={cn(
                          "p-4 rounded-[12px] border text-center transition-all",
                          form.moneda === m
                            ? "border-brand-accent bg-brand-pale"
                            : "border-border hover:border-brand-muted"
                        )}
                      >
                        <div className="flex items-center justify-center gap-2 mb-1">
                          <DollarSign className={cn(
                            "w-4 h-4",
                            form.moneda === m ? "text-brand-accent" : "text-text-muted"
                          )} />
                          <span className={cn(
                            "font-bold text-base",
                            form.moneda === m ? "text-brand-accent" : "text-text-primary"
                          )}>
                            {m}
                          </span>
                        </div>
                        <p className="text-xs text-text-muted">
                          {m === "USD" ? "Dólar estadounidense" : "Peso uruguayo"}
                        </p>
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
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-text-muted font-medium">
                        m²
                      </span>
                    </div>
                  </Field>

                  <Field label="Fecha inicio estimada">
                    <div className="relative">
                      <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                      <input
                        type="date"
                        value={form.fechaInicio}
                        onChange={(e) => set("fechaInicio", e.target.value)}
                        className={cn(inputCls, "pl-10")}
                      />
                    </div>
                  </Field>
                </div>

                <Field label="Descripción / Notas">
                  <textarea
                    value={form.descripcion}
                    onChange={(e) => set("descripcion", e.target.value)}
                    placeholder="Descripción general del proyecto, requisitos especiales, etc."
                    rows={3}
                    className={cn(inputCls, "resize-none")}
                  />
                </Field>

                {modoCompleto && (
                  <div className="p-3.5 rounded-[10px] bg-brand-pale border border-brand-muted flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-brand-accent mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-brand-accent mb-0.5">
                        Modo Proyecto Completo
                      </p>
                      <p className="text-xs text-brand-accent/70">
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
              <StepHeader
                icon={Layers}
                title="Capítulos de la obra"
                desc="Organizá el presupuesto en capítulos. Podés modificarlos después."
              />

              <div className="bg-bg-card rounded-[16px] border border-border p-5"
                style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.06)" }}>

                {form.capitulos.length === 0 ? (
                  <div className="text-center py-10">
                    <Layers className="w-10 h-10 text-text-muted mx-auto mb-3" strokeWidth={1.5} />
                    <p className="text-sm font-medium text-text-secondary mb-4">
                      No hay capítulos todavía
                    </p>
                    <button
                      onClick={cargarSugeridos}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-brand-pale text-brand-accent text-sm font-semibold hover:bg-brand-muted transition-colors"
                    >
                      <Sparkles className="w-4 h-4" />
                      Cargar sugeridos para {TIPOS_OBRA.find((t) => t.id === form.tipo)?.label}
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm text-text-muted">
                        {capitularActivos.length} capítulo{capitularActivos.length !== 1 ? "s" : ""} activo{capitularActivos.length !== 1 ? "s" : ""}
                      </p>
                      <button
                        onClick={cargarSugeridos}
                        className="text-xs text-brand-accent font-medium hover:text-brand-light transition-colors flex items-center gap-1"
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
                            cap.activo ? "border-border bg-bg-base" : "border-border/50 bg-bg-base/50 opacity-50"
                          )}
                        >
                          {/* Dot color */}
                          <span
                            className="w-3 h-3 rounded-sm flex-shrink-0 cursor-pointer"
                            style={{ background: cap.color }}
                            title="Color del capítulo"
                          />

                          {/* Nombre editable */}
                          <input
                            type="text"
                            value={cap.nombre}
                            onChange={(e) => renombrarCapitulo(cap.id, e.target.value)}
                            placeholder="Nombre del capítulo"
                            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
                          />

                          {/* Toggle activo */}
                          <button
                            onClick={() => toggleCapitulo(cap.id)}
                            className={cn(
                              "w-9 h-5 rounded-full transition-colors flex-shrink-0",
                              cap.activo ? "bg-brand-accent" : "bg-border"
                            )}
                          >
                            <span className={cn(
                              "block w-4 h-4 rounded-full bg-white shadow transition-transform mx-0.5",
                              cap.activo ? "translate-x-4" : "translate-x-0"
                            )} />
                          </button>

                          {/* Eliminar */}
                          <button
                            onClick={() => eliminarCapitulo(cap.id)}
                            className="w-6 h-6 flex items-center justify-center rounded-full text-text-muted hover:text-danger hover:bg-red-50 transition-colors flex-shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </motion.div>
                      ))}
                    </div>

                    <button
                      onClick={agregarCapitulo}
                      className="flex items-center gap-2 w-full px-3 py-2.5 rounded-[10px] border border-dashed border-border text-sm text-text-muted hover:text-text-secondary hover:border-brand-muted transition-all"
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
              <StepHeader
                icon={CheckCircle2}
                title="Confirmar y crear"
                desc="Revisá los datos antes de crear el proyecto"
              />

              {/* Resumen */}
              <div className="bg-bg-card rounded-[16px] border border-border overflow-hidden"
                style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.06)" }}>

                {/* Header del resumen */}
                <div className="p-5 border-b border-border flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[10px] bg-brand-pale flex items-center justify-center">
                    <span className="text-lg">
                      {TIPOS_OBRA.find((t) => t.id === form.tipo)?.emoji}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-text-primary">
                      {form.nombre || "Sin nombre"}
                    </h3>
                    <p className="text-sm text-text-muted">
                      {form.cliente || "Sin cliente"} · {TIPOS_OBRA.find((t) => t.id === form.tipo)?.label}
                    </p>
                  </div>
                </div>

                {/* Grilla de datos */}
                <div className="grid grid-cols-2 divide-x divide-y divide-border">
                  {[
                    { label: "Moneda", value: form.moneda },
                    { label: "Área", value: form.area ? `${form.area} m²` : "—" },
                    { label: "Dirección", value: form.direccion || "—" },
                    { label: "Inicio", value: form.fechaInicio ? new Date(form.fechaInicio).toLocaleDateString("es-UY") : "—" },
                  ].map(({ label, value }) => (
                    <div key={label} className="px-5 py-3.5">
                      <p className="text-xs text-text-muted mb-0.5">{label}</p>
                      <p className="text-sm font-semibold text-text-primary">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Capítulos */}
                <div className="p-5 border-t border-border">
                  <p className="text-xs text-text-muted uppercase tracking-wider font-semibold mb-3">
                    {capitularActivos.length} Capítulos
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {capitularActivos.map((c) => (
                      <span
                        key={c.id}
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border"
                        style={{
                          color: c.color,
                          borderColor: c.color + "40",
                          background: c.color + "12",
                        }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: c.color }}
                        />
                        {c.nombre}
                      </span>
                    ))}
                  </div>
                </div>

                {form.descripcion && (
                  <div className="px-5 pb-5 border-t border-border pt-4">
                    <p className="text-xs text-text-muted mb-1">Descripción</p>
                    <p className="text-sm text-text-secondary">{form.descripcion}</p>
                  </div>
                )}
              </div>

              {/* Aviso BPS si modo completo */}
              {modoCompleto && (
                <div className="p-4 rounded-[12px] bg-brand-pale border border-brand-muted">
                  <p className="text-sm text-brand-accent font-semibold mb-0.5">
                    Proyecto Completo activado
                  </p>
                  <p className="text-xs text-brand-accent/70">
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
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
        <button
          onClick={() => setPaso((p) => p - 1)}
          disabled={paso === 1}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-sm font-medium transition-all",
            paso === 1
              ? "text-text-muted cursor-default"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-base border border-border"
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
                paso === s.id
                  ? "w-5 h-2 bg-brand-accent"
                  : paso > s.id
                  ? "w-2 h-2 bg-brand-accent/50"
                  : "w-2 h-2 bg-border"
              )}
            />
          ))}
        </div>

        {paso < 4 ? (
          <button
            onClick={() => {
              if (paso === 1 && form.capitulos.length === 0) {
                handleTipoChange(form.tipo);
              }
              setPaso((p) => p + 1);
            }}
            disabled={!puedeAvanzar()}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-sm font-semibold transition-all",
              puedeAvanzar()
                ? "bg-brand-accent hover:bg-brand-light text-white"
                : "bg-border text-text-muted cursor-not-allowed"
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
            className="flex items-center gap-2 px-5 py-2.5 rounded-[10px] bg-brand-accent hover:bg-brand-light text-white text-sm font-semibold transition-all disabled:opacity-70"
            style={{ boxShadow: "0 4px 12px 0 rgb(37 99 235 / 0.25)" }}
          >
            {guardando ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creando...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4.5 h-4.5" />
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
  "w-full px-3.5 py-2.5 rounded-[10px] border border-border bg-bg-base text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/15 transition-all";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-text-primary mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

function StepHeader({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-1">
      <div className="w-10 h-10 rounded-[12px] bg-brand-pale flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-brand-accent" strokeWidth={2} />
      </div>
      <div>
        <h2 className="text-lg font-bold text-text-primary">{title}</h2>
        <p className="text-sm text-text-muted">{desc}</p>
      </div>
    </div>
  );
}
