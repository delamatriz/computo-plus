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
import {
  SelectorCapitulosEstandar,
  COLORES_CAPITULOS,
  COLORS,
} from "@/components/SelectorCapitulosEstandar";

/* ─── Tipos ─────────────────────────────────────────────── */
interface FormData {
  nombre: string;
  subtitulo: string;
  cliente: string;
  tipo: string;
  tipoContratacion: string;
  rut: string;
  razonSocial: string;
  telefono: string;
  correo: string;
  direccion: string;
  trabajos: string;
  moneda: "UYU" | "USD";
  // Fecha de emisión del presupuesto — distinta de la fecha de inicio de
  // obra (esa se sacó del wizard, se carga solo desde /editar).
  fechaPresupuesto: string;
  area: string;
  descripcion: string;
  // Capítulos sueltos (sin título) — si el usuario nunca usa "Agregar
  // título", este es el único bucket y el comportamiento es idéntico al
  // de antes del Punto 2.
  capitulos: Capitulo[];
  // true mientras el contenido de `capitulos` sea el que puso la precarga
  // automática (sin intervención del usuario) — pasa a false apenas el
  // usuario toca algo a mano ahí (switch, IA, agregar/borrar/renombrar).
  // Se usa en la transición paso 2 → 3 para decidir si hay que vaciar
  // "Sin título" al agregar títulos, sin pisar una elección real del
  // usuario si ya la hizo.
  sinTituloEsAutomatico: boolean;
  titulos: TituloWizard[];
  fotos: FotoProyecto[];
  documentos: File[];
}

interface Capitulo {
  id: string;
  nombre: string;
  color: string;
  activo: boolean;
}

// Título armado en el asistente — mismo shape conceptual que el Titulo real
// (ver schema.prisma), pero todavía sin persistir. Cada título tiene su
// propia selección de capítulos, independiente de los demás y de los
// sueltos (nombres repetidos entre títulos son válidos — ver paso 6 del
// feature de Título, que resuelve esa ambigüedad en la Planilla de Cómputo).
interface TituloWizard {
  id: string;
  nombre: string;
  color: string;
  capitulos: Capitulo[];
  // "Este título necesita Plan y Estudio de Seguridad (MTOP)" — sin
  // modalidad/maquinaria acá (eso vive en el Equipo del APU de cada rubro
  // puntual, ver lib/seguridadAltura.ts).
  requierePlanSeguridad: boolean;
}

interface FotoProyecto {
  preview: string;
  file?: File;
  base64?: string;
  mediaType: string;
}

const MAX_FOTOS = 10;
const MAX_DOCS = 5;

/* ─── Datos de referencia ─────────────────────────────── */
const TIPOS_OBRA = [
  { id: "REPARACIONES", label: "Reparaciones" },
  { id: "REFORMA",      label: "Reforma / Ampliación" },
  { id: "VIVIENDA",     label: "Vivienda unifamiliar" },
  { id: "PH",           label: "Propiedad Horizontal" },
  { id: "COMERCIAL",    label: "Local comercial" },
  { id: "INDUSTRIAL",   label: "Industrial" },
];

const TIPOS_CONTRATACION = [
  { id: "PRIVADA", label: "Privada" },
  { id: "PUBLICA", label: "Pública" },
];

interface CapituloEstandarItem {
  id: string;
  nombre: string;
  orden: number;
  origen: string;
  vecesUsado: number;
}

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
  // Fetch propio (además del que hace SelectorCapitulosEstandar internamente)
  // — lo sigue necesitando cargarSugeridos() más abajo, que precarga la
  // lista completa al pasar de paso 1 a paso 2, antes de que el paso 3 (y
  // por lo tanto el selector) exista en pantalla.
  const [capitulosEstandar, setCapitulosEstandar] = useState<CapituloEstandarItem[]>([]);

  const [form, setForm] = useState<FormData>({
    nombre: "",
    subtitulo: "",
    cliente: "",
    tipo: searchParams.get("tipo")?.toUpperCase() ?? "VIVIENDA",
    tipoContratacion: "PRIVADA",
    rut: "",
    razonSocial: "",
    telefono: "",
    correo: "",
    direccion: "",
    trabajos: "",
    moneda: "USD",
    fechaPresupuesto: "",
    area: searchParams.get("area") ?? "",
    descripcion: "",
    capitulos: [],
    sinTituloEsAutomatico: true,
    titulos: [],
    fotos: [],
    documentos: [],
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

  const handleTipoContratacionChange = (tipoContratacion: string) => {
    set("tipoContratacion", tipoContratacion);
  };

  // Lista estándar completa (20 capítulos base) como array de Capitulo —
  // `activo` configurable: true para "Sin título" cuando no hay ningún
  // título (mismo comportamiento de siempre, todo prendido); false para
  // un título recién creado (arranca todo apagado, el usuario prende con
  // el switch los que le sirven — ver transición paso 2 → 3 más abajo).
  const listaCatalogo = (activo: boolean): Capitulo[] => {
    const base = capitulosEstandar.filter((c) => c.origen === "estandar");
    return base.map((c, i) => ({
      id: `est-${c.id}`,
      nombre: c.nombre,
      color: COLORES_CAPITULOS[c.nombre] ?? COLORS[i % COLORS.length],
      activo,
    }));
  };

  const agregarTituloWizard = () => {
    const color = COLORS[form.titulos.length % COLORS.length];
    set("titulos", [
      ...form.titulos,
      { id: String(Date.now()), nombre: "", color, capitulos: [], requierePlanSeguridad: false },
    ]);
  };

  const renombrarTituloWizard = (id: string, nombre: string) => {
    set("titulos", form.titulos.map((t) => t.id === id ? { ...t, nombre } : t));
  };

  const eliminarTituloWizard = (id: string) => {
    set("titulos", form.titulos.filter((t) => t.id !== id));
  };

  const setCapitulosDeTitulo = (tituloId: string, capitulos: Capitulo[]) => {
    set("titulos", form.titulos.map((t) => t.id === tituloId ? { ...t, capitulos } : t));
  };

  const toggleRequiereTitulo = (id: string) => {
    set("titulos", form.titulos.map((t) => t.id === id ? { ...t, requierePlanSeguridad: !t.requierePlanSeguridad } : t));
  };

  // "Al menos un capítulo activo" ahora cuenta tanto los sueltos como los
  // que están dentro de cualquier título — antes solo existía el bucket
  // suelto.
  const puedeAvanzar = () => {
    if (paso === 1) return form.nombre.trim().length >= 2;
    if (paso === 2) return true;
    if (paso === 3) {
      // Con títulos explícitos, "Sin título" ni se muestra — no cuenta
      // para el mínimo de "al menos un capítulo" (ver capitulosSueltosActivos).
      const sueltos = form.titulos.length > 0
        ? 0
        : form.capitulos.filter((c) => c.activo && c.nombre.trim()).length;
      const enTitulos = form.titulos.reduce(
        (acc, t) => acc + t.capitulos.filter((c) => c.activo && c.nombre.trim()).length,
        0
      );
      return sueltos + enTitulos > 0;
    }
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
          subtitulo: form.subtitulo || null,
          cliente: form.cliente,
          clienteRut: form.rut || null,
          clienteRazonSocial: form.razonSocial || null,
          clienteTelefono: form.telefono || null,
          clienteEmail: form.correo || null,
          tipo: form.tipo,
          tipoContratacion: form.tipoContratacion,
          moneda: form.moneda,
          fechaPresupuesto: form.fechaPresupuesto || null,
          area: form.area,
          descripcion: form.trabajos || form.descripcion,
          direccion: form.direccion,
          titulos: titulosBody,
          capitulos: capitulosBody,
        }),
      });
      if (!res.ok) {
        const detalle = await res.json().catch(() => null);
        throw new Error(`No se pudo crear el proyecto (status ${res.status}): ${detalle?.error ?? detalle?.mensaje ?? "sin detalle"}`);
      }
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

      // Plan y Estudio de Seguridad vive por título — generarCapituloSeguridad
      // recorre todos los títulos del proyecto que lo tengan marcado.
      if (titulosConActivos.some(({ titulo }) => titulo.requierePlanSeguridad)) {
        fetch(`/api/proyectos/${proyecto.id}/generar-seguridad-altura`, {
          method: "POST",
        }).catch((err) => console.error("[proyectos/nuevo] generar-seguridad-altura", err));
      }

      router.push(`/proyectos/${proyecto.id}`);
    } catch (err) {
      // El mensaje al usuario queda genérico a propósito (no tiene sentido
      // mostrarle un stack de Prisma), pero antes esto se tragaba el error
      // real del todo — sin loguearlo no había forma de distinguir un fallo
      // de payload de una caída transitoria de conexión a la base (ver
      // P1017 "Server has closed the connection", intermitente en Render).
      console.error("[proyectos/nuevo] handleGuardar", err);
      setErrorGuardar("No se pudo crear el proyecto. Intentá de nuevo.");
      setGuardando(false);
    }
  };

  // Sueltos y títulos se calculan por separado — el resumen del paso 4 y
  // el body de creación del proyecto necesitan la agrupación, no solo el
  // total. Un título sin ningún capítulo activo no aparece en el resumen
  // ni se manda al servidor (mismo criterio que ya usa
  // proyectos/[id]/page.tsx para títulos vacíos en el PDF/Excel).
  // Con títulos explícitos, "Sin título" no se renderiza (ver paso 3 más
  // abajo) — se fuerza vacío acá, el único choque de dónde sale el
  // payload y el resumen del paso 4, para que nunca se cuele un capítulo
  // sin tituloId aunque haya quedado algo cargado en form.capitulos de
  // antes de agregar el primer título (no se migra ni se borra ese
  // estado — si el usuario borra todos los títulos, "Sin título" vuelve
  // a aparecer con lo que había).
  const capitulosSueltosActivos = form.titulos.length > 0
    ? []
    : form.capitulos.filter((c) => c.activo && c.nombre.trim());
  const titulosConActivos = form.titulos
    .map((titulo) => ({ titulo, activos: titulo.capitulos.filter((c) => c.activo && c.nombre.trim()) }))
    .filter((t) => t.activos.length > 0);
  const totalCapitulosActivos =
    capitulosSueltosActivos.length + titulosConActivos.reduce((acc, t) => acc + t.activos.length, 0);

  // orden es un contador único por proyecto, corrido entre títulos y
  // sueltos (títulos primero, en el mismo orden en que se ven en pantalla)
  // — mismo criterio que usa el POST de "Agregar capítulo" al calcular el
  // próximo orden a partir del último existente.
  let ordenGlobal = 1;
  const titulosBody = titulosConActivos.map(({ titulo, activos }, tIdx) => ({
    nombre: titulo.nombre,
    color: titulo.color,
    orden: tIdx + 1,
    requierePlanSeguridad: titulo.requierePlanSeguridad,
    capitulos: activos.map((c, i) => ({
      nombre: c.nombre,
      color: c.color,
      codigo: `${tIdx + 1}.${i + 1}`,
      orden: ordenGlobal++,
    })),
  }));
  const capitulosBody = capitulosSueltosActivos.map((c, i) => ({
    nombre: c.nombre,
    color: c.color,
    codigo: String(i + 1).padStart(2, "0"),
    orden: ordenGlobal++,
  }));

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

              {/* Identificación */}
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

                <Field label="Subtítulo de la obra">
                  <input
                    type="text"
                    value={form.subtitulo}
                    onChange={(e) => set("subtitulo", e.target.value)}
                    placeholder="ej: Reforma integral de baño y cocina"
                    className={inputCls}
                  />
                  <p className="text-xs text-slate-400 mt-1.5">
                    Aparece en el encabezado del presupuesto al cliente
                  </p>
                </Field>
              </div>

              {/* Datos del cliente */}
              <div className="bg-white rounded-[16px] border border-slate-300 p-6 space-y-4 shadow-sm">
                <div>
                  <h3 className="text-sm font-bold text-[#1A3A5C]">Datos del cliente</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Contacto y ubicación de la obra
                  </p>
                </div>

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
              </div>

              {/* Contexto / descripción */}
              <div className="bg-white rounded-[16px] border border-slate-300 p-6 space-y-4 shadow-sm">

                <Field label="Descripción / Trabajos a realizar">
                  <textarea
                    value={form.trabajos}
                    onChange={(e) => set("trabajos", e.target.value)}
                    placeholder="Describí brevemente los trabajos a realizar: construcción, reforma, instalaciones, terminaciones..."
                    rows={4}
                    className={cn(inputCls, "resize-none")}
                  />
                </Field>

                <Field label="Área total (m²)">
                  <div className="relative max-w-[200px]">
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
                <p className="text-sm text-slate-400">Clasificación, moneda y fecha del presupuesto</p>
              </div>

              {/* Clasificación */}
              <div className="bg-white rounded-[16px] border border-slate-300 p-6 space-y-4 shadow-sm">

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

                <Field label="Tipo de contratación">
                  <div className="grid grid-cols-2 gap-2">
                    {TIPOS_CONTRATACION.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => handleTipoContratacionChange(t.id)}
                        className={cn(
                          "px-3.5 py-2.5 rounded-[10px] border text-sm font-medium text-center transition-all",
                          form.tipoContratacion === t.id
                            ? "border-[#2563EB] bg-blue-50 text-[#2563EB]"
                            : "border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-800"
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>

              {/* Económico */}
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

                <Field label="Fecha del presupuesto">
                  <input
                    type="date"
                    value={form.fechaPresupuesto}
                    onChange={(e) => set("fechaPresupuesto", e.target.value)}
                    className={cn(inputCls, "max-w-[200px]")}
                  />
                  <p className="text-xs text-slate-400 mt-1.5">
                    Fecha de emisión — distinta de la fecha de inicio de obra, que se carga después desde el proyecto
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

              {/* Títulos — agrupador opcional de capítulos. Solo nombre acá;
                  la selección de capítulos de cada uno se hace en el paso
                  siguiente (ver SelectorCapitulosEstandar por título). */}
              <div className="bg-white rounded-[16px] border border-slate-300 p-6 space-y-3 shadow-sm">
                <div>
                  <h3 className="text-sm font-bold text-[#1A3A5C]">Títulos</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Agrupá el presupuesto en títulos si la obra tiene varios frentes de trabajo independientes. Opcional.
                  </p>
                </div>

                {form.titulos.length > 0 && (
                  <div className="space-y-1.5">
                    {form.titulos.map((titulo) => (
                      <div key={titulo.id} className="rounded-[10px] border border-slate-200 bg-slate-50 overflow-hidden">
                        <div className="flex items-center gap-2.5 px-3 py-2">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: titulo.color }} />
                          <input
                            type="text"
                            value={titulo.nombre}
                            onChange={(e) => renombrarTituloWizard(titulo.id, e.target.value)}
                            placeholder="Nombre del título"
                            autoFocus={!titulo.nombre}
                            className="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                          />
                          <button
                            onClick={() => eliminarTituloWizard(titulo.id)}
                            className="w-6 h-6 flex items-center justify-center rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <label className="flex items-center gap-2.5 px-3 py-2 border-t border-slate-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={titulo.requierePlanSeguridad}
                            onChange={() => toggleRequiereTitulo(titulo.id)}
                            className="w-4 h-4 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]/30"
                          />
                          <span className="text-xs text-slate-600">Requiere plan y estudio de seguridad (MTOP)</span>
                        </label>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={agregarTituloWizard}
                  className="flex items-center gap-2 w-full px-3 py-2.5 rounded-[10px] border border-dashed border-slate-300 text-sm text-slate-400 hover:text-slate-600 hover:border-slate-400 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Agregar título
                </button>
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

              {/* Un bloque por título ya nombrado en "Detalles" — el nombre
                  es fijo acá (se edita en el paso anterior, no acá) y
                  arranca con el catálogo completo apagado (ver transición
                  2 → 3), así la interacción es 100% switches, igual que
                  "Sin título". Nombres repetidos entre títulos son
                  válidos a propósito (ver Planilla de Cómputo). */}
              {form.titulos.map((titulo) => (
                <div key={titulo.id} className="rounded-[16px] border-2 overflow-hidden" style={{ borderColor: titulo.color }}>
                  <div className="flex items-center gap-2.5 px-4 py-3" style={{ background: `${titulo.color}14` }}>
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: titulo.color }} />
                    <span className="text-sm font-bold text-[#1A3A5C]">{titulo.nombre || "Sin nombre"}</span>
                  </div>
                  <div className="p-4 bg-white">
                    <SelectorCapitulosEstandar
                      capitulos={titulo.capitulos}
                      onConfirmar={(c) => setCapitulosDeTitulo(titulo.id, c)}
                      tipoObra={form.tipo}
                      descripcionTrabajos={form.trabajos}
                      fotos={form.fotos}
                    />
                  </div>
                </div>
              ))}

              {/* "Sin título" solo existe cuando el usuario nunca agregó
                  ningún título explícito — esos capítulos son los que el
                  backend envuelve en el título implícito (ver POST
                  /api/proyectos). En cuanto hay 1+ títulos, todo capítulo
                  tiene que vivir dentro de alguno: esta sección desaparece
                  del todo, no queda como un "título más" al margen. Si el
                  usuario ya había cargado algo acá antes de agregar su
                  primer título, ese estado no se pierde ni se migra —
                  simplemente deja de mostrarse (ver capitulosSueltosActivos
                  más arriba, que ya lo excluye del payload); si borra todos
                  los títulos de nuevo, reaparece tal cual lo dejó. */}
              {form.titulos.length === 0 && (
                <SelectorCapitulosEstandar
                  capitulos={form.capitulos}
                  onConfirmar={(c) => {
                    set("capitulos", c);
                    // Cualquier interacción real del usuario acá (switch, IA,
                    // agregar/borrar/renombrar) deja de ser "automática" —
                    // ver transición 2 → 3, que respeta esto y no la pisa.
                    set("sinTituloEsAutomatico", false);
                  }}
                  tipoObra={form.tipo}
                  descripcionTrabajos={form.trabajos}
                  fotos={form.fotos}
                />
              )}
            </div>
          )}

          {/* ── PASO 4: Confirmar ──────────────────────── */}
          {paso === 4 && (
            <div className="space-y-5">
              <div className="mb-1">
                <h2 className="text-lg font-bold text-[#1A3A5C]">Confirmar y crear</h2>
                <p className="text-sm text-slate-400">Revisá los datos antes de crear el proyecto</p>
              </div>

              {/* Resumen de datos — agrupado igual que los pasos 1 y 2:
                  Datos del cliente primero, Detalles (clasificación +
                  económico) después. */}
              <div className="bg-white rounded-[16px] border border-slate-300 overflow-hidden shadow-sm">
                <div className="p-5 border-b border-slate-200">
                  <h3 className="font-bold text-[#1A3A5C] text-base">{form.nombre || "Sin nombre"}</h3>
                </div>

                <p className="px-5 pt-4 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Datos del cliente
                </p>
                <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 border-b border-slate-100">
                  {[
                    { label: "Cliente",   value: form.cliente || "—" },
                    { label: "Dirección", value: form.direccion || "—" },
                  ].map(({ label, value }) => (
                    <div key={label} className="px-5 py-3.5">
                      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
                      <p className="text-sm font-semibold text-[#1A3A5C]">{value}</p>
                    </div>
                  ))}
                </div>

                <p className="px-5 pt-4 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Detalles
                </p>
                <div className="grid grid-cols-2 divide-x divide-y divide-slate-100">
                  {[
                    { label: "Tipo de obra",  value: TIPOS_OBRA.find((t) => t.id === form.tipo)?.label ?? "—" },
                    { label: "Contratación",  value: TIPOS_CONTRATACION.find((t) => t.id === form.tipoContratacion)?.label ?? "—" },
                    { label: "Moneda",        value: form.moneda },
                    // timeZone: "UTC" — form.fechaPresupuesto es "YYYY-MM-DD" del
                    // <input type="date">, que new Date() parsea como medianoche
                    // UTC; sin esto, en huso local (Uruguay UTC-3) se muestra un
                    // día antes (mismo bug resuelto para convenioFechaVigente en
                    // lib/convenioSunca.ts).
                    { label: "Fecha del presupuesto", value: form.fechaPresupuesto ? new Date(form.fechaPresupuesto).toLocaleDateString("es-UY", { timeZone: "UTC" }) : "—" },
                    { label: "Área",          value: form.area ? `${form.area} m²` : "—" },
                  ].map(({ label, value }, i, arr) => (
                    <div
                      key={label}
                      className={cn("px-5 py-3.5", i === arr.length - 1 && arr.length % 2 !== 0 && "col-span-2")}
                    >
                      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
                      <p className="text-sm font-semibold text-[#1A3A5C]">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Capítulos agrupados por título (numerados N.M) + sueltos
                  abajo (numerados 01, 02...) — mismo criterio visual que
                  usa proyectos/[id]/page.tsx para el proyecto ya creado. */}
              <div className="bg-white rounded-[16px] border border-slate-300 p-5 shadow-sm">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-4">
                  {totalCapitulosActivos} capítulos
                </p>
                <div className="space-y-4">
                  {titulosConActivos.map(({ titulo, activos }, tIdx) => (
                    <div key={titulo.id}>
                      <p className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: titulo.color }}>
                        {tIdx + 1} · {titulo.nombre || "Sin nombre"}
                      </p>
                      <div className="space-y-2 pl-3">
                        {activos.map((c, i) => (
                          <div key={c.id} className="flex items-center gap-3">
                            <span className="text-xs font-bold tabular-nums w-8 text-right flex-shrink-0" style={{ color: "#2563EB" }}>
                              {tIdx + 1}.{i + 1}
                            </span>
                            <span className="text-sm text-[#1E293B]">{c.nombre}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {capitulosSueltosActivos.length > 0 && (
                    <div className="space-y-2">
                      {capitulosSueltosActivos.map((c, i) => (
                        <div key={c.id} className="flex items-center gap-3">
                          <span className="text-xs font-bold tabular-nums w-8 text-right flex-shrink-0" style={{ color: "#2563EB" }}>
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span className="text-sm text-[#1E293B]">{c.nombre}</span>
                        </div>
                      ))}
                    </div>
                  )}
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
              // Transición 2 → 3: acá (no antes) ya sabemos si el usuario
              // agregó títulos en el paso "Detalles", así que es el
              // momento correcto para decidir qué le toca a "Sin título".
              // Se re-evalúa CADA VEZ que se cruza esta transición (no
              // solo la primera), para que ir y volver entre pasos nunca
              // deje "Sin título" con la precarga automática puesta si en
              // algún momento se usaron títulos.
              if (paso === 2) {
                const hayTitulos = form.titulos.length > 0;
                if (hayTitulos) {
                  if (form.sinTituloEsAutomatico) set("capitulos", []);
                } else if (form.capitulos.length === 0) {
                  set("capitulos", listaCatalogo(true));
                  set("sinTituloEsAutomatico", true);
                }
                // Títulos que todavía no tienen selección propia arrancan
                // con el catálogo completo, todo apagado.
                set("titulos", form.titulos.map((t) =>
                  t.capitulos.length === 0 ? { ...t, capitulos: listaCatalogo(false) } : t
                ));
              }
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
