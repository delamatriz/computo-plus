"use client";

import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  ChevronLeft,
  Plus,
  X,
  Sparkles,
  CheckCircle2,
  Camera,
  FileText,
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
  diasLaborales: string;
  descripcion: string;
  capitulos: Capitulo[];
  fotos: FotoProyecto[];
  documentos: File[];
  requierePlanSeguridad: boolean;
  modalidadAltura: string[];
}

interface Capitulo {
  id: string;
  nombre: string;
  color: string;
  activo: boolean;
}

interface FotoProyecto {
  preview: string;
  file?: File;
  base64?: string;
  mediaType: string;
}

const MAX_FOTOS = 10;
const MAX_DOCS = 5;

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

/* ─── Datos de referencia ─────────────────────────────── */
const TIPOS_OBRA = [
  { id: "REPARACIONES", label: "Reparaciones" },
  { id: "REFORMA",      label: "Reforma / Ampliación" },
  { id: "VIVIENDA",     label: "Vivienda unifamiliar" },
  { id: "PH",           label: "Propiedad Horizontal" },
  { id: "COMERCIAL",    label: "Local comercial" },
  { id: "INDUSTRIAL",   label: "Industrial" },
];

interface CapituloEstandarItem {
  id: string;
  nombre: string;
  orden: number;
  origen: string;
  vecesUsado: number;
}

// Colores de referencia para los 20 capítulos de la biblioteca estándar
// + nombres históricos sugeridos por la IA (para mantener consistencia visual)
const COLORES_CAPITULOS: Record<string, string> = {
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

const COLORS = [
  "#2563EB", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#06B6D4", "#22C55E", "#78716C", "#64748B",
];

const MODALIDADES_ALTURA = [
  { id: "andamios", label: "Andamios" },
  { id: "balancin", label: "Balancín" },
  { id: "silleta",  label: "Silleta" },
  { id: "combinacion", label: "Combinación" },
  { id: "grua", label: "Grúa / otra maquinaria" },
];

const STEPS = [
  { id: 1, label: "1. Datos" },
  { id: 2, label: "2. Detalles" },
  { id: 3, label: "3. Capítulos" },
  { id: 4, label: "4. Confirmar" },
];

/* ─── Componente principal ───────────────────────────── */
function NuevoProyectoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modoCompleto = searchParams.get("modo") === "completo";

  const [paso, setPaso] = useState(1);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);
  const [cargandoIA, setCargandoIA] = useState(false);
  const [errorIA, setErrorIA] = useState<string | null>(null);
  const [capitulosEstandar, setCapitulosEstandar] = useState<CapituloEstandarItem[]>([]);
  const [mostrarBiblioteca, setMostrarBiblioteca] = useState(false);

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
    diasLaborales: "",
    descripcion: "",
    capitulos: [],
    fotos: [],
    documentos: [],
    requierePlanSeguridad: false,
    modalidadAltura: [],
  });

  const fotosInputRef = useRef<HTMLInputElement>(null);
  const docsInputRef = useRef<HTMLInputElement>(null);

  const set = useCallback(<K extends keyof FormData>(key: K, val: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  }, []);

  /* Traspaso desde Cálculo rápido (sessionStorage) */
  useEffect(() => {
    const descripcion = sessionStorage.getItem("calculoRapido_descripcion");
    if (descripcion) {
      set("trabajos", descripcion);
      sessionStorage.removeItem("calculoRapido_descripcion");
    }

    const fotosRaw = sessionStorage.getItem("calculoRapido_fotos");
    if (fotosRaw) {
      try {
        const fotosGuardadas: { mediaType: string; data: string }[] = JSON.parse(fotosRaw);
        const fotos: FotoProyecto[] = fotosGuardadas
          .filter((f) => f.data)
          .map((f) => ({
            preview: `data:${f.mediaType};base64,${f.data}`,
            base64: f.data,
            mediaType: f.mediaType,
          }));
        if (fotos.length > 0) set("fotos", fotos);
      } catch (err) {
        console.error("[proyectos/nuevo] traspaso fotos", err);
      }
      sessionStorage.removeItem("calculoRapido_fotos");
    }
  }, [set]);

  /* Biblioteca de capítulos estándar */
  useEffect(() => {
    fetch("/api/capitulos-estandar")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCapitulosEstandar(data);
      })
      .catch(() => {});
  }, []);

  /* Fotos de relevamiento */
  const agregarFotos = (files: FileList | null) => {
    if (!files) return;
    const nuevas = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, MAX_FOTOS - form.fotos.length)
      .map((file) => ({ file, preview: URL.createObjectURL(file), mediaType: file.type }));
    if (nuevas.length > 0) set("fotos", [...form.fotos, ...nuevas]);
  };

  const quitarFoto = (index: number) => {
    const copia = [...form.fotos];
    const [eliminada] = copia.splice(index, 1);
    if (eliminada?.file) URL.revokeObjectURL(eliminada.preview);
    set("fotos", copia);
  };

  /* Documentos PDF/DWG */
  const agregarDocumentos = (files: FileList | null) => {
    if (!files) return;
    const nuevos = Array.from(files).slice(0, MAX_DOCS - form.documentos.length);
    if (nuevos.length > 0) set("documentos", [...form.documentos, ...nuevos]);
  };

  const quitarDocumento = (index: number) => {
    set("documentos", form.documentos.filter((_, i) => i !== index));
  };

  const handleTipoChange = (tipo: string) => {
    set("tipo", tipo);
  };

  // Reemplaza los capítulos por la lista estándar completa (20 capítulos base)
  const cargarSugeridos = () => {
    const base = capitulosEstandar.filter((c) => c.origen === "estandar");
    set("capitulos", base.map((c, i) => ({
      id: `est-${c.id}`,
      nombre: c.nombre,
      color: COLORES_CAPITULOS[c.nombre] ?? COLORS[i % COLORS.length],
      activo: true,
    })));
  };

  // Agrega o quita un capítulo de la biblioteca a la selección actual
  const toggleDesdeBiblioteca = (item: CapituloEstandarItem) => {
    const existente = form.capitulos.find(
      (c) => c.nombre.trim().toLowerCase() === item.nombre.toLowerCase()
    );
    if (existente) {
      set("capitulos", form.capitulos.filter((c) => c.id !== existente.id));
    } else {
      const color = COLORES_CAPITULOS[item.nombre] ?? COLORS[form.capitulos.length % COLORS.length];
      set("capitulos", [
        ...form.capitulos,
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
      // Silencioso: si falla el registro, no bloquea la creación del proyecto
    }
  };

  const cargarSugeridosIA = async () => {
    if (!form.trabajos.trim()) {
      setErrorIA("Completá la descripción de trabajos en el paso 1 para usar esta función");
      return;
    }
    setErrorIA(null);
    setCargandoIA(true);
    try {
      const fotosBase64 = await Promise.all(
        form.fotos.map(async (f) => ({
          mediaType: f.mediaType,
          data: f.base64 ?? (f.file ? await fileToBase64(f.file) : ""),
        }))
      );

      const res = await fetch("/api/sugerir-capitulos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: form.tipo,
          descripcion: form.trabajos,
          fotos: fotosBase64.filter((f) => f.data),
        }),
      });
      const data = await res.json();
      if (data.error === "sin_descripcion") {
        setErrorIA("Completá la descripción de trabajos en el paso 1 para usar esta función");
        return;
      }
      if (!data.capitulos?.length) throw new Error("Sin capítulos");
      set("capitulos", data.capitulos.map((nombre: string, i: number) => ({
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

  const toggleModalidadAltura = (id: string) => {
    set(
      "modalidadAltura",
      form.modalidadAltura.includes(id)
        ? form.modalidadAltura.filter((m) => m !== id)
        : [...form.modalidadAltura, id]
    );
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
    setErrorGuardar(null);
    try {
      const res = await fetch("/api/proyectos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre,
          cliente: form.cliente,
          tipo: form.tipo,
          moneda: form.moneda,
          area: form.area,
          descripcion: form.trabajos || form.descripcion,
          direccion: form.direccion,
          fechaInicio: form.fechaInicio,
          plazoObra: form.plazoMeses,
          diasLaborales: form.diasLaborales ? parseInt(form.diasLaborales, 10) : null,
          requierePlanSeguridad: form.requierePlanSeguridad,
          modalidadAltura: form.requierePlanSeguridad && form.modalidadAltura.length > 0
            ? form.modalidadAltura.join(",")
            : null,
          capitulos: capitularActivos.map((c, i) => ({
            nombre: c.nombre,
            color: c.color,
            codigo: String(i + 1).padStart(2, "0"),
            orden: i + 1,
          })),
        }),
      });
      if (!res.ok) throw new Error("No se pudo crear el proyecto");
      const proyecto = await res.json();

      // Si viene del flujo de Cálculo Rápido, usar el desglose de montos
      // por capítulo como contexto para los rubros automáticos por IA.
      const resultadoRaw = sessionStorage.getItem("calculoRapido_resultado");
      let capitulosConMontos: { nombre: string; monto: number }[] | undefined;
      if (resultadoRaw) {
        try {
          capitulosConMontos = JSON.parse(resultadoRaw);
        } catch (err) {
          console.error("[proyectos/nuevo] parseo de calculoRapido_resultado", err);
        }
        sessionStorage.removeItem("calculoRapido_resultado");
      }

      if (capitulosConMontos) {
        await fetch(`/api/proyectos/${proyecto.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ generandoRubros: true }),
        }).catch((err) => console.error("[proyectos/nuevo] generandoRubros:true", err));
      }

      fetch(`/api/proyectos/${proyecto.id}/generar-rubros`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capitulosConMontos }),
      }).catch((err) => console.error("[proyectos/nuevo] generar-rubros", err));

      if (form.requierePlanSeguridad) {
        fetch(`/api/proyectos/${proyecto.id}/generar-seguridad-altura`, {
          method: "POST",
        }).catch((err) => console.error("[proyectos/nuevo] generar-seguridad-altura", err));
      }

      router.push(`/proyectos/${proyecto.id}`);
    } catch {
      setErrorGuardar("No se pudo crear el proyecto. Intentá de nuevo.");
      setGuardando(false);
    }
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

                <Field label="Fotos de relevamiento">
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
                    disabled={form.fotos.length >= MAX_FOTOS}
                    className={cn(
                      "flex items-center gap-1.5 text-xs font-medium transition-colors",
                      form.fotos.length >= MAX_FOTOS
                        ? "text-slate-300 cursor-not-allowed"
                        : "text-slate-400 hover:text-[#2563EB]"
                    )}
                  >
                    <Camera className="w-3.5 h-3.5" />
                    Agregar fotos
                    {form.fotos.length > 0 && (
                      <span className="text-slate-300">({form.fotos.length}/{MAX_FOTOS})</span>
                    )}
                  </button>

                  {form.fotos.length > 0 && (
                    <div className="mt-3 grid grid-cols-3 sm:grid-cols-5 md:grid-cols-10 gap-2">
                      {form.fotos.map((foto, i) => (
                        <div key={`foto-${i}`} className="relative aspect-square rounded-[8px] overflow-hidden border border-slate-200 group">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={foto.preview} alt={`Relevamiento ${i + 1}`} className="w-full h-full object-cover" />
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
                </Field>

                <Field label="Documentos (PDF / DWG)">
                  <input
                    ref={docsInputRef}
                    type="file"
                    accept=".pdf,.dwg,application/pdf"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      agregarDocumentos(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => docsInputRef.current?.click()}
                    disabled={form.documentos.length >= MAX_DOCS}
                    className={cn(
                      "flex items-center gap-1.5 text-xs font-medium transition-colors",
                      form.documentos.length >= MAX_DOCS
                        ? "text-slate-300 cursor-not-allowed"
                        : "text-slate-400 hover:text-[#2563EB]"
                    )}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Agregar documentos
                    {form.documentos.length > 0 && (
                      <span className="text-slate-300">({form.documentos.length}/{MAX_DOCS})</span>
                    )}
                  </button>

                  {form.documentos.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {form.documentos.map((doc, i) => (
                        <li
                          key={`${doc.name}-${i}`}
                          className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-[8px] border border-slate-200 bg-slate-50 text-sm text-slate-600"
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span className="truncate">{doc.name}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => quitarDocumento(i)}
                            className="text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
                            aria-label="Quitar documento"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
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

                <Field label="Plazo de obra (días)">
                  <div className="relative max-w-[160px]">
                    <input
                      type="number"
                      value={form.plazoMeses}
                      onChange={(e) => set("plazoMeses", e.target.value)}
                      placeholder="ej: 240"
                      min={1}
                      className={inputCls}
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">
                      días
                    </span>
                  </div>
                </Field>

                <Field label="Días laborales">
                  <div className="relative max-w-[160px]">
                    <input
                      type="number"
                      value={form.diasLaborales}
                      onChange={(e) => set("diasLaborales", e.target.value)}
                      placeholder="ej: 65"
                      min={1}
                      className={inputCls}
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5">
                    Días hábiles de trabajo (distinto del plazo en días corridos)
                  </p>
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

              <div className="bg-white rounded-[16px] border border-slate-300 p-6 space-y-4 shadow-sm">
                <div>
                  <h3 className="text-sm font-bold text-[#1A3A5C]">Trabajos en altura</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Solo si la obra requiere trabajo sobre nivel de piso</p>
                </div>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.requierePlanSeguridad}
                    onChange={(e) => set("requierePlanSeguridad", e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]/30"
                  />
                  <span className="text-sm text-slate-700">Requiere plan y estudio de seguridad (MTOP)</span>
                </label>

                {form.requierePlanSeguridad && (
                  <Field label="Modalidad de trabajo en altura">
                    <div className="flex flex-wrap gap-2">
                      {MODALIDADES_ALTURA.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => toggleModalidadAltura(m.id)}
                          className={cn(
                            "px-3.5 py-2 rounded-[10px] border text-sm font-medium transition-all",
                            form.modalidadAltura.includes(m.id)
                              ? "border-[#2563EB] bg-blue-50 text-[#2563EB]"
                              : "border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-800"
                          )}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </Field>
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
                {/* Botones de carga + error IA */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {cargandoIA ? (
                      <span className="flex items-center gap-1.5 text-xs text-[#2563EB]">
                        <span className="w-3 h-3 border-2 border-[#2563EB]/30 border-t-[#2563EB] rounded-full animate-spin" />
                        Analizando trabajos...
                      </span>
                    ) : (
                      <button
                        onClick={cargarSugeridosIA}
                        className="flex items-center gap-1.5 text-xs text-[#2563EB] font-medium hover:text-[#1D4ED8] transition-colors"
                      >
                        <Sparkles className="w-3 h-3" />
                        Sugerir con IA
                      </button>
                    )}
                    <span className="text-slate-300 text-xs">·</span>
                    <button
                      onClick={() => setMostrarBiblioteca((p) => !p)}
                      className={cn(
                        "text-xs font-medium transition-colors",
                        mostrarBiblioteca ? "text-[#2563EB]" : "text-slate-400 hover:text-slate-600"
                      )}
                    >
                      Lista estándar
                    </button>
                  </div>
                  {form.capitulos.length > 0 && (
                    <p className="text-xs text-slate-400">
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
                      <div className="p-3 mb-3 rounded-[10px] bg-slate-50 border border-slate-200">
                        {capitulosEstandar.length === 0 ? (
                          <p className="text-xs text-slate-400">Cargando biblioteca de capítulos...</p>
                        ) : (
                          (() => {
                            const disponibles = capitulosEstandar.filter(
                              (item) =>
                                !form.capitulos.some(
                                  (c) => c.nombre.trim().toLowerCase() === item.nombre.toLowerCase()
                                )
                            );
                            if (disponibles.length === 0) {
                              return (
                                <p className="text-xs text-slate-400">
                                  Ya agregaste todos los capítulos de la biblioteca.
                                </p>
                              );
                            }
                            return (
                              <div className="flex flex-wrap gap-1.5">
                                {disponibles.map((item) => (
                                  <button
                                    key={item.id}
                                    onClick={() => toggleDesdeBiblioteca(item)}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium border border-slate-200 bg-white text-slate-600 hover:border-[#2563EB]/40 hover:text-[#2563EB] transition-colors"
                                  >
                                    <Plus className="w-3 h-3" />
                                    {item.nombre}
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

                {form.capitulos.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-slate-400">
                      Usá "Sugerir con IA" para generar capítulos según los trabajos descritos,<br />
                      o "Lista estándar" para elegir entre los capítulos típicos de obra.
                    </p>
                  </div>
                ) : (
                  <div>

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

              {/* Resumen de datos */}
              <div className="bg-white rounded-[16px] border border-slate-300 overflow-hidden shadow-sm">
                <div className="p-5 border-b border-slate-200">
                  <h3 className="font-bold text-[#1A3A5C] text-base">{form.nombre || "Sin nombre"}</h3>
                </div>

                <div className="grid grid-cols-2 divide-x divide-y divide-slate-100">
                  {[
                    { label: "Proyecto",      value: form.nombre || "—" },
                    { label: "Tipo de obra",  value: TIPOS_OBRA.find((t) => t.id === form.tipo)?.label ?? "—" },
                    { label: "Moneda",        value: form.moneda },
                    { label: "Área",          value: form.area ? `${form.area} m²` : "—" },
                    { label: "Dirección",     value: form.direccion || "—" },
                    { label: "Inicio",        value: form.fechaInicio ? new Date(form.fechaInicio).toLocaleDateString("es-UY") : "—" },
                    { label: "Plazo",         value: form.plazoMeses ? `${form.plazoMeses} días` : "—" },
                    { label: "Cliente",       value: form.cliente || "—" },
                  ].map(({ label, value }) => (
                    <div key={label} className="px-5 py-3.5">
                      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
                      <p className="text-sm font-semibold text-[#1A3A5C]">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Capítulos como lista numerada */}
              <div className="bg-white rounded-[16px] border border-slate-300 p-5 shadow-sm">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-4">
                  {capitularActivos.length} capítulos
                </p>
                <div className="space-y-2">
                  {capitularActivos.map((c, i) => (
                    <div key={c.id} className="flex items-center gap-3">
                      <span className="text-xs font-bold tabular-nums w-6 text-right flex-shrink-0" style={{ color: "#2563EB" }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="text-sm text-[#1E293B]">{c.nombre}</span>
                    </div>
                  ))}
                </div>
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

              {errorGuardar && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-[8px] px-3 py-2">
                  {errorGuardar}
                </p>
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
              if (paso === 1 && form.capitulos.length === 0) cargarSugeridos();
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
              "Crear proyecto"
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export default function NuevoProyectoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F8FAFC" }}>
        <div className="text-sm text-slate-400">Cargando…</div>
      </div>
    }>
      <NuevoProyectoContent />
    </Suspense>
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
