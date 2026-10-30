"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { campo, DescripcionYSugerirAPU, EditorAPU, ID_LISTA_UNIDADES, useEditorAPU } from "@/components/rubros/EditorAPU";
import type { RubroEmpresaCreado, RubroEmpresaNuevo } from "@/lib/rubroEmpresaNuevo";

// Alta de un rubro desde cero en Mis rubros (/mi-biblioteca), sin pasar por
// un proyecto — cualquier usuario logueado. Mismo editor de APU que el alta
// en el catálogo global; acá la lista es plana (sin capítulo) y el precio
// que se carga manda: el catálogo solo completa las líneas que van sin precio.

export function ModalNuevoRubroEmpresa<TSubrubro>({
  onClose,
  onCreado,
}: {
  onClose: () => void;
  onCreado: (creado: RubroEmpresaCreado<TSubrubro>) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [unidad, setUnidad] = useState("");
  // Solo para "Sugerir APU" (no se guarda con el rubro).
  const [detalle, setDetalle] = useState("");
  const editor = useEditorAPU();
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const payload: RubroEmpresaNuevo = { nombre: nombre.trim(), unidad: unidad.trim(), ...editor.lineas };
  const puedeGuardar = !guardando && !editor.sugiriendo && payload.nombre.length > 0 && payload.unidad.length > 0 && editor.cantidadLineas > 0;

  const guardar = async () => {
    if (editor.errorLineas) {
      setError(editor.errorLineas);
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch("/api/mi-biblioteca/crear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "No se pudo crear el rubro. Probá de nuevo.");
      onCreado(data as RubroEmpresaCreado<TSubrubro>);
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
          <h2 className="text-base font-semibold text-[#1A3A5C]">Nuevo rubro en Mis rubros</h2>
          <button onClick={onClose} disabled={guardando} aria-label="Cerrar" className="text-slate-400 hover:text-slate-600 disabled:opacity-40">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_180px] gap-4">
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Nombre del rubro</span>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={campo} placeholder="Ej: Muro de ticholo de 12 cm" autoFocus />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Unidad</span>
              <input value={unidad} onChange={(e) => setUnidad(e.target.value)} className={campo} placeholder="m2, ml, u, gl, kg" list={ID_LISTA_UNIDADES} />
            </label>
          </div>
          <DescripcionYSugerirAPU
            editor={editor}
            nombre={nombre}
            unidad={unidad}
            descripcion={detalle}
            onDescripcion={setDetalle}
            deshabilitado={guardando}
          />

          <EditorAPU
            editor={editor}
            ayudaMateriales="Cantidad por unidad de rubro. Si cargás el precio se usa ese; si lo dejás vacío se busca en el catálogo de materiales."
            ayudaEquipos="Cantidad por unidad de rubro. Si cargás el costo se usa ese; si lo dejás vacío se busca en el catálogo de equipos."
          />

          <p className="text-xs text-slate-400">
            Los precios quedan fijos en Mis rubros, como cuando guardás un rubro desde un proyecto. Utilidad 10 %.
          </p>
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
