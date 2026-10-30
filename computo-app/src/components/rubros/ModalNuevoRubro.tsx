"use client";

import { useEffect, useMemo, useState } from "react";
import { Hammer, Loader2, Package, Plus, Trash2, Wrench, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RubroCatalogoCreado, RubroCatalogoNuevo } from "@/lib/rubroCatalogoNuevo";

// Alta de un rubro en el catálogo global (/rubros) — solo SUPERADMIN.
// El APU se carga acá en filas simples (el DrawerAPU del proyecto está atado
// a un rubro de proyecto y no sirve para el catálogo). Los precios se
// resuelven en el servidor contra el catálogo de materiales/equipos y los
// jornales SUNCA; el precio que se carga es solo el respaldo.

const NUEVO_CAPITULO = "__nuevo__";

interface CategoriaLaboral {
  nombre: string;
  jornal: number;
}

interface FilaMaterial { descripcion: string; unidad: string; rendimiento: string; precio: string }
interface FilaManoObra { categoria: string; rendimiento: string }
interface FilaEquipo { descripcion: string; unidad: string; rendimiento: string; costo: string }

const filaMaterialVacia = (): FilaMaterial => ({ descripcion: "", unidad: "", rendimiento: "", precio: "" });
const filaManoObraVacia = (): FilaManoObra => ({ categoria: "", rendimiento: "" });
const filaEquipoVacia = (): FilaEquipo => ({ descripcion: "", unidad: "hr", rendimiento: "", costo: "" });

// "0,35" o "0.35" → 0.35; con coma decimal, los puntos son de miles
// ("1.250,5" → 1250.5). Vacío o inválido → NaN.
const aNumero = (s: string) => {
  const t = s.trim();
  if (!t) return NaN;
  return Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
};

const campo =
  "w-full rounded-[8px] border border-slate-200 px-3 py-2 text-sm text-[#1E293B] placeholder:text-slate-300 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100";
const campoChico =
  "w-full min-w-0 rounded-[6px] border border-slate-200 px-2 py-1.5 text-sm text-[#1E293B] placeholder:text-slate-300 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100";

export function ModalNuevoRubro({
  capitulos,
  onClose,
  onCreado,
}: {
  capitulos: { id: string; nombre: string }[];
  onClose: () => void;
  onCreado: (creado: RubroCatalogoCreado) => void;
}) {
  const [capituloId, setCapituloId] = useState(capitulos[0]?.id ?? NUEVO_CAPITULO);
  const [capituloNuevo, setCapituloNuevo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [unidad, setUnidad] = useState("");
  const [activo, setActivo] = useState(true);
  const [materiales, setMateriales] = useState<FilaMaterial[]>([filaMaterialVacia()]);
  const [manoObra, setManoObra] = useState<FilaManoObra[]>([filaManoObraVacia()]);
  const [equipos, setEquipos] = useState<FilaEquipo[]>([]);
  const [categorias, setCategorias] = useState<CategoriaLaboral[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/categorias-laborales")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: CategoriaLaboral[]) => {
        // La tabla repite nombres (ej. "Oficial albañil" como oficial y como sunca_cat_vii).
        const vistos = new Set<string>();
        setCategorias(
          data
            .filter((c) => !vistos.has(c.nombre) && vistos.add(c.nombre))
            .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
        );
      })
      .catch(() => setCategorias([]));
  }, []);

  const esCapituloNuevo = capituloId === NUEVO_CAPITULO;

  const payload = useMemo((): RubroCatalogoNuevo => {
    const numeroOpcional = (s: string) => {
      const n = aNumero(s);
      return n > 0 ? n : null;
    };
    return {
      capituloId: esCapituloNuevo ? null : capituloId,
      capituloNuevo: esCapituloNuevo ? capituloNuevo.trim() : null,
      descripcion: descripcion.trim(),
      unidad: unidad.trim(),
      activo,
      materiales: materiales
        .filter((m) => m.descripcion.trim())
        .map((m) => ({
          descripcion: m.descripcion.trim(),
          unidad: m.unidad.trim(),
          rendimiento: aNumero(m.rendimiento),
          precioReferencia: numeroOpcional(m.precio),
        })),
      manoObra: manoObra
        .filter((m) => m.categoria)
        .map((m) => ({ categoria: m.categoria, rendimiento: aNumero(m.rendimiento) })),
      equipos: equipos
        .filter((e) => e.descripcion.trim())
        .map((e) => ({
          descripcion: e.descripcion.trim(),
          unidad: e.unidad.trim(),
          rendimiento: aNumero(e.rendimiento),
          costoReferencia: numeroOpcional(e.costo),
        })),
    };
  }, [esCapituloNuevo, capituloId, capituloNuevo, descripcion, unidad, activo, materiales, manoObra, equipos]);

  const lineas = payload.materiales.length + payload.manoObra.length + payload.equipos.length;
  const puedeGuardar =
    !guardando &&
    payload.descripcion.length > 0 &&
    payload.unidad.length > 0 &&
    (!esCapituloNuevo || (payload.capituloNuevo ?? "").length > 0) &&
    lineas > 0;

  const guardar = async () => {
    const invalida =
      payload.materiales.find((m) => !m.unidad || !(m.rendimiento > 0))?.descripcion ??
      payload.equipos.find((e) => !e.unidad || !(e.rendimiento > 0))?.descripcion ??
      payload.manoObra.find((m) => !(m.rendimiento > 0))?.categoria;
    if (invalida) {
      setError(`Revisá la línea "${invalida}": necesita unidad y una cantidad mayor que 0.`);
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch("/api/subrubros-estandar/crear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "No se pudo crear el rubro. Probá de nuevo.");
      onCreado(data as RubroCatalogoCreado);
    } catch (err) {
      setError((err as Error).message);
      setGuardando(false);
    }
  };

  const actualizar = <T,>(set: React.Dispatch<React.SetStateAction<T[]>>, i: number, cambio: Partial<T>) =>
    set((filas) => filas.map((f, j) => (j === i ? { ...f, ...cambio } : f)));
  const quitar = <T,>(set: React.Dispatch<React.SetStateAction<T[]>>, i: number) =>
    set((filas) => filas.filter((_, j) => j !== i));

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={guardando ? undefined : onClose} />
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-white rounded-[16px] shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
          <h2 className="text-base font-semibold text-[#1A3A5C]">Nuevo rubro del catálogo</h2>
          <button onClick={onClose} disabled={guardando} aria-label="Cerrar" className="text-slate-400 hover:text-slate-600 disabled:opacity-40">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5 overflow-y-auto flex-1">
          {/* Datos del rubro */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block sm:col-span-2">
              <span className="block text-xs font-medium text-slate-600 mb-1">Capítulo</span>
              <select value={capituloId} onChange={(e) => setCapituloId(e.target.value)} className={cn(campo, "bg-white")}>
                {capitulos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
                <option value={NUEVO_CAPITULO}>Nuevo capítulo…</option>
              </select>
            </label>
            {esCapituloNuevo && (
              <label className="block sm:col-span-2">
                <span className="block text-xs font-medium text-slate-600 mb-1">Nombre del capítulo nuevo</span>
                <input value={capituloNuevo} onChange={(e) => setCapituloNuevo(e.target.value)} className={campo} placeholder="Ej: Piscinas" autoFocus />
              </label>
            )}
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Nombre del rubro</span>
              <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className={campo} placeholder="Ej: Muro de ticholo de 12 cm" />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Unidad</span>
              <input value={unidad} onChange={(e) => setUnidad(e.target.value)} className={campo} placeholder="m2, ml, m3, u, gl, kg" list="unidades-rubro" />
            </label>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} className="w-4 h-4 accent-[#2563EB]" />
            Activo <span className="text-xs text-slate-400">(un rubro inactivo no aparece en el catálogo ni en Cálculo Rápido)</span>
          </label>

          <datalist id="unidades-rubro">
            {["m2", "ml", "m3", "u", "gl", "kg", "lt", "hr", "día", "bolsa"].map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>

          {/* APU — Materiales */}
          <SeccionLineas
            titulo="Materiales"
            icono={<Package className="w-4 h-4 text-[#2563EB]" />}
            ayuda="Cantidad por unidad de rubro. Si la descripción coincide con el catálogo de materiales se usa su precio; si no, el precio que cargues."
            encabezados={["Descripción", "Unidad", "Cantidad", "Precio $ (opc.)"]}
            onAgregar={() => setMateriales((f) => [...f, filaMaterialVacia()])}
            textoAgregar="Agregar material"
          >
            {materiales.map((m, i) => (
              <FilaLinea key={i} onQuitar={() => quitar(setMateriales, i)}>
                <input value={m.descripcion} onChange={(e) => actualizar(setMateriales, i, { descripcion: e.target.value })} className={campoChico} placeholder="Ej: Ticholo 12x25x25" />
                <input value={m.unidad} onChange={(e) => actualizar(setMateriales, i, { unidad: e.target.value })} className={campoChico} placeholder="u" list="unidades-rubro" />
                <input value={m.rendimiento} onChange={(e) => actualizar(setMateriales, i, { rendimiento: e.target.value })} className={cn(campoChico, "text-right tabular-nums")} inputMode="decimal" placeholder="0,00" />
                <input value={m.precio} onChange={(e) => actualizar(setMateriales, i, { precio: e.target.value })} className={cn(campoChico, "text-right tabular-nums")} inputMode="decimal" placeholder="—" />
              </FilaLinea>
            ))}
          </SeccionLineas>

          {/* APU — Mano de obra */}
          <SeccionLineas
            titulo="Mano de obra"
            icono={<Hammer className="w-4 h-4 text-[#2563EB]" />}
            ayuda="Rendimiento = unidades de rubro por jornada de 8 h. El jornal sale de la categoría SUNCA vigente."
            encabezados={["Categoría", "Rendimiento (por jornada)"]}
            columnas="manoObra"
            onAgregar={() => setManoObra((f) => [...f, filaManoObraVacia()])}
            textoAgregar="Agregar mano de obra"
          >
            {manoObra.map((m, i) => (
              <FilaLinea key={i} columnas="manoObra" onQuitar={() => quitar(setManoObra, i)}>
                <select value={m.categoria} onChange={(e) => actualizar(setManoObra, i, { categoria: e.target.value })} className={cn(campoChico, "bg-white")}>
                  <option value="">Elegí una categoría…</option>
                  {categorias.map((c) => (
                    <option key={c.nombre} value={c.nombre}>
                      {c.nombre} — $ {c.jornal.toLocaleString("es-UY")}
                    </option>
                  ))}
                </select>
                <input value={m.rendimiento} onChange={(e) => actualizar(setManoObra, i, { rendimiento: e.target.value })} className={cn(campoChico, "text-right tabular-nums")} inputMode="decimal" placeholder="0,00" />
              </FilaLinea>
            ))}
          </SeccionLineas>

          {/* APU — Equipos */}
          <SeccionLineas
            titulo="Equipos"
            icono={<Wrench className="w-4 h-4 text-[#2563EB]" />}
            ayuda="Cantidad por unidad de rubro. Si la descripción coincide con el catálogo de equipos se usa su costo; si no, el que cargues."
            encabezados={["Descripción", "Unidad", "Cantidad", "Costo $ (opc.)"]}
            onAgregar={() => setEquipos((f) => [...f, filaEquipoVacia()])}
            textoAgregar="Agregar equipo"
          >
            {equipos.map((e, i) => (
              <FilaLinea key={i} onQuitar={() => quitar(setEquipos, i)}>
                <input value={e.descripcion} onChange={(ev) => actualizar(setEquipos, i, { descripcion: ev.target.value })} className={campoChico} placeholder="Ej: Hormigonera" />
                <input value={e.unidad} onChange={(ev) => actualizar(setEquipos, i, { unidad: ev.target.value })} className={campoChico} placeholder="hr" list="unidades-rubro" />
                <input value={e.rendimiento} onChange={(ev) => actualizar(setEquipos, i, { rendimiento: ev.target.value })} className={cn(campoChico, "text-right tabular-nums")} inputMode="decimal" placeholder="0,00" />
                <input value={e.costo} onChange={(ev) => actualizar(setEquipos, i, { costo: ev.target.value })} className={cn(campoChico, "text-right tabular-nums")} inputMode="decimal" placeholder="—" />
              </FilaLinea>
            ))}
          </SeccionLineas>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={guardando}
            className="px-4 py-2 rounded-[8px] text-sm font-medium text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={!puedeGuardar}
            className="flex items-center gap-2 px-4 py-2 rounded-[8px] text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] transition-colors disabled:opacity-50"
          >
            {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
            {guardando ? "Guardando…" : "Crear rubro"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Columnas de cada fila: descripción ancha + 3 chicas, o (mano de obra) categoría + rendimiento.
const GRILLA = {
  general: "grid-cols-[minmax(0,1fr)_64px_84px_96px_28px]",
  manoObra: "grid-cols-[minmax(0,1fr)_150px_28px]",
} as const;

function SeccionLineas({
  titulo,
  icono,
  ayuda,
  encabezados,
  columnas = "general",
  onAgregar,
  textoAgregar,
  children,
}: {
  titulo: string;
  icono: React.ReactNode;
  ayuda: string;
  encabezados: string[];
  columnas?: keyof typeof GRILLA;
  onAgregar: () => void;
  textoAgregar: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[12px] border border-slate-200">
      <div className="px-4 pt-3 pb-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-[#1A3A5C]">
          {icono}
          {titulo}
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">{ayuda}</p>
      </div>
      <div className="px-4 pb-3 space-y-1.5 overflow-x-auto">
        <div className={cn("grid gap-2 min-w-[420px] text-[11px] font-medium uppercase tracking-wide text-slate-400", GRILLA[columnas])}>
          {encabezados.map((e, i) => (
            <span key={e} className={i > 1 && columnas === "general" ? "text-right" : undefined}>
              {e}
            </span>
          ))}
        </div>
        {children}
        <button onClick={onAgregar} type="button" className="flex items-center gap-1 text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] pt-1">
          <Plus className="w-3.5 h-3.5" />
          {textoAgregar}
        </button>
      </div>
    </div>
  );
}

function FilaLinea({
  columnas = "general",
  onQuitar,
  children,
}: {
  columnas?: keyof typeof GRILLA;
  onQuitar: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid gap-2 items-center min-w-[420px]", GRILLA[columnas])}>
      {children}
      <button onClick={onQuitar} type="button" aria-label="Quitar línea" className="text-slate-300 hover:text-red-500 justify-self-center">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
