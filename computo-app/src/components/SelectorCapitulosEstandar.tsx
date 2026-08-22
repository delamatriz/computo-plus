"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { List, Plus, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Extraído de proyectos/nuevo/page.tsx (paso 3 "Capítulos de la obra") para
// reusarlo también al agregar capítulos dentro de un Título ya existente en
// un proyecto real (ver "+ Agregar capítulo" por título en
// proyectos/[id]/page.tsx). Mismo comportamiento, ahora controlado por
// props en vez de vivir atado al estado `form` del asistente — el asistente
// sigue siendo la fuente de verdad de su propia lista (onConfirmar ahí
// escribe directo en form.capitulos), y el modal del proyecto real
// acumula localmente hasta que el usuario confirma.

export interface CapituloSeleccionable {
  id: string;
  nombre: string;
  color: string;
  activo: boolean;
}

interface CapituloEstandarItem {
  id: string;
  nombre: string;
  orden: number;
  origen: string;
  vecesUsado: number;
}

interface FotoParaIA {
  file?: File;
  base64?: string;
  mediaType: string;
}

// Colores de referencia para los 20 capítulos de la biblioteca estándar
// + nombres históricos sugeridos por la IA (para mantener consistencia
// visual) — exportados porque proyectos/nuevo/page.tsx los sigue
// necesitando para su propio cargarSugeridos() (precarga automática de la
// lista completa al pasar de paso 1 a paso 2, antes de que este componente
// exista en pantalla).
export const COLORES_CAPITULOS: Record<string, string> = {
  "Implantación y Replanteo":                 "#94A3B8",
  "Excavaciones y Movimiento de Tierra":       "#78716C",
  "Demoliciones y Picados":                    "#DC2626",
  "Cimentaciones":                             "#1D4ED8",
  "Estructura de Hormigón Armado":             "#2563EB",
  "Albañilería":                               "#3B82F6",
  "Pisos, Zócalos y Revestimientos":           "#8B5CF6",
  "Impermeabilizaciones y Aislaciones":        "#0EA5E9",
  "Cubierta / Techos":                         "#0284C7",
  "Instalación Sanitaria":                     "#10B981",
  "Instalación Eléctrica":                     "#F59E0B",
  "Instalación Térmica / Aire Acondicionado":  "#06B6D4",
  "Carpintería":                               "#EC4899",
  "Vidrios y Espejos":                         "#22D3EE",
  "Yeso y Cielorrasos":                        "#A78BFA",
  "Pinturas":                                  "#14B8A6",
  "Equipamiento":                              "#F97316",
  "Sistemas Constructivos No Tradicionales":   "#6366F1",
  "Obra Exterior / Jardín":                    "#22C55E",
  "Imprevistos":                               "#64748B",
  // Nombres históricos (sugerencias de IA por tipo de obra)
  "Trabajos preliminares":              "#94A3B8",
  "Movimiento de tierra y fundaciones": "#78716C",
  "Estructura":                         "#2563EB",
  "Mampostería y muros":                "#3B82F6",
  "Cubierta":                           "#1D4ED8",
  "Revoques y enlucidos":               "#60A5FA",
  "Revestimientos y pisos":             "#8B5CF6",
  "Instalación sanitaria":              "#10B981",
  "Instalación eléctrica":              "#F59E0B",
  "Instalación de gas":                 "#F97316",
  "Instalaciones embutidas":            "#A78BFA",
  "Calefacción":                        "#EF4444",
  "Pintura":                            "#06B6D4",
  "Vidriería":                          "#22D3EE",
  "Herrería y metálica":                "#6B7280",
  "Obras exteriores y paisajismo":      "#22C55E",
  "Honorarios profesionales":           "#1A3A5C",
};

export const COLORS = [
  "#2563EB", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#06B6D4", "#22C55E", "#78716C", "#64748B",
];

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

interface Props {
  capitulos: CapituloSeleccionable[];
  // Se llama con la lista completa actualizada en cada cambio (agregar,
  // sacar, renombrar, activar/desactivar) — no es un botón de "confirmar"
  // dentro del componente, el host decide cuándo persistir (el asistente
  // escribe directo a su form; un modal en un proyecto real acumula local
  // y persiste recién con su propio botón "Agregar").
  onConfirmar: (capitulos: CapituloSeleccionable[]) => void;
  tipoObra: string;
  descripcionTrabajos: string;
  fotos?: FotoParaIA[];
  // Nombres ya presentes en otro lado (ej. otros títulos del mismo
  // proyecto) que no deberían ofrecerse de nuevo en "Lista estándar",
  // además de los que ya están en `capitulos`.
  nombresExcluidos?: string[];
}

export function SelectorCapitulosEstandar({
  capitulos,
  onConfirmar,
  tipoObra,
  descripcionTrabajos,
  fotos = [],
  nombresExcluidos = [],
}: Props) {
  const [cargandoIA, setCargandoIA] = useState(false);
  const [errorIA, setErrorIA] = useState<string | null>(null);
  const [capitulosEstandar, setCapitulosEstandar] = useState<CapituloEstandarItem[]>([]);
  // "Lista estándar" es la opción primaria — abierta por defecto, mismo
  // criterio en el wizard y en el modal de "Agregar capítulo" por título.
  // "Sugerir con IA" es secundaria: dispara la generación al toque (no
  // tiene un panel propio que mostrar), y de paso cierra la biblioteca
  // para no competirle atención mientras corre / mientras se ven los
  // resultados recién agregados abajo.
  const [mostrarBiblioteca, setMostrarBiblioteca] = useState(true);

  useEffect(() => {
    fetch("/api/capitulos-estandar")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCapitulosEstandar(data);
      })
      .catch(() => {});
  }, []);

  const cargarSugeridosIA = async () => {
    if (!descripcionTrabajos.trim()) {
      setErrorIA("Completá la descripción de trabajos para usar esta función");
      return;
    }
    setErrorIA(null);
    setMostrarBiblioteca(false);
    setCargandoIA(true);
    try {
      const fotosBase64 = await Promise.all(
        fotos.map(async (f) => ({
          mediaType: f.mediaType,
          data: f.base64 ?? (f.file ? await fileToBase64(f.file) : ""),
        }))
      );

      const res = await fetch("/api/sugerir-capitulos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: tipoObra,
          descripcion: descripcionTrabajos,
          fotos: fotosBase64.filter((f) => f.data),
        }),
      });
      const data = await res.json();
      if (data.error === "sin_descripcion") {
        setErrorIA("Completá la descripción de trabajos para usar esta función");
        return;
      }
      if (!data.capitulos?.length) throw new Error("Sin capítulos");
      onConfirmar(data.capitulos.map((nombre: string, i: number) => ({
        id: String(Date.now() + i),
        nombre,
        color: COLORES_CAPITULOS[nombre] ?? COLORS[i % COLORS.length],
        activo: true,
      })));
    } catch {
      setErrorIA("No se pudo conectar con la IA. Intentá de nuevo.");
    } finally {
      setCargandoIA(false);
    }
  };

  // Agrega o quita un capítulo de la biblioteca a la selección actual
  const toggleDesdeBiblioteca = (item: CapituloEstandarItem) => {
    const existente = capitulos.find(
      (c) => c.nombre.trim().toLowerCase() === item.nombre.toLowerCase()
    );
    if (existente) {
      onConfirmar(capitulos.filter((c) => c.id !== existente.id));
    } else {
      const color = COLORES_CAPITULOS[item.nombre] ?? COLORS[capitulos.length % COLORS.length];
      onConfirmar([
        ...capitulos,
        { id: `bib-${item.id}-${Date.now()}`, nombre: item.nombre, color, activo: true },
      ]);
    }
  };

  // Si el usuario escribe un capítulo nuevo (no está en la biblioteca), lo registra
  const registrarCapituloManual = async (nombre: string) => {
    const limpio = nombre.trim();
    if (!limpio) return;
    const yaExiste = capitulosEstandar.some((c) => c.nombre.toLowerCase() === limpio.toLowerCase());
    if (yaExiste) return;
    try {
      const res = await fetch("/api/capitulos-estandar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: limpio }),
      });
      if (!res.ok) return;
      const nuevo = await res.json();
      setCapitulosEstandar((prev) => [
        ...prev.filter((c) => c.nombre.toLowerCase() !== limpio.toLowerCase()),
        nuevo,
      ]);
    } catch {
      // Silencioso: si falla el registro, no bloquea la selección
    }
  };

  const toggleCapitulo = (id: string) => {
    onConfirmar(capitulos.map((c) => c.id === id ? { ...c, activo: !c.activo } : c));
  };

  const agregarCapitulo = () => {
    const color = COLORS[capitulos.length % COLORS.length];
    onConfirmar([...capitulos, { id: String(Date.now()), nombre: "", color, activo: true }]);
  };

  const renombrarCapitulo = (id: string, nombre: string) => {
    onConfirmar(capitulos.map((c) => c.id === id ? { ...c, nombre } : c));
  };

  const eliminarCapitulo = (id: string) => {
    onConfirmar(capitulos.filter((c) => c.id !== id));
  };

  const capitularActivos = capitulos.filter((c) => c.activo && c.nombre.trim());

  return (
    <div className="bg-white rounded-[16px] border border-slate-300 p-5 shadow-sm">
      {/* Selector de modo — "Lista estándar" es la opción primaria
          (siempre a la izquierda, abierta por defecto); "Sugerir con IA"
          es secundaria y dispara la generación al toque. Segmented
          control real (no dos links de texto al mismo nivel) para que se
          lea como una elección clara entre dos modos, no como metadata. */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-1 p-1 rounded-[10px] bg-slate-100 flex-1 max-w-sm">
          <button
            onClick={() => setMostrarBiblioteca(true)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-[8px] text-sm font-semibold transition-all",
              mostrarBiblioteca
                ? "bg-white text-[#2563EB] shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <List className="w-3.5 h-3.5" />
            Lista estándar
          </button>
          <button
            onClick={cargarSugeridosIA}
            disabled={cargandoIA}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-[8px] text-sm font-semibold transition-all disabled:cursor-wait",
              !mostrarBiblioteca
                ? "bg-white text-[#2563EB] shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            {cargandoIA ? (
              <span className="w-3.5 h-3.5 border-2 border-[#2563EB]/30 border-t-[#2563EB] rounded-full animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {cargandoIA ? "Analizando..." : "Sugerir con IA"}
          </button>
        </div>
        {capitulos.length > 0 && (
          <p className="text-xs text-slate-400 whitespace-nowrap">
            {capitularActivos.length} activo{capitularActivos.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {errorIA && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-[8px] px-3 py-2 mb-3">
          {errorIA}
        </p>
      )}

      <AnimatePresence initial={false}>
        {mostrarBiblioteca && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-3 mb-3 rounded-[10px] border border-slate-200">
              {capitulosEstandar.length === 0 ? (
                <p className="text-xs text-slate-400">Cargando biblioteca de capítulos...</p>
              ) : (
                (() => {
                  const excluidos = new Set(nombresExcluidos.map((n) => n.toLowerCase()));
                  const disponibles = capitulosEstandar.filter(
                    (item) =>
                      !capitulos.some(
                        (c) => c.nombre.trim().toLowerCase() === item.nombre.toLowerCase()
                      ) && !excluidos.has(item.nombre.toLowerCase())
                  );
                  if (disponibles.length === 0) {
                    return (
                      <p className="text-xs text-slate-400">
                        Ya agregaste todos los capítulos de la biblioteca.
                      </p>
                    );
                  }
                  // Lista ordenada (no chips en flujo libre) — refleja la
                  // secuencia real de obra ya presente en el orden que
                  // manda la API (implantación → movimiento de tierra →
                  // cimentaciones → estructura → ... → imprevistos).
                  // Grilla de 2 columnas, lectura por filas de arriba
                  // hacia abajo (orden natural del grid en el DOM).
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                      {disponibles.map((item, i) => (
                        <button
                          key={item.id}
                          onClick={() => toggleDesdeBiblioteca(item)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-[10px] border border-slate-200 bg-white hover:border-[#2563EB] hover:bg-blue-50/60 text-left transition-all group"
                        >
                          <span className="text-xs font-bold tabular-nums text-slate-400 group-hover:text-[#2563EB] w-5 flex-shrink-0 transition-colors">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span className="flex-1 min-w-0 text-sm font-medium text-slate-700 group-hover:text-[#1A3A5C] truncate transition-colors">
                            {item.nombre}
                          </span>
                          <Plus className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#2563EB] flex-shrink-0 transition-colors" />
                        </button>
                      ))}
                    </div>
                  );
                })()
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {capitulos.length === 0 && !mostrarBiblioteca ? (
        <div className="text-center py-8">
          <p className="text-sm text-slate-400">
            Usá &quot;Lista estándar&quot; para elegir entre los capítulos típicos de obra,<br />
            o &quot;Sugerir con IA&quot; para generarlos según los trabajos descritos.
          </p>
        </div>
      ) : capitulos.length > 0 ? (
        <div>

          <div className="space-y-1.5 mb-4 max-h-80 overflow-y-auto pr-1">
            {capitulos.map((cap, idx) => (
              <motion.div
                key={cap.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15, delay: idx * 0.03 }}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-[10px] border transition-all",
                  cap.activo ? "border-blue-200 bg-blue-50/50" : "border-slate-100 bg-slate-50/50 opacity-50"
                )}
              >
                <span className="text-xs font-bold tabular-nums w-6 text-right flex-shrink-0" style={{ color: cap.activo ? "#2563EB" : "#94A3B8" }}>
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <input
                  type="text"
                  value={cap.nombre}
                  onChange={(e) => renombrarCapitulo(cap.id, e.target.value)}
                  onBlur={(e) => registrarCapituloManual(e.target.value)}
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
      ) : null}
    </div>
  );
}
