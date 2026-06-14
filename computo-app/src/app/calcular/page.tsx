"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calculator,
  Download,
  FolderPlus,
  ChevronDown,
  RotateCcw,
  Loader2,
  Camera,
  X,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";

/* ─── Datos de referencia ─────────────────────────────────── */
const TIPOS_OBRA = [
  { id: "reparaciones", label: "Reparaciones" },
  { id: "reforma",      label: "Reforma / Ampliación" },
  { id: "vivienda",     label: "Vivienda unifamiliar" },
  { id: "ph",           label: "Propiedad Horizontal" },
  { id: "comercial",    label: "Local comercial" },
  { id: "industrial",   label: "Industrial" },
];

const CALIDADES = [
  { id: "basica",   label: "Económica" },
  { id: "estandar", label: "Media" },
  { id: "premium",  label: "Alta" },
];

const ZONAS = [
  { id: "montevideo", label: "Montevideo" },
  { id: "interior",   label: "Interior del país" },
  { id: "costa",      label: "Costa / Punta del Este" },
];

const PRECIOS_BASE: Record<string, Record<string, number>> = {
  reparaciones: { basica: 200,  estandar: 350,  premium: 500  },
  reforma:      { basica: 350,  estandar: 550,  premium: 800  },
  vivienda:     { basica: 550,  estandar: 750,  premium: 1100 },
  ph:           { basica: 600,  estandar: 800,  premium: 1200 },
  comercial:    { basica: 500,  estandar: 700,  premium: 1000 },
  industrial:   { basica: 300,  estandar: 450,  premium: 650  },
};

const ZONA_MULT: Record<string, number> = {
  montevideo: 1.0,
  interior:   0.88,
  costa:      1.18,
};

const CAPITULOS = [
  { nombre: "Trabajos preliminares",         pct: 0.03, matPct: 0.40, moPct: 0.60, color: "#E0E7FF" },
  { nombre: "Movimiento de tierra",          pct: 0.04, matPct: 0.30, moPct: 0.70, color: "#C7D2FE" },
  { nombre: "Estructura",                    pct: 0.18, matPct: 0.65, moPct: 0.35, color: "#1A3A5C" },
  { nombre: "Mampostería y muros",           pct: 0.08, matPct: 0.60, moPct: 0.40, color: "#2563EB" },
  { nombre: "Cubierta",                      pct: 0.07, matPct: 0.70, moPct: 0.30, color: "#1D4ED8" },
  { nombre: "Instalación sanitaria",         pct: 0.07, matPct: 0.65, moPct: 0.35, color: "#3B82F6" },
  { nombre: "Instalación eléctrica",         pct: 0.06, matPct: 0.60, moPct: 0.40, color: "#60A5FA" },
  { nombre: "Revoques y enlucidos",          pct: 0.06, matPct: 0.35, moPct: 0.65, color: "#93C5FD" },
  { nombre: "Revestimientos y pisos",        pct: 0.08, matPct: 0.65, moPct: 0.35, color: "#BFDBFE" },
  { nombre: "Carpintería",                   pct: 0.07, matPct: 0.75, moPct: 0.25, color: "#DBEAFE" },
  { nombre: "Pintura",                       pct: 0.04, matPct: 0.40, moPct: 0.60, color: "#EFF6FF" },
  { nombre: "Instalaciones especiales",      pct: 0.03, matPct: 0.60, moPct: 0.40, color: "#A5B4FC" },
  { nombre: "Imprevistos y gastos generales",pct: 0.05, matPct: 0.50, moPct: 0.50, color: "#CBD5E1" },
  { nombre: "Honorarios profesionales",      pct: 0.08, matPct: 0.00, moPct: 1.00, color: "#94A3B8" },
];

const MAT_FACTOR = CAPITULOS.reduce((acc, c) => acc + c.pct * c.matPct, 0);
const MO_FACTOR  = CAPITULOS.reduce((acc, c) => acc + c.pct * c.moPct, 0);
const MAX_PCT    = Math.max(...CAPITULOS.map((c) => c.pct));
const PALETA_COLORES = CAPITULOS.map((c) => c.color);

const TCU = 42.5;
const MAX_FOTOS = 5;

/* ─── Tipos para la estimación detallada ─────────────────── */
interface CapituloIA {
  nombre: string;
  monto: number;
  materiales: number;
  manoObra: number;
}

interface ResultadoIA {
  totalGeneral: number;
  totalMateriales: number;
  totalManoObra: number;
  capitulos: CapituloIA[];
  advertencia: string;
}

interface FotoSeleccionada {
  file: File;
  preview: string;
}

/* ─── Convierte un File a base64 (sin el prefijo data:...) ── */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function CalcularPage() {
  const router = useRouter();
  const [tipo, setTipo]       = useState("vivienda");
  const [calidad, setCalidad] = useState("estandar");
  const areaRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const [zona, setZona]       = useState("montevideo");
  const [area, setArea]       = useState<string>("");
  const [unidades, setUnidades] = useState<string>("1");
  const [descripcion, setDescripcion] = useState<string>("");
  const [moneda, setMoneda]   = useState<"USD" | "UYU">("USD");
  const [mostrarDetalle, setMostrarDetalle] = useState(false);

  const [calculandoIA, setCalculandoIA] = useState(false);
  const [resultadoIA, setResultadoIA]   = useState<ResultadoIA | null>(null);
  const [errorIA, setErrorIA]           = useState<string | null>(null);
  const [mostrarCalculadora, setMostrarCalculadora] = useState(false);

  const [fotos, setFotos] = useState<FotoSeleccionada[]>([]);
  const fotosInputRef = useRef<HTMLInputElement>(null);
  const [iniciandoProyecto, setIniciandoProyecto] = useState(false);

  const esDescriptivo = tipo === "reparaciones" || tipo === "reforma";
  const esPH          = tipo === "ph";

  const areaNum     = parseFloat(area) || 0;
  const unidadesNum = parseFloat(unidades) || 0;
  const areaTotal   = esPH ? areaNum * unidadesNum : areaNum;

  // Limpiar la estimación detallada si cambian los datos de entrada
  useEffect(() => {
    setResultadoIA(null);
    setErrorIA(null);
  }, [descripcion, tipo, zona, calidad, moneda]);

  const resultado = useMemo(() => {
    if (esDescriptivo) return null;
    if (areaTotal <= 0) return null;
    const precioBase = PRECIOS_BASE[tipo]?.[calidad] ?? 600;
    const mult       = ZONA_MULT[zona] ?? 1;
    const totalUSD   = areaTotal * precioBase * mult;
    const totalUYU   = totalUSD * TCU;
    const total      = moneda === "USD" ? totalUSD : totalUYU;
    const totalMateriales = total * MAT_FACTOR;
    const totalManoObra   = total * MO_FACTOR;
    return { totalUSD, totalUYU, total, precioM2: precioBase * mult, totalMateriales, totalManoObra };
  }, [esDescriptivo, areaTotal, tipo, calidad, zona, moneda]);

  const fmt = (v: number) =>
    moneda === "USD"
      ? `U$S ${Math.round(v).toLocaleString("es-UY")}`
      : `$ ${Math.round(v).toLocaleString("es-UY")}`;

  // Datos unificados de desglose, ya sea del cálculo estándar o de la estimación detallada
  const desglose = useMemo(() => {
    if (resultado) {
      return {
        total: resultado.total,
        totalMateriales: resultado.totalMateriales,
        totalManoObra: resultado.totalManoObra,
        capitulos: CAPITULOS.map((c) => ({
          nombre: c.nombre,
          monto: resultado.total * c.pct,
          materiales: resultado.total * c.pct * c.matPct,
          manoObra: resultado.total * c.pct * c.moPct,
          color: c.color,
        })),
      };
    }
    if (resultadoIA) {
      return {
        total: resultadoIA.totalGeneral,
        totalMateriales: resultadoIA.totalMateriales,
        totalManoObra: resultadoIA.totalManoObra,
        capitulos: resultadoIA.capitulos.map((c, i) => ({
          nombre: c.nombre,
          monto: c.monto,
          materiales: c.materiales,
          manoObra: c.manoObra,
          color: PALETA_COLORES[i % PALETA_COLORES.length],
        })),
      };
    }
    return null;
  }, [resultado, resultadoIA]);

  const agregarFotos = (files: FileList | null) => {
    if (!files) return;
    const nuevas = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, MAX_FOTOS - fotos.length)
      .map((file) => ({ file, preview: URL.createObjectURL(file) }));
    if (nuevas.length > 0) setFotos((prev) => [...prev, ...nuevas]);
  };

  const quitarFoto = (index: number) => {
    setFotos((prev) => {
      const copia = [...prev];
      URL.revokeObjectURL(copia[index].preview);
      copia.splice(index, 1);
      return copia;
    });
  };

  const calcularEstimacion = async () => {
    if (!descripcion.trim() || calculandoIA) return;
    setCalculandoIA(true);
    setErrorIA(null);
    try {
      const fotosBase64 = await Promise.all(
        fotos.map(async (f) => ({
          mediaType: f.file.type,
          data: await fileToBase64(f.file),
        }))
      );
      const res = await fetch("/api/calcular-rapido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descripcion, tipo, zona, calidad, moneda, fotos: fotosBase64 }),
      });
      if (!res.ok) throw new Error("error");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResultadoIA(data);
    } catch {
      setErrorIA("No pudimos calcular la estimación. Probá de nuevo.");
    } finally {
      setCalculandoIA(false);
    }
  };

  return (
    <div className="min-h-full flex flex-col" style={{ background: "#F0F4F8" }}>
      <Header />

      <div className="max-w-6xl mx-auto w-full px-6 py-10 flex-1">
        {/* Encabezado */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-8"
        >
          <h1 className="text-xl font-bold text-[#1A3A5C] mb-1">
            Cálculo Rápido
          </h1>
          <p className="text-sm text-slate-400">
            Valores orientativos basados en promedios del mercado uruguayo (2025)
          </p>
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
            <div className="bg-white rounded-[14px] border border-slate-300 p-5 shadow-sm">
              <label className="block text-sm font-semibold text-text-primary mb-3">
                Tipo de obra
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {TIPOS_OBRA.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setTipo(t.id);
                      setTimeout(() => {
                        if (t.id === "reparaciones" || t.id === "reforma") {
                          descRef.current?.focus();
                        } else {
                          areaRef.current?.focus();
                        }
                      }, 50);
                    }}
                    className={cn(
                      "px-3.5 py-2.5 rounded-[10px] border text-sm font-medium transition-all text-center",
                      tipo === t.id
                        ? "border-[#2563EB] bg-blue-50 text-[#2563EB]"
                        : "border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-800"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Área / Descripción */}
            {esDescriptivo ? (
              <div className="bg-white rounded-[14px] border border-slate-300 p-5 shadow-sm">
                <label className="block text-sm font-semibold text-text-primary mb-3">
                  Descripción de los trabajos
                </label>
                <textarea
                  ref={descRef}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  rows={4}
                  placeholder="ej: sustitución de 3 aberturas de aluminio, pintura interior de 2 ambientes, reparación de cañería sanitaria..."
                  className="w-full px-4 py-3 rounded-[10px] border border-slate-300 bg-bg-base text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all resize-none"
                />
                <p className="text-xs text-slate-400 mt-2">
                  Describí los trabajos con el mayor detalle posible. Cuanto más precisa sea la descripción, más exacta será la estimación.
                </p>

                {/* Fotos */}
                <input
                  ref={fotosInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    agregarFotos(e.target.files);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => fotosInputRef.current?.click()}
                  disabled={fotos.length >= MAX_FOTOS}
                  className={cn(
                    "mt-3 flex items-center gap-1.5 text-xs font-medium transition-colors",
                    fotos.length >= MAX_FOTOS
                      ? "text-slate-300 cursor-not-allowed"
                      : "text-slate-400 hover:text-[#2563EB]"
                  )}
                >
                  <Camera className="w-3.5 h-3.5" />
                  Agregar fotos
                  {fotos.length > 0 && (
                    <span className="text-slate-300">({fotos.length}/{MAX_FOTOS})</span>
                  )}
                </button>

                {fotos.length > 0 && (
                  <div className="mt-3 grid grid-cols-5 gap-2">
                    {fotos.map((foto, i) => (
                      <div key={foto.preview} className="relative aspect-square rounded-[8px] overflow-hidden border border-slate-200 group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={foto.preview} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => quitarFoto(i)}
                          className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                          aria-label="Quitar foto"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={calcularEstimacion}
                  disabled={!descripcion.trim() || calculandoIA}
                  className={cn(
                    "mt-4 flex items-center justify-center gap-2 w-full py-3 rounded-[12px] font-semibold text-sm transition-colors",
                    !descripcion.trim() || calculandoIA
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                      : "bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
                  )}
                  style={
                    descripcion.trim() && !calculandoIA
                      ? { boxShadow: "0 4px 12px 0 rgb(37 99 235 / 0.3)" }
                      : undefined
                  }
                >
                  {calculandoIA ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analizando...
                    </>
                  ) : (
                    <>
                      <Calculator className="w-4 h-4" />
                      Calcular estimación
                    </>
                  )}
                </button>

                {errorIA && (
                  <p className="text-xs text-red-500 mt-2">{errorIA}</p>
                )}
              </div>
            ) : esPH ? (
              <div className="bg-white rounded-[14px] border border-slate-300 p-5 shadow-sm space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-3">
                    Área por unidad (m²)
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="relative w-[180px] flex-shrink-0">
                      <input
                        ref={areaRef}
                        type="number"
                        value={area}
                        onChange={(e) => setArea(e.target.value)}
                        min={1}
                        step={0.5}
                        max={99999}
                        placeholder="ej: 65"
                        className="w-full px-4 py-3 rounded-[10px] border border-slate-300 bg-bg-base text-lg font-bold text-text-primary placeholder:text-text-muted focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all text-center pr-12"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-text-muted font-medium">
                        m²
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">
                        Superficie de cada unidad
                      </p>
                      <p className="text-xs mt-0.5 font-medium" style={{ color: "#2563EB" }}>
                        Referencia: ~U$S {(PRECIOS_BASE[tipo]?.[calidad] ?? 0).toLocaleString("es-UY")}/m²
                      </p>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-3">
                    Cantidad de unidades
                  </label>
                  <div className="relative w-[180px]">
                    <input
                      type="number"
                      value={unidades}
                      onChange={(e) => setUnidades(e.target.value)}
                      min={1}
                      step={1}
                      max={999}
                      placeholder="ej: 8"
                      className="w-full px-4 py-3 rounded-[10px] border border-slate-300 bg-bg-base text-lg font-bold text-text-primary placeholder:text-text-muted focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all text-center"
                    />
                  </div>
                  {areaTotal > 0 && (
                    <p className="text-xs text-slate-400 mt-2">
                      Área total: {areaTotal.toLocaleString("es-UY")} m²
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-[14px] border border-slate-300 p-5 shadow-sm">
                <label className="block text-sm font-semibold text-text-primary mb-3">
                  Área a construir
                </label>
                <div className="flex items-center gap-4">
                  <div className="relative w-[180px] flex-shrink-0">
                    <input
                      ref={areaRef}
                      type="number"
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      min={1}
                      step={0.5}
                      max={99999}
                      placeholder="ej: 120"
                      className="w-full px-4 py-3 rounded-[10px] border border-slate-300 bg-bg-base text-lg font-bold text-text-primary placeholder:text-text-muted focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all text-center pr-12"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-text-muted font-medium">
                      m²
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">
                      Superficie total a construir o intervenir
                    </p>
                    {tipo && (
                      <p className="text-xs mt-0.5 font-medium" style={{ color: "#2563EB" }}>
                        Referencia: ~U$S {(PRECIOS_BASE[tipo]?.[calidad] ?? 0).toLocaleString("es-UY")}/m²
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Calidad */}
            <div className="bg-white rounded-[14px] border border-slate-300 p-5 shadow-sm">
              <label className="block text-sm font-semibold text-text-primary mb-3">
                Nivel de terminación
              </label>
              <div className="grid grid-cols-3 gap-2">
                {CALIDADES.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCalidad(c.id)}
                    className={cn(
                      "py-3 rounded-[10px] border text-sm font-semibold transition-all text-center",
                      calidad === c.id
                        ? "border-[#2563EB] bg-blue-50 text-[#2563EB]"
                        : "border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-800"
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Zona y moneda — una sola tarjeta */}
            <div className="bg-white rounded-[14px] border border-slate-300 p-5 shadow-sm">
              <div className="grid grid-cols-2 gap-6">
                <div>
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
                            ? "bg-blue-50 text-[#2563EB] font-semibold"
                            : "text-slate-500 hover:bg-slate-50"
                        )}
                      >
                        <span className={cn(
                          "w-2 h-2 rounded-full flex-shrink-0",
                          zona === z.id ? "bg-[#2563EB]" : "bg-slate-300"
                        )} />
                        {z.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
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
                            ? "border-[#2563EB] bg-blue-50 text-[#2563EB]"
                            : "border-slate-300 text-slate-600 hover:border-slate-400"
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
              className="bg-[#1A3A5C] rounded-[16px] p-6 relative overflow-hidden"
              style={{ boxShadow: "0 8px 32px 0 rgb(26 58 92 / 0.25)" }}
            >
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
                        {areaTotal.toLocaleString("es-UY")} m² · ~{moneda === "USD"
                          ? `U$S ${Math.round(resultado.precioM2).toLocaleString("es-UY")}`
                          : `$ ${Math.round(resultado.precioM2 * TCU).toLocaleString("es-UY")}`}/m²
                      </p>
                      {moneda === "USD" && (
                        <p className="text-xs text-white/35 mt-1">
                          ≈ $ {Math.round(resultado.totalUYU).toLocaleString("es-UY")} UYU
                        </p>
                      )}
                      <p className="text-[11px] text-white/30 mt-2 leading-relaxed">
                        * Sin IVA incluido
                        <br />
                        * Sin aportes BPS / Leyes Sociales
                      </p>
                    </motion.div>
                  ) : resultadoIA ? (
                    <motion.div
                      key="resultado-ia"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="text-3xl font-bold text-white mb-1">
                        {fmt(resultadoIA.totalGeneral)}
                      </div>
                      <p className="text-sm text-white/50">
                        Estimación detallada según descripción
                      </p>
                      <p className="text-[11px] text-white/30 mt-2 leading-relaxed">
                        {resultadoIA.advertencia}
                      </p>
                    </motion.div>
                  ) : esDescriptivo ? (
                    <motion.div
                      key="descriptivo"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <div className="text-xl font-bold text-white/70 mb-1">
                        {calculandoIA ? "Analizando..." : "Estimación detallada"}
                      </div>
                      <p className="text-sm text-white/40">
                        {calculandoIA
                          ? "Estamos preparando tu estimación, esto puede tardar unos segundos."
                          : "Describí los trabajos con el mayor detalle posible. Cuanto más precisa sea la descripción, más exacta será la estimación."}
                      </p>
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
            {desglose && (
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
                  {desglose.capitulos.map((c) => (
                    <div
                      key={c.nombre}
                      style={{ width: `${(c.monto / desglose.total) * 100}%`, background: c.color }}
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
                        {desglose.capitulos.map((c) => {
                          const fraccion = c.monto / desglose.total;
                          return (
                            <div key={c.nombre} className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                                  style={{ background: c.color, border: "1px solid #e2e8f0" }}
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
                                      width: `${(fraccion / MAX_PCT) * 100}%`,
                                      background: c.color,
                                      maxWidth: "100%",
                                    }}
                                  />
                                </div>
                                <span className="text-sm font-semibold text-text-primary tabular-nums w-24 text-right">
                                  {fmt(c.monto)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Totales materiales / mano de obra */}
                      <div className="mt-4 pt-4 border-t border-border space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-text-secondary">Total materiales</span>
                          <span className="text-sm font-semibold text-text-primary tabular-nums">
                            {fmt(desglose.totalMateriales)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-text-secondary">Total mano de obra</span>
                          <span className="text-sm font-semibold text-text-primary tabular-nums">
                            {fmt(desglose.totalManoObra)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-border">
                          <span className="text-sm font-bold text-text-primary">Total general</span>
                          <span className="text-sm font-bold text-text-primary tabular-nums">
                            {fmt(desglose.total)}
                          </span>
                        </div>
                        <p className="text-[11px] text-text-muted leading-relaxed pt-1">
                          * Valores estimativos sin IVA ni aportes sociales (BPS).
                          <br />
                          * Para mayor exactitud desarrollá un proyecto completo.
                        </p>
                      </div>

                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* Acciones */}
            {(resultado || resultadoIA || (esDescriptivo && descripcion.trim().length > 0)) && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="space-y-2.5"
              >
                <button
                  type="button"
                  onClick={() => setMostrarCalculadora((v) => !v)}
                  className="relative flex items-center justify-center gap-2 w-full py-3 rounded-[12px] border border-border text-text-secondary hover:text-text-primary hover:border-slate-300 font-medium text-sm transition-colors bg-bg-card"
                >
                  <Calculator className="w-4 h-4" />
                  Calculadora rápida
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 absolute right-4 transition-transform",
                      mostrarCalculadora && "rotate-180"
                    )}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {mostrarCalculadora && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="rounded-[12px] border border-border bg-bg-card p-3">
                        <CalculadoraInline />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  type="button"
                  disabled={iniciandoProyecto}
                  onClick={async () => {
                    if (iniciandoProyecto) return;
                    setIniciandoProyecto(true);
                    try {
                      const href = esDescriptivo
                        ? `/proyectos/nuevo?tipo=${tipo}&descripcion=${encodeURIComponent(descripcion)}&calidad=${calidad}`
                        : esPH
                        ? `/proyectos/nuevo?tipo=${tipo}&area=${areaNum}&unidades=${unidadesNum}&calidad=${calidad}`
                        : `/proyectos/nuevo?tipo=${tipo}&area=${areaNum}&calidad=${calidad}`;

                      sessionStorage.setItem("calculoRapido_descripcion", descripcion);

                      const fotosBase64 = await Promise.all(
                        fotos.map(async (f) => ({
                          mediaType: f.file.type,
                          data: await fileToBase64(f.file),
                        }))
                      );
                      sessionStorage.setItem("calculoRapido_fotos", JSON.stringify(fotosBase64));

                      router.push(href);
                    } catch (err) {
                      console.error("[calcular] iniciar proyecto completo", err);
                      setIniciandoProyecto(false);
                    }
                  }}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-[12px] bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-white font-semibold text-sm transition-colors"
                  style={{ boxShadow: "0 4px 12px 0 rgb(37 99 235 / 0.3)" }}
                >
                  {iniciandoProyecto ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FolderPlus className="w-4 h-4" />
                  )}
                  Iniciar proyecto completo
                </button>

                <button className="flex items-center justify-center gap-2 w-full py-3 rounded-[12px] border border-border text-text-secondary hover:text-text-primary hover:border-slate-300 font-medium text-sm transition-colors bg-bg-card">
                  <Download className="w-4 h-4" />
                  Exportar estimación en PDF
                </button>

                <button
                  onClick={() => {
                    setTipo("vivienda");
                    setCalidad("estandar");
                    setZona("montevideo");
                    setArea("");
                    setUnidades("1");
                    setDescripcion("");
                    setMoneda("USD");
                    setResultadoIA(null);
                    setErrorIA(null);
                    fotos.forEach((f) => URL.revokeObjectURL(f.preview));
                    setFotos([]);
                  }}
                  className="flex items-center justify-center gap-2 w-full py-2 text-text-muted hover:text-text-secondary text-sm transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reiniciar
                </button>
              </motion.div>
            )}

          </motion.div>
        </div>
      </div>
    </div>
  );
}

/* ─── Calculadora rápida inline ──────────────────────────── */
function CalculadoraInline() {
  const [display, setDisplay] = useState("0");
  const [operacion, setOperacion] = useState("");
  const [valorPrevio, setValorPrevio] = useState("");
  const [esperandoOperando, setEsperandoOperando] = useState(false);

  const presionarNumero = (num: string) => {
    if (esperandoOperando) {
      setDisplay(num);
      setEsperandoOperando(false);
    } else {
      setDisplay(display === "0" ? num : display + num);
    }
  };

  const presionarOperacion = (op: string) => {
    setValorPrevio(display);
    setOperacion(op);
    setEsperandoOperando(true);
  };

  const calcular = () => {
    const prev = parseFloat(valorPrevio);
    const curr = parseFloat(display);
    let resultado = 0;
    if (operacion === "+") resultado = prev + curr;
    if (operacion === "-") resultado = prev - curr;
    if (operacion === "×") resultado = prev * curr;
    if (operacion === "÷") resultado = curr !== 0 ? prev / curr : 0;
    setDisplay(resultado % 1 === 0 ? resultado.toString() : resultado.toFixed(2));
    setOperacion("");
    setEsperandoOperando(true);
  };

  const limpiar = () => {
    setDisplay("0");
    setOperacion("");
    setValorPrevio("");
    setEsperandoOperando(false);
  };

  const btnCls = "h-9 rounded-lg text-sm font-medium transition-colors";

  return (
    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
      <div className="bg-white rounded-lg px-3 py-2 text-right text-lg font-mono font-semibold text-[#1A3A5C] mb-2 border border-slate-200 min-h-[40px]">
        {parseFloat(display).toLocaleString("es-UY")}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        <button onClick={limpiar} className={`${btnCls} col-span-2 bg-red-50 text-red-600 hover:bg-red-100`}>C</button>
        <button onClick={() => presionarOperacion("÷")} className={`${btnCls} bg-blue-50 text-[#2563EB] hover:bg-blue-100`}>÷</button>
        <button onClick={() => presionarOperacion("×")} className={`${btnCls} bg-blue-50 text-[#2563EB] hover:bg-blue-100`}>×</button>

        {["7", "8", "9"].map((n) => (
          <button key={n} onClick={() => presionarNumero(n)} className={`${btnCls} bg-white border border-slate-200 text-[#1E293B] hover:bg-slate-100`}>{n}</button>
        ))}
        <button onClick={() => presionarOperacion("-")} className={`${btnCls} bg-blue-50 text-[#2563EB] hover:bg-blue-100`}>−</button>

        {["4", "5", "6"].map((n) => (
          <button key={n} onClick={() => presionarNumero(n)} className={`${btnCls} bg-white border border-slate-200 text-[#1E293B] hover:bg-slate-100`}>{n}</button>
        ))}
        <button onClick={() => presionarOperacion("+")} className={`${btnCls} bg-blue-50 text-[#2563EB] hover:bg-blue-100`}>+</button>

        {["1", "2", "3"].map((n) => (
          <button key={n} onClick={() => presionarNumero(n)} className={`${btnCls} bg-white border border-slate-200 text-[#1E293B] hover:bg-slate-100`}>{n}</button>
        ))}
        <button onClick={calcular} className={`${btnCls} row-span-2 bg-[#2563EB] text-white hover:bg-blue-700`}>=</button>

        <button onClick={() => presionarNumero("0")} className={`${btnCls} col-span-2 bg-white border border-slate-200 text-[#1E293B] hover:bg-slate-100`}>0</button>
        <button onClick={() => presionarNumero(".")} className={`${btnCls} bg-white border border-slate-200 text-[#1E293B] hover:bg-slate-100`}>.</button>
      </div>
    </div>
  );
}
