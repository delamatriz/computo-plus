"use client";

import { useState, useEffect } from "react";
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

interface FormData {
  nombre: string;
  subtitulo: string;
  cliente: string;
  tipo: string;
  direccion: string;
  moneda: "UYU" | "USD";
  area: string;
  fechaInicio: string;
  plazoObra: string;
  diasLaborales: string;
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

export default function EditarProyectoPage() {
  const params = useParams();
  const router = useRouter();
  const proyectoId = params?.id as string;

  const [form, setForm] = useState<FormData>({
    nombre: "", subtitulo: "", cliente: "", tipo: "VIVIENDA", direccion: "",
    moneda: "UYU", area: "", fechaInicio: "", plazoObra: "", diasLaborales: "", descripcion: "",
    requierePlanSeguridad: false, modalidadAltura: [],
  });
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
          direccion: data.direccion ?? "",
          moneda: data.moneda === "USD" ? "USD" : "UYU",
          area: data.area != null ? String(data.area) : "",
          fechaInicio: data.fechaInicio ? data.fechaInicio.slice(0, 10) : "",
          plazoObra: data.plazoObra != null ? String(data.plazoObra) : "",
          diasLaborales: data.diasLaborales != null ? String(data.diasLaborales) : "",
          descripcion: data.descripcion ?? "",
          requierePlanSeguridad: !!data.requierePlanSeguridad,
          modalidadAltura: data.modalidadAltura ? data.modalidadAltura.split(",").filter(Boolean) : [],
        });
      })
      .catch((err) => { console.error("[cargar proyecto editar]", err); setError("No se pudo cargar el proyecto"); })
      .finally(() => { if (!cancelado) setCargando(false); });
    return () => { cancelado = true; };
  }, [proyectoId]);

  const set = <K extends keyof FormData>(campo: K, valor: FormData[K]) =>
    setForm((prev) => ({ ...prev, [campo]: valor }));

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
          direccion: form.direccion.trim() || null,
          moneda: form.moneda,
          area: form.area ? parseFloat(form.area) : null,
          fechaInicio: form.fechaInicio || null,
          plazoObra: form.plazoObra ? parseInt(form.plazoObra, 10) : null,
          diasLaborales: form.diasLaborales ? parseInt(form.diasLaborales, 10) : null,
          descripcion: form.descripcion.trim() || null,
          requierePlanSeguridad: form.requierePlanSeguridad,
          modalidadAltura: form.requierePlanSeguridad && form.modalidadAltura.length > 0
            ? form.modalidadAltura.join(",")
            : null,
        }),
      });
      if (!res.ok) throw new Error("No se pudo guardar el proyecto");

      if (form.requierePlanSeguridad) {
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
