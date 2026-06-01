"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  ArrowRight,
  Calculator,
  Download,
  FolderPlus,
  ChevronDown,
  Info,
  RotateCcw,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";

/* ─── Datos de referencia ─────────────────────────────────── */
const TIPOS_OBRA = [
  { id: "vivienda",   label: "Vivienda unifamiliar",   emoji: "🏠" },
  { id: "apartamento",label: "Apartamento",             emoji: "🏢" },
  { id: "comercial",  label: "Local comercial",         emoji: "🏪" },
  { id: "industrial", label: "Galpón / Industrial",     emoji: "🏭" },
  { id: "reforma",    label: "Reforma / Ampliación",    emoji: "🔨" },
];

const CALIDADES = [
  { id: "basica",    label: "Básica",   desc: "Terminaciones sencillas, materiales económicos" },
  { id: "estandar",  label: "Estándar", desc: "Buen nivel, materiales de media gama" },
  { id: "premium",   label: "Premium",  desc: "Alta terminación, materiales de primera línea" },
];

const ZONAS = [
  { id: "montevideo", label: "Montevideo" },
  { id: "interior",   label: "Interior del país" },
  { id: "costa",      label: "Costa / Punta del Este" },
];

/* Precio base en USD/m² según tipo y calidad */
const PRECIOS_BASE: Record<string, Record<string, number>> = {
  vivienda:    { basica: 480,  estandar: 750,  premium: 1150 },
  apartamento: { basica: 520,  estandar: 800,  premium: 1250 },
  comercial:   { basica: 420,  estandar: 650,  premium: 980  },
  industrial:  { basica: 280,  estandar: 420,  premium: 620  },
  reforma:     { basica: 220,  estandar: 370,  premium: 580  },
};

/* Multiplicador por zona */
const ZONA_MULT: Record<string, number> = {
  montevideo: 1.0,
  interior:   0.88,
  costa:      1.18,
};

/* Distribución por capítulo (% del total) */
const CAPITULOS = [
  { nombre: "Trabajos preliminares", pct: 0.03, color: "#94A3B8" },
  { nombre: "Estructura y fundaciones", pct: 0.22, color: "#2563EB" },
  { nombre: "Mampostería y muros", pct: 0.14, color: "#3B82F6" },
  { nombre: "Cubierta y azotea", pct: 0.09, color: "#1D4ED8" },
  { nombre: "Inst. hidrosanitarias", pct: 0.09, color: "#10B981" },
  { nombre: "Inst. eléctricas", pct: 0.08, color: "#F59E0B" },
  { nombre: "Revestimientos y pisos", pct: 0.13, color: "#8B5CF6" },
  { nombre: "Carpintería", pct: 0.09, color: "#EC4899" },
  { nombre: "Pintura y terminaciones", pct: 0.06, color: "#06B6D4" },
  { nombre: "Imprevistos y varios", pct: 0.07, color: "#64748B" },
];

const TCU = 42.5; // Tipo de cambio orientativo UYU/USD

export default function CalcularPage() {
  const [tipo, setTipo]       = useState("vivienda");
  const [calidad, setCalidad] = useState("estandar");
  const [zona, setZona]       = useState("montevideo");
  const [area, setArea]       = useState<string>("120");
  const [moneda, setMoneda]   = useState<"USD" | "UYU">("USD");
  const [mostrarDetalle, setMostrarDetalle] = useState(false);

  const areaNum = parseFloat(area) || 0;

  const resultado = useMemo(() => {
    if (areaNum <= 0) return null;
    const precioBase = PRECIOS_BASE[tipo]?.[calidad] ?? 600;
    const mult       = ZONA_MULT[zona] ?? 1;
    const totalUSD   = areaNum * precioBase * mult;
    const totalUYU   = totalUSD * TCU;
    const total      = moneda === "USD" ? totalUSD : totalUYU;
    return { totalUSD, totalUYU, total, precioM2: precioBase * mult };
  }, [areaNum, tipo, calidad, zona, moneda]);

  const fmt = (v: number) =>
    moneda === "USD"
      ? `U$S ${Math.round(v).toLocaleString("es-UY")}`
      : `$ ${Math.round(v).toLocaleString("es-UY")}`;

  return (
    <div className="min-h-full bg-bg-base flex flex-col">
      <Header />

      <div className="max-w-6xl mx-auto w-full px-6 py-10 flex-1">
        {/* Encabezado */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-8"
        >
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-9 h-9 rounded-[10px] bg-amber-50 flex items-center justify-center">
              <Zap className="w-5 h-5 text-amber-500" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-text-primary leading-tight">
                Cálculo Rápido
              </h1>
              <p className="text-sm text-text-muted">
                Estimación orientativa · sin registro
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
            <Info className="w-3 h-3" />
            Los valores son orientativos basados en promedios del mercado uruguayo (2025)
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6">

          {/* ─── Panel izquierdo — formulario ─────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="space-y-5"
          >
            {/* Tipo de obra */}
            <div className="bg-bg-card rounded-[14px] border border-border p-5"
              style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.06)" }}>
              <label className="block text-sm font-semibold text-text-primary mb-3">
                Tipo de obra
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {TIPOS_OBRA.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTipo(t.id)}
                    className={cn(
                      "flex items-center gap-2.5 px-3.5 py-2.5 rounded-[10px] border text-sm font-medium transition-all text-left",
                      tipo === t.id
                        ? "border-brand-accent bg-brand-pale text-brand-accent"
                        : "border-border text-text-secondary hover:border-brand-muted hover:bg-brand-pale/40"
                    )}
                  >
                    <span className="text-base">{t.emoji}</span>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Área */}
            <div className="bg-bg-card rounded-[14px] border border-border p-5"
              style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.06)" }}>
              <label className="block text-sm font-semibold text-text-primary mb-3">
                Área a construir
              </label>
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-[200px]">
                  <input
                    type="number"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    min={1}
                    max={9999}
                    placeholder="120"
                    className="w-full px-4 py-3 rounded-[10px] border border-border bg-bg-base text-lg font-bold text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 transition-all text-center pr-12"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-text-muted font-medium">
                    m²
                  </span>
                </div>
                <div className="flex gap-1.5">
                  {[50, 100, 200, 500].map((v) => (
                    <button
                      key={v}
                      onClick={() => setArea(String(v))}
                      className={cn(
                        "px-3 py-2 rounded-[8px] text-sm font-medium border transition-all",
                        area === String(v)
                          ? "border-brand-accent bg-brand-pale text-brand-accent"
                          : "border-border text-text-muted hover:border-brand-muted hover:text-text-secondary"
                      )}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Calidad */}
            <div className="bg-bg-card rounded-[14px] border border-border p-5"
              style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.06)" }}>
              <label className="block text-sm font-semibold text-text-primary mb-3">
                Nivel de terminación
              </label>
              <div className="grid grid-cols-3 gap-2">
                {CALIDADES.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCalidad(c.id)}
                    className={cn(
                      "p-3.5 rounded-[10px] border text-left transition-all",
                      calidad === c.id
                        ? "border-brand-accent bg-brand-pale"
                        : "border-border hover:border-brand-muted"
                    )}
                  >
                    <p className={cn(
                      "text-sm font-semibold mb-0.5",
                      calidad === c.id ? "text-brand-accent" : "text-text-primary"
                    )}>
                      {c.label}
                    </p>
                    <p className="text-xs text-text-muted leading-snug">{c.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Zona y moneda */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-bg-card rounded-[14px] border border-border p-5"
                style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.06)" }}>
                <label className="block text-sm font-semibold text-text-primary mb-3">
                  Zona
                </label>
                <div className="space-y-1.5">
                  {ZONAS.map((z) => (
                    <button
                      key={z.id}
                      onClick={() => setZona(z.id)}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 rounded-[8px] text-sm transition-all text-left",
                        zona === z.id
                          ? "bg-brand-pale text-brand-accent font-semibold"
                          : "text-text-secondary hover:bg-bg-base"
                      )}
                    >
                      <span className={cn(
                        "w-2 h-2 rounded-full flex-shrink-0",
                        zona === z.id ? "bg-brand-accent" : "bg-border"
                      )} />
                      {z.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-bg-card rounded-[14px] border border-border p-5"
                style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.06)" }}>
                <label className="block text-sm font-semibold text-text-primary mb-3">
                  Moneda
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["USD", "UYU"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMoneda(m)}
                      className={cn(
                        "py-3 rounded-[10px] border text-sm font-bold transition-all",
                        moneda === m
                          ? "border-brand-accent bg-brand-pale text-brand-accent"
                          : "border-border text-text-muted hover:border-brand-muted"
                      )}
                    >
                      {m === "USD" ? "U$S" : "$ UYU"}
                    </button>
                  ))}
                </div>
                {moneda === "UYU" && (
                  <p className="text-xs text-text-muted mt-2">
                    TC ref.: $ {TCU}/dólar
                  </p>
                )}
              </div>
            </div>
          </motion.div>

          {/* ─── Panel derecho — resultados ───────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="space-y-4"
          >
            {/* Card total */}
            <div
              className="bg-brand-deep rounded-[16px] p-6 relative overflow-hidden"
              style={{ boxShadow: "0 8px 32px 0 rgb(26 58 92 / 0.25)" }}
            >
              {/* Decoración de fondo */}
              <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/5" />
              <div className="absolute -right-4 top-12 w-16 h-16 rounded-full bg-white/5" />

              <div className="relative">
                <div className="flex items-center gap-2 mb-4">
                  <Calculator className="w-4 h-4 text-white/50" />
                  <span className="text-sm text-white/60 font-medium">
                    Estimación total
                  </span>
                </div>

                <AnimatePresence mode="wait">
                  {resultado ? (
                    <motion.div
                      key={resultado.total}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="text-3xl font-bold text-white mb-1">
                        {fmt(resultado.total)}
                      </div>
                      <p className="text-sm text-white/50">
                        {areaNum} m² · ~{moneda === "USD"
                          ? `U$S ${Math.round(resultado.precioM2).toLocaleString("es-UY")}`
                          : `$ ${Math.round(resultado.precioM2 * TCU).toLocaleString("es-UY")}`}/m²
                      </p>
                      {moneda === "USD" && (
                        <p className="text-xs text-white/35 mt-1">
                          ≈ $ {Math.round(resultado.totalUYU).toLocaleString("es-UY")} UYU
                        </p>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <div className="text-2xl font-bold text-white/30 mb-1">
                        Ingresá el área
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {resultado && (
                  <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-white/40">Rango mínimo</p>
                      <p className="text-sm font-semibold text-white/70">
                        {fmt(resultado.total * 0.88)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-white/40">Rango máximo</p>
                      <p className="text-sm font-semibold text-white/70">
                        {fmt(resultado.total * 1.15)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Desglose por capítulo */}
            {resultado && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-bg-card rounded-[14px] border border-border p-5"
                style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.06)" }}
              >
                <button
                  onClick={() => setMostrarDetalle(!mostrarDetalle)}
                  className="flex items-center justify-between w-full mb-3"
                >
                  <span className="text-sm font-semibold text-text-primary">
                    Desglose por capítulo
                  </span>
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 text-text-muted transition-transform",
                      mostrarDetalle && "rotate-180"
                    )}
                  />
                </button>

                {/* Barra acumulada */}
                <div className="h-2.5 rounded-full overflow-hidden flex mb-3">
                  {CAPITULOS.map((c) => (
                    <div
                      key={c.nombre}
                      style={{ width: `${c.pct * 100}%`, background: c.color }}
                      title={c.nombre}
                    />
                  ))}
                </div>

                <AnimatePresence>
                  {mostrarDetalle && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-2.5 pt-1">
                        {CAPITULOS.map((c) => {
                          const val = resultado.total * c.pct;
                          return (
                            <div key={c.nombre} className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                                  style={{ background: c.color }}
                                />
                                <span className="text-sm text-text-secondary truncate">
                                  {c.nombre}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <div className="w-20 h-1.5 bg-bg-base rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${c.pct * 100 / 0.22 * 100}%`,
                                      background: c.color,
                                      maxWidth: "100%",
                                    }}
                                  />
                                </div>
                                <span className="text-sm font-semibold text-text-primary tabular-nums w-24 text-right">
                                  {fmt(val)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* Acciones */}
            {resultado && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="space-y-2.5"
              >
                <Link
                  href={`/proyectos/nuevo?tipo=${tipo}&area=${areaNum}&calidad=${calidad}`}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-[12px] bg-brand-accent hover:bg-brand-light text-white font-semibold text-sm transition-colors"
                  style={{ boxShadow: "0 4px 12px 0 rgb(37 99 235 / 0.3)" }}
                >
                  <FolderPlus className="w-4.5 h-4.5" />
                  Convertir en proyecto real
                </Link>

                <button className="flex items-center justify-center gap-2 w-full py-3 rounded-[12px] border border-border text-text-secondary hover:text-text-primary hover:border-brand-muted font-medium text-sm transition-colors bg-bg-card">
                  <Download className="w-4.5 h-4.5" />
                  Exportar estimación en PDF
                </button>

                <button
                  onClick={() => {
                    setTipo("vivienda");
                    setCalidad("estandar");
                    setZona("montevideo");
                    setArea("120");
                    setMoneda("USD");
                  }}
                  className="flex items-center justify-center gap-2 w-full py-2 text-text-muted hover:text-text-secondary text-sm transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reiniciar
                </button>
              </motion.div>
            )}

            {/* Aviso profesional */}
            <div className="text-xs text-text-muted leading-relaxed p-4 bg-bg-base rounded-[10px] border border-border">
              <strong className="text-text-secondary">Importante:</strong> Esta estimación
              es orientativa. Los valores reales dependen de especificaciones técnicas,
              proveedores, y condiciones del terreno. Para un presupuesto preciso, creá
              un proyecto completo con rubros detallados.
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
