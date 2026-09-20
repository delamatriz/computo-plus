"use client";

import { useState, useCallback, useMemo } from "react";
import { Users, ChevronDown, ChevronRight, Plus, Pencil, X, Phone, Building2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

/* ─── Tipos ───────────────────────────────────────────────── */
interface CategoriaLaboral {
  id: string;
  nombre: string;
  categoria: string;
  jornal: number;
}

interface PersonaObra {
  id: string;
  nombre: string;
  categoriaLaboralId: string;
  categoriaLaboral: CategoriaLaboral;
  cuadrilla: string;
  empresaSubcontratista: string | null;
  telefono: string | null;
  activo: boolean;
}

interface Props {
  proyectoId: string;
}

type FormState = {
  nombre: string;
  categoriaLaboralId: string;
  cuadrilla: string;
  empresaSubcontratista: string;
  telefono: string;
  activo: boolean;
};

function formVacio(): FormState {
  return { nombre: "", categoriaLaboralId: "", cuadrilla: "", empresaSubcontratista: "", telefono: "", activo: true };
}

function formDesdePersona(p: PersonaObra): FormState {
  return {
    nombre: p.nombre,
    categoriaLaboralId: p.categoriaLaboralId,
    cuadrilla: p.cuadrilla,
    empresaSubcontratista: p.empresaSubcontratista ?? "",
    telefono: p.telefono ?? "",
    activo: p.activo,
  };
}

const SIN_CUADRILLA = "(Sin cuadrilla asignada)";

/* ─── Componente principal ────────────────────────────────── */
export default function SeccionPersonalObra({ proyectoId }: Props) {
  const [expandido, setExpandido] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [personal, setPersonal] = useState<PersonaObra[]>([]);
  const [soloActivas, setSoloActivas] = useState(false);

  const [formularioAbierto, setFormularioAbierto] = useState<"nueva" | string | null>(null);
  const [form, setForm] = useState<FormState>(formVacio());
  const [guardando, setGuardando] = useState(false);

  const [categorias, setCategorias] = useState<CategoriaLaboral[]>([]);
  const [cargandoCategorias, setCargandoCategorias] = useState(false);

  const cargarLista = useCallback(async () => {
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/personal`);
      const data = await res.json();
      setPersonal(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("[personal] error cargando lista", err);
    } finally {
      setCargado(true);
    }
  }, [proyectoId]);

  const abrirSeccion = () => {
    setExpandido((p) => !p);
    if (!cargado) cargarLista();
  };

  const cargarCategorias = useCallback(async () => {
    setCargandoCategorias(true);
    try {
      const res = await fetch(`/api/categorias-laborales`);
      const data = await res.json();
      setCategorias(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("[personal] error cargando categorías laborales", err);
    } finally {
      setCargandoCategorias(false);
    }
  }, []);

  const abrirNuevaPersona = () => {
    setForm(formVacio());
    setFormularioAbierto("nueva");
    if (categorias.length === 0) cargarCategorias();
  };

  const abrirEdicion = (persona: PersonaObra) => {
    setForm(formDesdePersona(persona));
    setFormularioAbierto(persona.id);
    if (categorias.length === 0) cargarCategorias();
  };

  const cerrarFormulario = () => setFormularioAbierto(null);

  const guardar = async () => {
    if (!form.nombre.trim() || !form.categoriaLaboralId) return;
    setGuardando(true);
    try {
      const esEdicion = formularioAbierto !== "nueva" && formularioAbierto != null;
      const url = esEdicion
        ? `/api/proyectos/${proyectoId}/personal/${formularioAbierto}`
        : `/api/proyectos/${proyectoId}/personal`;
      const res = await fetch(url, {
        method: esEdicion ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("No se pudo guardar");
      const data: PersonaObra = await res.json();
      setPersonal((prev) => {
        if (esEdicion) return prev.map((p) => (p.id === data.id ? data : p));
        return [...prev, data];
      });
      setFormularioAbierto(null);
    } catch (err) {
      console.error("[personal] error guardando persona", err);
    } finally {
      setGuardando(false);
    }
  };

  const toggleActivo = async (persona: PersonaObra) => {
    const anteriorActivo = persona.activo;
    setPersonal((prev) => prev.map((p) => (p.id === persona.id ? { ...p, activo: !anteriorActivo } : p)));
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/personal/${persona.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formDesdePersona(persona), activo: !anteriorActivo }),
      });
      if (!res.ok) throw new Error("No se pudo actualizar");
      const data: PersonaObra = await res.json();
      setPersonal((prev) => prev.map((p) => (p.id === data.id ? data : p)));
    } catch (err) {
      console.error("[personal] error cambiando activo/inactivo", err);
      setPersonal((prev) => prev.map((p) => (p.id === persona.id ? { ...p, activo: anteriorActivo } : p)));
    }
  };

  const personalFiltrado = useMemo(
    () => (soloActivas ? personal.filter((p) => p.activo) : personal),
    [personal, soloActivas]
  );

  const grupos = useMemo(() => {
    const m = new Map<string, PersonaObra[]>();
    for (const p of personalFiltrado) {
      const clave = p.cuadrilla.trim() || SIN_CUADRILLA;
      if (!m.has(clave)) m.set(clave, []);
      m.get(clave)!.push(p);
    }
    return Array.from(m.entries()).sort(([a], [b]) => {
      if (a === SIN_CUADRILLA) return 1;
      if (b === SIN_CUADRILLA) return -1;
      return a.localeCompare(b, "es-UY");
    });
  }, [personalFiltrado]);

  return (
    <div className="mt-6 bg-white rounded-[16px] border border-slate-300 shadow-sm overflow-hidden">
      <button
        onClick={abrirSeccion}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors text-left group"
      >
        <div className="flex items-center gap-2.5">
          <Users className="w-4 h-4 text-[#2563EB]" />
          <h2 className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">Personal y Cuadrillas</h2>
        </div>
        <span className="text-slate-400 group-hover:text-slate-600 transition-colors">
          {expandido ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expandido && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-slate-200"
          >
            <div className="px-5 py-5 space-y-3" style={{ background: "#F8FAFC" }}>
              <p className="text-xs text-slate-500 -mt-1">
                Registro de las personas trabajando en esta obra: quién es, su oficio y a qué cuadrilla o
                subcontratista pertenece.
              </p>

              <div className="flex items-center gap-3">
                <button
                  onClick={abrirNuevaPersona}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-colors"
                >
                  <Plus className="w-4 h-4" /> Agregar persona
                </button>
                <label className="flex items-center gap-1.5 text-xs text-slate-500 flex-shrink-0 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={soloActivas}
                    onChange={(e) => setSoloActivas(e.target.checked)}
                    className="rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]/30"
                  />
                  Solo activas
                </label>
              </div>

              {personal.length === 0 ? (
                <p className="text-xs text-slate-400 italic px-1 py-3">
                  Todavía no hay personas registradas en este proyecto.
                </p>
              ) : personalFiltrado.length === 0 ? (
                <p className="text-xs text-slate-400 italic px-1 py-3">
                  No hay personas activas (desmarcá &quot;Solo activas&quot; para ver todas).
                </p>
              ) : (
                <div className="space-y-4">
                  {grupos.map(([cuadrilla, personas]) => (
                    <div key={cuadrilla}>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 px-0.5">
                        {cuadrilla} <span className="font-normal normal-case text-slate-400">({personas.length})</span>
                      </p>
                      <div className="space-y-1.5">
                        {personas.map((persona) => (
                          <FilaPersona
                            key={persona.id}
                            persona={persona}
                            onEditar={() => abrirEdicion(persona)}
                            onToggleActivo={() => toggleActivo(persona)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {formularioAbierto && (
          <FormularioPersona
            form={form}
            setForm={setForm}
            esEdicion={formularioAbierto !== "nueva"}
            guardando={guardando}
            categorias={categorias}
            cargandoCategorias={cargandoCategorias}
            onGuardar={guardar}
            onCerrar={cerrarFormulario}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Fila de persona ─────────────────────────────────────── */
function FilaPersona({
  persona,
  onEditar,
  onToggleActivo,
}: {
  persona: PersonaObra;
  onEditar: () => void;
  onToggleActivo: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-[10px] border border-slate-200 bg-white px-3.5 py-2.5 transition-opacity",
        !persona.activo && "opacity-50"
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-sm font-semibold text-[#1A3A5C] truncate">{persona.nombre}</span>
          <span className="text-[11px] text-slate-400">·</span>
          <span className="text-[11px] text-slate-500">{persona.categoriaLaboral.nombre}</span>
          {!persona.activo && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
              Inactivo
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
          {persona.empresaSubcontratista && (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
              <Building2 className="w-3 h-3" /> {persona.empresaSubcontratista}
            </span>
          )}
          {persona.telefono && (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
              <Phone className="w-3 h-3" /> {persona.telefono}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onEditar}
          className="text-slate-400 hover:text-[#2563EB] transition-colors p-1"
          title="Editar"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onToggleActivo}
          title={persona.activo ? "Marcar inactiva" : "Marcar activa"}
          className={cn(
            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0",
            persona.activo ? "bg-[#2563EB]" : "bg-slate-300"
          )}
        >
          <span
            className={cn(
              "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
              persona.activo ? "translate-x-4" : "translate-x-0.5"
            )}
          />
        </button>
      </div>
    </div>
  );
}

/* ─── Modal de formulario (nueva / editar) ────────────────── */
function FormularioPersona({
  form,
  setForm,
  esEdicion,
  guardando,
  categorias,
  cargandoCategorias,
  onGuardar,
  onCerrar,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  esEdicion: boolean;
  guardando: boolean;
  categorias: CategoriaLaboral[];
  cargandoCategorias: boolean;
  onGuardar: () => void;
  onCerrar: () => void;
}) {
  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const inputCls =
    "w-full text-sm text-slate-700 bg-white border border-slate-200 rounded-[8px] px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30";
  const labelCls = "text-xs font-semibold text-slate-500 mb-1 block";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3 md:p-6"
      onClick={onCerrar}
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-[16px] w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col shadow-xl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
          <h3 className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">
            {esEdicion ? "Editar persona" : "Agregar persona"}
          </h3>
          <button onClick={onCerrar} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className={labelCls}>Nombre</label>
            <input
              type="text"
              value={form.nombre}
              onChange={(e) => set("nombre", e.target.value)}
              placeholder="Nombre y apellido"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Categoría / oficio</label>
            {cargandoCategorias ? (
              <p className="text-xs text-slate-400 italic">Cargando categorías…</p>
            ) : (
              <select
                value={form.categoriaLaboralId}
                onChange={(e) => set("categoriaLaboralId", e.target.value)}
                className={inputCls}
              >
                <option value="">Seleccioná una categoría…</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className={labelCls}>Cuadrilla (opcional)</label>
            <input
              type="text"
              value={form.cuadrilla}
              onChange={(e) => set("cuadrilla", e.target.value)}
              placeholder="ej: Cuadrilla A"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Empresa / subcontratista (opcional)</label>
            <input
              type="text"
              value={form.empresaSubcontratista}
              onChange={(e) => set("empresaSubcontratista", e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Teléfono (opcional)</label>
            <input
              type="text"
              value={form.telefono}
              onChange={(e) => set("telefono", e.target.value)}
              className={inputCls}
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.activo}
              onChange={(e) => set("activo", e.target.checked)}
              className="rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]/30"
            />
            Activa en obra
          </label>
        </div>

        <div className="px-5 py-4 border-t border-slate-200 flex gap-2 flex-shrink-0">
          <button
            onClick={onCerrar}
            className="flex-1 py-2.5 rounded-[10px] border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onGuardar}
            disabled={guardando || !form.nombre.trim() || !form.categoriaLaboralId}
            className="flex-1 py-2.5 rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {guardando ? "Guardando…" : esEdicion ? "Guardar cambios" : "Agregar persona"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
