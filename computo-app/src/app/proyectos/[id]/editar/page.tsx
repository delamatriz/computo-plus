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
  clienteRut: string;
  clienteRazonSocial: string;
  clienteTelefono: string;
  clienteEmail: string;
  tipo: string;
  tipoContratacion: string;
  direccion: string;
  moneda: "UYU" | "USD";
  fechaPresupuesto: string;
  area: string;
  fechaInicio: string;
  plazoObra: string;
  diasLaborales: string;
  trabajos: string;
  descripcion: string;
}

// Título del proyecto, en la parte que este formulario edita — nombre de
// solo lectura acá (renombrar título no es una capacidad que exista en
// ningún lado todavía, no se agrega en esta tarea). "Requiere plan y
// estudio de seguridad (MTOP)" es un campo por título — cada uno puede
// necesitarlo o no, independiente de los demás.
interface TituloForm {
  id: string;
  nombre: string;
  requierePlanSeguridad: boolean;
}

export default function EditarProyectoPage() {
  const params = useParams();
  const router = useRouter();
  const proyectoId = params?.id as string;

  const [form, setForm] = useState<FormData>({
    nombre: "", subtitulo: "", cliente: "", clienteRut: "", clienteRazonSocial: "", clienteTelefono: "", clienteEmail: "",
    tipo: "VIVIENDA", tipoContratacion: "PRIVADA", direccion: "",
    moneda: "UYU", fechaPresupuesto: "", area: "", fechaInicio: "", plazoObra: "", diasLaborales: "", trabajos: "", descripcion: "",
  });
  const [titulos, setTitulos] = useState<TituloForm[]>([]);
  // Snapshot de los títulos tal como llegaron del servidor — al guardar,
  // solo se manda PATCH /api/titulos/[id] para los que realmente cambiaron
  // (comparado contra esto), no para todos.
  const titulosOriginalRef = useRef<Record<string, { requierePlanSeguridad: boolean }>>({});
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
          clienteRut: data.clienteRut ?? "",
          clienteRazonSocial: data.clienteRazonSocial ?? "",
          clienteTelefono: data.clienteTelefono ?? "",
          clienteEmail: data.clienteEmail ?? "",
          tipo: data.tipo ?? "VIVIENDA",
          tipoContratacion: data.tipoContratacion ?? "PRIVADA",
          direccion: data.direccion ?? "",
          moneda: data.moneda === "USD" ? "USD" : "UYU",
          fechaPresupuesto: data.fechaPresupuesto ? data.fechaPresupuesto.slice(0, 10) : "",
          area: data.area != null ? String(data.area) : "",
          fechaInicio: data.fechaInicio ? data.fechaInicio.slice(0, 10) : "",
          plazoObra: data.plazoObra != null ? String(data.plazoObra) : "",
          diasLaborales: data.diasLaborales != null ? String(data.diasLaborales) : "",
          trabajos: data.trabajos ?? "",
          descripcion: data.descripcion ?? "",
        });

        const titulosData: TituloForm[] = (data.titulos ?? []).map(
          (t: { id: string; nombre: string; requierePlanSeguridad?: boolean }) => ({
            id: t.id,
            nombre: t.nombre,
            requierePlanSeguridad: !!t.requierePlanSeguridad,
          })
        );
        setTitulos(titulosData);
        titulosOriginalRef.current = Object.fromEntries(
          titulosData.map((t) => [t.id, { requierePlanSeguridad: t.requierePlanSeguridad }])
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
          clienteRut: form.clienteRut.trim() || null,
          clienteRazonSocial: form.clienteRazonSocial.trim() || null,
          clienteTelefono: form.clienteTelefono.trim() || null,
          clienteEmail: form.clienteEmail.trim() || null,
          tipo: form.tipo,
          tipoContratacion: form.tipoContratacion,
          direccion: form.direccion.trim() || null,
          moneda: form.moneda,
          fechaPresupuesto: form.fechaPresupuesto || null,
          area: form.area ? parseFloat(form.area) : null,
          fechaInicio: form.fechaInicio || null,
          plazoObra: form.plazoObra ? parseInt(form.plazoObra, 10) : null,
          diasLaborales: form.diasLaborales ? parseInt(form.diasLaborales, 10) : null,
          trabajos: form.trabajos.trim() || null,
          descripcion: form.descripcion.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("No se pudo guardar el proyecto");

      // Solo se manda PATCH para los títulos cuyo flag realmente cambió
      // respecto a lo que llegó del servidor.
      const titulosModificados = titulos.filter((t) => {
        const original = titulosOriginalRef.current[t.id];
        return !original || original.requierePlanSeguridad !== t.requierePlanSeguridad;
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
            body: JSON.stringify({ requierePlanSeguridad: t.requierePlanSeguridad }),
          })
        )
      );

      const necesitaGenerarSeguridad = titulos.some((t) => t.requierePlanSeguridad);
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

        <div className="grid grid-cols-2 gap-4">
          <Field label="RUT">
            <input
              type="text"
              value={form.clienteRut}
              onChange={(e) => set("clienteRut", e.target.value)}
              placeholder="ej: 21234567-8"
              className={inputCls}
            />
          </Field>
          <Field label="Razón social">
            <input
              type="text"
              value={form.clienteRazonSocial}
              onChange={(e) => set("clienteRazonSocial", e.target.value)}
              placeholder="ej: González Construcciones S.R.L."
              className={inputCls}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Teléfono">
            <input
              type="text"
              value={form.clienteTelefono}
              onChange={(e) => set("clienteTelefono", e.target.value)}
              placeholder="ej: 099 123 456"
              className={inputCls}
            />
          </Field>
          <Field label="Correo electrónico">
            <input
              type="email"
              value={form.clienteEmail}
              onChange={(e) => set("clienteEmail", e.target.value)}
              placeholder="ej: contacto@empresa.com.uy"
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="Dirección de la obra">
          <input
            type="text"
            value={form.direccion}
            onChange={(e) => set("direccion", e.target.value)}
            placeholder="ej: Bvar. España 2424, Montevideo"
            className={inputCls}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Moneda principal">
            <select
              value={form.moneda}
              onChange={(e) => set("moneda", e.target.value as "UYU" | "USD")}
              className={inputCls}
            >
              <option value="UYU">$ — Peso uruguayo</option>
              <option value="USD">U$S — Dólar</option>
            </select>
          </Field>

          <Field label="Fecha del presupuesto">
            <input
              type="date"
              value={form.fechaPresupuesto}
              onChange={(e) => set("fechaPresupuesto", e.target.value)}
              className={inputCls}
            />
            <p className="text-xs text-slate-400 mt-1.5">
              Fecha de emisión — distinta de la fecha de inicio de obra
            </p>
          </Field>
        </div>

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

        <div className="grid grid-cols-2 gap-4">
          <Field label="Plazo de obra (días)">
            <div className="relative">
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
            <input
              type="number"
              value={form.diasLaborales}
              onChange={(e) => set("diasLaborales", e.target.value)}
              placeholder="ej: 65"
              min={1}
              className={inputCls}
            />
            <p className="text-xs text-slate-400 mt-1.5">
              Días hábiles de trabajo (distinto del plazo en días corridos)
            </p>
          </Field>
        </div>

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

      {/* Trabajos en altura — un campo por título (ver
          Titulo.requierePlanSeguridad en schema.prisma), ya que un título
          puede necesitar Plan y Estudio de Seguridad y otro no. Solo se
          muestra si el proyecto tiene títulos; el nombre es de solo
          lectura acá — renombrar título no existe todavía en ningún lado. */}
      {titulos.length > 0 && (
        <div className="bg-white rounded-[16px] border border-slate-300 p-6 space-y-4 shadow-sm">
          <div>
            <h3 className="text-sm font-bold text-[#1A3A5C]">Trabajos en altura</h3>
            <p className="text-xs text-slate-400 mt-0.5">Cada título puede necesitar Plan y Estudio de Seguridad (MTOP), independiente de los demás</p>
          </div>

          <div className="space-y-3">
            {titulos.map((titulo) => (
              <label
                key={titulo.id}
                className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-[10px] border border-slate-200 bg-slate-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={titulo.requierePlanSeguridad}
                  onChange={() => toggleRequiereTitulo(titulo.id)}
                  className="w-4 h-4 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]/30"
                />
                <span className="text-sm font-semibold text-[#1A3A5C]">{titulo.nombre || "Sin nombre"}</span>
                <span className="text-sm text-slate-500">requiere plan y estudio de seguridad</span>
              </label>
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
