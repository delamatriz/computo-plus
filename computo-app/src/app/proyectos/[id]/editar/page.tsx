"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Tipos de obra (mismo vocabulario que /proyectos/nuevo) ─── */
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

interface FormData {
  nombre: string;
  subtitulo: string;
  cliente: string;
  tipo: string;
  tipoContratacion: string;
  direccion: string;
  moneda: "UYU" | "USD";
  area: string;
  fechaInicio: string;
  plazoObra: string;
  diasLaborales: string;
  trabajos: string;
  descripcion: string;
  requierePlanSeguridad: boolean;
  modalidadAltura: string[];
}

const MODALIDADES_ALTURA = [
  { id: "andamios", label: "Andamios" },
  { id: "balancin", label: "Balancín" },
  { id: "silleta",  label: "Silleta" },
  { id: "combinacion", label: "Combinación" },
  { id: "grua", label: "Grúa / otra maquinaria" },
];

// Título del proyecto, en la parte que este formulario edita — nombre de
// solo lectura acá (renombrar título no es una capacidad que exista en
// ningún lado todavía, no se agrega en esta tarea), trabajos en altura sí
// editable, mismo campo que a nivel Proyecto pero uno por título.
interface TituloForm {
  id: string;
  nombre: string;
  requierePlanSeguridad: boolean;
  modalidadAltura: string[];
}

export default function EditarProyectoPage() {
  const params = useParams();
  const router = useRouter();
  const proyectoId = params?.id as string;

  const [form, setForm] = useState<FormData>({
    nombre: "", subtitulo: "", cliente: "", tipo: "VIVIENDA", tipoContratacion: "PRIVADA", direccion: "",
    moneda: "UYU", area: "", fechaInicio: "", plazoObra: "", diasLaborales: "", trabajos: "", descripcion: "",
    requierePlanSeguridad: false, modalidadAltura: [],
  });
  const [titulos, setTitulos] = useState<TituloForm[]>([]);
  // Snapshot de los títulos tal como llegaron del servidor — al guardar,
  // solo se manda PATCH /api/titulos/[id] para los que realmente cambiaron
  // (comparado contra esto), no para todos.
  const titulosOriginalRef = useRef<Record<string, { requierePlanSeguridad: boolean; modalidadAltura: string }>>({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    fetch(`/api/proyectos/${proyectoId}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelado) return;
        setForm({
          nombre: data.nombre ?? "",
          subtitulo: data.subtitulo ?? "",
          cliente: data.cliente ?? "",
          tipo: data.tipo ?? "VIVIENDA",
          tipoContratacion: data.tipoContratacion ?? "PRIVADA",
          direccion: data.direccion ?? "",
          moneda: data.moneda === "USD" ? "USD" : "UYU",
          area: data.area != null ? String(data.area) : "",
          fechaInicio: data.fechaInicio ? data.fechaInicio.slice(0, 10) : "",
          plazoObra: data.plazoObra != null ? String(data.plazoObra) : "",
          diasLaborales: data.diasLaborales != null ? String(data.diasLaborales) : "",
          trabajos: data.trabajos ?? "",
          descripcion: data.descripcion ?? "",
          requierePlanSeguridad: !!data.requierePlanSeguridad,
          modalidadAltura: data.modalidadAltura ? data.modalidadAltura.split(",").filter(Boolean) : [],
        });

        const titulosData: TituloForm[] = (data.titulos ?? []).map(
          (t: { id: string; nombre: string; requierePlanSeguridad?: boolean; modalidadAltura?: string | null }) => ({
            id: t.id,
            nombre: t.nombre,
            requierePlanSeguridad: !!t.requierePlanSeguridad,
            modalidadAltura: t.modalidadAltura ? t.modalidadAltura.split(",").filter(Boolean) : [],
          })
        );
        setTitulos(titulosData);
        titulosOriginalRef.current = Object.fromEntries(
          titulosData.map((t) => [t.id, { requierePlanSeguridad: t.requierePlanSeguridad, modalidadAltura: t.modalidadAltura.join(",") }])
        );
      })
      .catch((err) => { console.error("[cargar proyecto editar]", err); setError("No se pudo cargar el proyecto"); })
      .finally(() => { if (!cancelado) setCargando(false); });
    return () => { cancelado = true; };
  }, [proyectoId]);

  const set = <K extends keyof FormData>(campo: K, valor: FormData[K]) =>
    setForm((prev) => ({ ...prev, [campo]: valor }));

  const toggleRequiereTitulo = (id: string) => {
    setTitulos((prev) => prev.map((t) => t.id === id ? { ...t, requierePlanSeguridad: !t.requierePlanSeguridad } : t));
  };

  const toggleModalidadAlturaTitulo = (id: string, modalidadId: string) => {
    setTitulos((prev) => prev.map((t) => {
      if (t.id !== id) return t;
      return {
        ...t,
        modalidadAltura: t.modalidadAltura.includes(modalidadId)
          ? t.modalidadAltura.filter((m) => m !== modalidadId)
          : [...t.modalidadAltura, modalidadId],
      };
    }));
  };

  const toggleModalidadAltura = (id: string) => {
    set(
      "modalidadAltura",
      form.modalidadAltura.includes(id)
        ? form.modalidadAltura.filter((m) => m !== id)
        : [...form.modalidadAltura, id]
    );
  };

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          subtitulo: form.subtitulo.trim() || null,
          cliente: form.cliente.trim() || null,
          tipo: form.tipo,
          tipoContratacion: form.tipoContratacion,
          direccion: form.direccion.trim() || null,
          moneda: form.moneda,
          area: form.area ? parseFloat(form.area) : null,
          fechaInicio: form.fechaInicio || null,
          plazoObra: form.plazoObra ? parseInt(form.plazoObra, 10) : null,
          diasLaborales: form.diasLaborales ? parseInt(form.diasLaborales, 10) : null,
          trabajos: form.trabajos.trim() || null,
          descripcion: form.descripcion.trim() || null,
          requierePlanSeguridad: form.requierePlanSeguridad,
          modalidadAltura: form.requierePlanSeguridad && form.modalidadAltura.length > 0
            ? form.modalidadAltura.join(",")
            : null,
        }),
      });
      if (!res.ok) throw new Error("No se pudo guardar el proyecto");

      // Solo se manda PATCH para los títulos cuyo flag realmente cambió
      // respecto a lo que llegó del servidor — comparando el valor
      // "efectivo" (si requierePlanSeguridad quedó en false, la modalidad
      // no cuenta aunque haya chips tildados sin guardar, mismo criterio
      // que ya usa el PATCH de proyecto de acá arriba).
      const titulosModificados = titulos.filter((t) => {
        const original = titulosOriginalRef.current[t.id];
        const modalidadActual = t.requierePlanSeguridad && t.modalidadAltura.length > 0 ? t.modalidadAltura.join(",") : "";
        const modalidadOriginal = original?.modalidadAltura ?? "";
        return !original || original.requierePlanSeguridad !== t.requierePlanSeguridad || modalidadOriginal !== modalidadActual;
      });

      // Se esperan estos PATCH (a diferencia de generar-seguridad-altura,
      // que sigue siendo fire-and-forget) porque ese endpoint lee el
      // estado ACTUAL de los títulos en la base — si no se esperara, podría
      // correr antes de que el flag recién tildado quedara persistido.
      await Promise.all(
        titulosModificados.map((t) =>
          fetch(`/api/titulos/${t.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              requierePlanSeguridad: t.requierePlanSeguridad,
              modalidadAltura: t.requierePlanSeguridad && t.modalidadAltura.length > 0 ? t.modalidadAltura.join(",") : null,
            }),
          })
        )
      );

      const necesitaGenerarSeguridad = form.requierePlanSeguridad || titulos.some((t) => t.requierePlanSeguridad);
      if (necesitaGenerarSeguridad) {
        fetch(`/api/proyectos/${proyectoId}/generar-seguridad-altura`, {
          method: "POST",
        }).catch((err) => console.error("[editar proyecto] generar-seguridad-altura", err));
      }

      router.push(`/proyectos/${proyectoId}`);
    } catch (err) {
      console.error("[guardar proyecto editar]", err);
      setError("No se pudo guardar el proyecto. Intentá de nuevo.");
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <div className="max-w-2xl mx-auto py-10 text-center text-slate-400 text-sm">
        Cargando proyecto…
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-5">
      <button
        onClick={() => router.push(`/proyectos/${proyectoId}`)}
        className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-[#2563EB] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Volver al proyecto
      </button>

      <h1 className="text-xl font-bold text-[#1A3A5C]">Editar proyecto</h1>

      <div className="bg-white rounded-[16px] border border-slate-300 p-6 space-y-4 shadow-sm">
        <Field label="Nombre del proyecto *">
          <input
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

        <Field label="Descripción / Trabajos a realizar">
          <textarea
            value={form.trabajos}
            onChange={(e) => set("trabajos", e.target.value)}
            placeholder="Describí los trabajos a realizar. La IA usará esta descripción para sugerir capítulos y rubros."
            rows={4}
            className={inputCls}
          />
        </Field>

        <Field label="Tipo de obra">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {TIPOS_OBRA.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => set("tipo", t.id)}
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
                type="button"
                onClick={() => set("tipoContratacion", t.id)}
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

        <Field label="Cliente / Comitente">
          <input
            type="text"
            value={form.cliente}
            onChange={(e) => set("cliente", e.target.value)}
            placeholder="Nombre del cliente o comitente"
            className={inputCls}
          />
        </Field>

        <Field label="Dirección de la obra">
          <input
            type="text"
            value={form.direccion}
            onChange={(e) => set("direccion", e.target.value)}
            placeholder="ej: Bvar. España 2424, Montevideo"
            className={inputCls}
          />
        </Field>

        <Field label="Moneda principal">
          <div className="grid grid-cols-2 gap-3">
            {(["USD", "UYU"] as const).map((m) => (
              <button
                key={m}
                type="button"
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
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">m²</span>
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
              value={form.plazoObra}
              onChange={(e) => set("plazoObra", e.target.value)}
              placeholder="ej: 240"
              min={1}
              className={inputCls}
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">días</span>
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

      {/* Trabajos en altura por título — mismo campo que arriba
          (requierePlanSeguridad/modalidadAltura) pero uno independiente
          por título, ya que un título puede necesitar trabajo en altura y
          otro no (ver Titulo.requierePlanSeguridad en schema.prisma). Solo
          se muestra si el proyecto tiene títulos; el nombre es de solo
          lectura acá — renombrar título no existe todavía en ningún lado. */}
      {titulos.length > 0 && (
        <div className="bg-white rounded-[16px] border border-slate-300 p-6 space-y-4 shadow-sm">
          <div>
            <h3 className="text-sm font-bold text-[#1A3A5C]">Trabajos en altura por título</h3>
            <p className="text-xs text-slate-400 mt-0.5">Cada título puede necesitar trabajo en altura o no, independiente del proyecto</p>
          </div>

          <div className="space-y-4 divide-y divide-slate-100">
            {titulos.map((titulo) => (
              <div key={titulo.id} className="pt-4 first:pt-0 space-y-3">
                <p className="text-sm font-semibold text-[#1A3A5C]">{titulo.nombre || "Sin nombre"}</p>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={titulo.requierePlanSeguridad}
                    onChange={() => toggleRequiereTitulo(titulo.id)}
                    className="w-4 h-4 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]/30"
                  />
                  <span className="text-sm text-slate-700">Requiere plan y estudio de seguridad (MTOP)</span>
                </label>

                {titulo.requierePlanSeguridad && (
                  <Field label="Modalidad de trabajo en altura">
                    <div className="flex flex-wrap gap-2">
                      {MODALIDADES_ALTURA.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => toggleModalidadAlturaTitulo(titulo.id, m.id)}
                          className={cn(
                            "px-3.5 py-2 rounded-[10px] border text-sm font-medium transition-all",
                            titulo.modalidadAltura.includes(m.id)
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
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="px-4 py-3 rounded-[10px] bg-red-50 border border-red-200 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => router.push(`/proyectos/${proyectoId}`)}
          disabled={guardando}
          className="px-4 py-2.5 rounded-[10px] text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          onClick={guardar}
          disabled={guardando || !form.nombre.trim()}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" /> {guardando ? "Guardando…" : "Guardar cambios"}
        </button>
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
