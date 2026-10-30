"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { campo, DescripcionYSugerirAPU, EditorAPU, ID_LISTA_UNIDADES, useEditorAPU } from "@/components/rubros/EditorAPU";
import type { RubroCatalogoCreado, RubroCatalogoNuevo } from "@/lib/rubroCatalogoNuevo";

// Alta de un rubro en el catálogo global (/rubros) — solo SUPERADMIN.
// El APU se carga en filas simples (EditorAPU). Los precios se resuelven en
// el servidor contra el catálogo de materiales/equipos y los jornales SUNCA;
// el precio que se carga es solo el respaldo.

const NUEVO_CAPITULO = "__nuevo__";

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
  // Solo para "Sugerir APU" (no se guarda con el rubro).
  const [detalle, setDetalle] = useState("");
  const editor = useEditorAPU();
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const esCapituloNuevo = capituloId === NUEVO_CAPITULO;

  const payload: RubroCatalogoNuevo = {
    capituloId: esCapituloNuevo ? null : capituloId,
    capituloNuevo: esCapituloNuevo ? capituloNuevo.trim() : null,
    descripcion: descripcion.trim(),
    unidad: unidad.trim(),
    activo,
    ...editor.lineas,
  };

  const puedeGuardar =
    !guardando &&
    !editor.sugiriendo &&
    payload.descripcion.length > 0 &&
    payload.unidad.length > 0 &&
    (!esCapituloNuevo || (payload.capituloNuevo ?? "").length > 0) &&
    editor.cantidadLineas > 0;

  const guardar = async () => {
    if (editor.errorLineas) {
      setError(editor.errorLineas);
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
              <input value={unidad} onChange={(e) => setUnidad(e.target.value)} className={campo} placeholder="m2, ml, m3, u, gl, kg" list={ID_LISTA_UNIDADES} />
            </label>
          </div>
          <DescripcionYSugerirAPU
            editor={editor}
            nombre={descripcion}
            unidad={unidad}
            descripcion={detalle}
            onDescripcion={setDetalle}
            deshabilitado={guardando}
          />
          <label className="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} className="w-4 h-4 accent-[#2563EB]" />
            Activo <span className="text-xs text-slate-400">(un rubro inactivo no aparece en el catálogo ni en Cálculo Rápido)</span>
          </label>

          <EditorAPU
            editor={editor}
            ayudaMateriales="Cantidad por unidad de rubro. Si la descripción coincide con el catálogo de materiales se usa su precio; si no, el precio que cargues."
            ayudaEquipos="Cantidad por unidad de rubro. Si la descripción coincide con el catálogo de equipos se usa su costo; si no, el que cargues."
          />

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
