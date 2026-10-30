"use client";

import { useEffect, useMemo, useState } from "react";
import { Hammer, Loader2, Package, Plus, Sparkles, Trash2, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApuSugerido, EquipoRubroNuevo, ManoObraRubroNuevo, MaterialRubroNuevo } from "@/lib/rubroCatalogoNuevo";

// Editor de APU en filas simples (materiales, mano de obra, equipos) para dar
// de alta un rubro desde cero — lo usan el catálogo global (/rubros, solo
// SUPERADMIN) y Mis rubros (/mi-biblioteca). El DrawerAPU del proyecto está
// atado a un rubro de proyecto y no sirve para esto. El estado vive en
// useEditorAPU(); <EditorAPU> solo dibuja las filas.

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

/** id del <datalist> de unidades que dibuja <EditorAPU> (sirve también para la unidad del rubro). */
export const ID_LISTA_UNIDADES = "unidades-rubro";

// "0,35" o "0.35" → 0.35; con coma decimal, los puntos son de miles
// ("1.250,5" → 1250.5). Vacío o inválido → NaN.
const aNumero = (s: string) => {
  const t = s.trim();
  if (!t) return NaN;
  return Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
};
const numeroOpcional = (s: string) => {
  const n = aNumero(s);
  return n > 0 ? n : null;
};
// 0.035 → "0,035" (coma decimal, sin separador de miles: aNumero lo vuelve a leer igual).
const aTexto = (n: number) => n.toLocaleString("es-UY", { maximumFractionDigits: 4, useGrouping: false });

export const campo =
  "w-full rounded-[8px] border border-slate-200 px-3 py-2 text-sm text-[#1E293B] placeholder:text-slate-300 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100";
const campoChico =
  "w-full min-w-0 rounded-[6px] border border-slate-200 px-2 py-1.5 text-sm text-[#1E293B] placeholder:text-slate-300 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100";

export function useEditorAPU() {
  const [materiales, setMateriales] = useState<FilaMaterial[]>([filaMaterialVacia()]);
  const [manoObra, setManoObra] = useState<FilaManoObra[]>([filaManoObraVacia()]);
  const [equipos, setEquipos] = useState<FilaEquipo[]>([]);
  const [categorias, setCategorias] = useState<CategoriaLaboral[]>([]);

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

  // Líneas listas para mandar al servidor: sin filas vacías, números parseados.
  // El precio/costo cargado viaja como precioReferencia/costoReferencia.
  const lineas = useMemo(
    (): { materiales: MaterialRubroNuevo[]; manoObra: ManoObraRubroNuevo[]; equipos: EquipoRubroNuevo[] } => ({
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
    }),
    [materiales, manoObra, equipos]
  );

  const cantidadLineas = lineas.materiales.length + lineas.manoObra.length + lineas.equipos.length;

  /** Mensaje de error de la primera línea incompleta (sin unidad o cantidad ≤ 0), o null. */
  const errorLineas = (() => {
    const invalida =
      lineas.materiales.find((m) => !m.unidad || !(m.rendimiento > 0))?.descripcion ??
      lineas.equipos.find((e) => !e.unidad || !(e.rendimiento > 0))?.descripcion ??
      lineas.manoObra.find((m) => !(m.rendimiento > 0))?.categoria;
    return invalida ? `Revisá la línea "${invalida}": necesita unidad y una cantidad mayor que 0.` : null;
  })();

  // "Sugerir APU" (POST /api/sugerir-apu-rubro): reemplaza todas las filas
  // por las que sugiere la IA, sin precios (se resuelven al crear el rubro).
  const [sugiriendo, setSugiriendo] = useState(false);
  const [errorSugerencia, setErrorSugerencia] = useState<string | null>(null);

  const sugerirAPU = async (datos: { nombre: string; descripcion: string; unidad: string }) => {
    setSugiriendo(true);
    setErrorSugerencia(null);
    try {
      const res = await fetch("/api/sugerir-apu-rubro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.mensaje || data?.error || "No se pudo sugerir el APU. Probá de nuevo.");
      const apu = data as ApuSugerido;
      const materialesSugeridos = apu.materiales.map((m) => ({ descripcion: m.descripcion, unidad: m.unidad, rendimiento: aTexto(m.cantidad), precio: "" }));
      const manoObraSugerida = apu.manoObra.map((m) => ({ categoria: m.categoria, rendimiento: aTexto(m.rendimiento) }));
      setMateriales(materialesSugeridos.length > 0 ? materialesSugeridos : [filaMaterialVacia()]);
      setManoObra(manoObraSugerida.length > 0 ? manoObraSugerida : [filaManoObraVacia()]);
      setEquipos(apu.equipos.map((e) => ({ descripcion: e.descripcion, unidad: e.unidad, rendimiento: aTexto(e.cantidad), costo: "" })));
    } catch (err) {
      setErrorSugerencia((err as Error).message);
    } finally {
      setSugiriendo(false);
    }
  };

  return {
    materiales, setMateriales,
    manoObra, setManoObra,
    equipos, setEquipos,
    categorias,
    lineas,
    cantidadLineas,
    errorLineas,
    sugerirAPU,
    sugiriendo,
    errorSugerencia,
  };
}

export type EstadoEditorAPU = ReturnType<typeof useEditorAPU>;

export function EditorAPU({
  editor,
  ayudaMateriales,
  ayudaEquipos,
}: {
  editor: EstadoEditorAPU;
  ayudaMateriales: string;
  ayudaEquipos: string;
}) {
  const { materiales, setMateriales, manoObra, setManoObra, equipos, setEquipos, categorias } = editor;

  const actualizar = <T,>(set: React.Dispatch<React.SetStateAction<T[]>>, i: number, cambio: Partial<T>) =>
    set((filas) => filas.map((f, j) => (j === i ? { ...f, ...cambio } : f)));
  const quitar = <T,>(set: React.Dispatch<React.SetStateAction<T[]>>, i: number) =>
    set((filas) => filas.filter((_, j) => j !== i));

  return (
    <>
      <datalist id={ID_LISTA_UNIDADES}>
        {["m2", "ml", "m3", "u", "gl", "kg", "lt", "hr", "día", "bolsa"].map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>

      {/* APU — Materiales */}
      <SeccionLineas
        titulo="Materiales"
        icono={<Package className="w-4 h-4 text-[#2563EB]" />}
        ayuda={ayudaMateriales}
        encabezados={["Descripción", "Unidad", "Cantidad", "Precio $ (opc.)"]}
        onAgregar={() => setMateriales((f) => [...f, filaMaterialVacia()])}
        textoAgregar="Agregar material"
      >
        {materiales.map((m, i) => (
          <FilaLinea key={i} onQuitar={() => quitar(setMateriales, i)}>
            <input value={m.descripcion} onChange={(e) => actualizar(setMateriales, i, { descripcion: e.target.value })} className={campoChico} placeholder="Ej: Ticholo 12x25x25" />
            <input value={m.unidad} onChange={(e) => actualizar(setMateriales, i, { unidad: e.target.value })} className={campoChico} placeholder="u" list={ID_LISTA_UNIDADES} />
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
        ayuda={ayudaEquipos}
        encabezados={["Descripción", "Unidad", "Cantidad", "Costo $ (opc.)"]}
        onAgregar={() => setEquipos((f) => [...f, filaEquipoVacia()])}
        textoAgregar="Agregar equipo"
      >
        {equipos.map((e, i) => (
          <FilaLinea key={i} onQuitar={() => quitar(setEquipos, i)}>
            <input value={e.descripcion} onChange={(ev) => actualizar(setEquipos, i, { descripcion: ev.target.value })} className={campoChico} placeholder="Ej: Hormigonera" />
            <input value={e.unidad} onChange={(ev) => actualizar(setEquipos, i, { unidad: ev.target.value })} className={campoChico} placeholder="hr" list={ID_LISTA_UNIDADES} />
            <input value={e.rendimiento} onChange={(ev) => actualizar(setEquipos, i, { rendimiento: ev.target.value })} className={cn(campoChico, "text-right tabular-nums")} inputMode="decimal" placeholder="0,00" />
            <input value={e.costo} onChange={(ev) => actualizar(setEquipos, i, { costo: ev.target.value })} className={cn(campoChico, "text-right tabular-nums")} inputMode="decimal" placeholder="—" />
          </FilaLinea>
        ))}
      </SeccionLineas>
    </>
  );
}

/**
 * Descripción opcional del rubro + botón "Sugerir APU" (IA). La descripción
 * solo se usa para la sugerencia; no se guarda con el rubro.
 */
export function DescripcionYSugerirAPU({
  editor,
  nombre,
  unidad,
  descripcion,
  onDescripcion,
  deshabilitado = false,
}: {
  editor: EstadoEditorAPU;
  nombre: string;
  unidad: string;
  descripcion: string;
  onDescripcion: (valor: string) => void;
  deshabilitado?: boolean;
}) {
  const { sugerirAPU, sugiriendo, errorSugerencia, cantidadLineas } = editor;
  const puedeSugerir = !deshabilitado && !sugiriendo && nombre.trim().length > 0;
  return (
    <div className="space-y-2">
      <label className="block">
        <span className="block text-xs font-medium text-slate-600 mb-1">
          Descripción <span className="font-normal text-slate-400">(opcional)</span>
        </span>
        <textarea
          value={descripcion}
          onChange={(e) => onDescripcion(e.target.value)}
          rows={2}
          className={cn(campo, "resize-y")}
          placeholder="Ej: muro de ticholo de 12 cm, incluye revoque de ambas caras con mortero común"
        />
      </label>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          onClick={() => sugerirAPU({ nombre: nombre.trim(), descripcion: descripcion.trim(), unidad: unidad.trim() })}
          disabled={!puedeSugerir}
          title={nombre.trim() ? undefined : "Cargá el nombre del rubro para sugerir su APU"}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-sm font-medium text-[#2563EB] bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:hover:bg-blue-50"
        >
          {sugiriendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {sugiriendo ? "Sugiriendo APU…" : "Sugerir APU"}
        </button>
        <span className="text-xs text-slate-400">
          {cantidadLineas > 0 ? "Reemplaza las líneas cargadas abajo. " : ""}Revisá cantidades y rendimientos antes de crear el rubro.
        </span>
      </div>
      {errorSugerencia && <p className="text-sm text-red-600">{errorSugerencia}</p>}
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
