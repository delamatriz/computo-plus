"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Bookmark, CheckCircle2, ChevronDown, ChevronRight, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { BotonVolverAlProyecto } from "@/components/shared/BotonVolverAlProyecto";
import { Descompuesto, fmtMoneda, type SubrubroEmpresa } from "@/components/mi-biblioteca/DescompuestoEmpresa";
import { ModalNuevoRubroEmpresa } from "@/components/mi-biblioteca/ModalNuevoRubroEmpresa";
import type { RubroEmpresaCreado } from "@/lib/rubroEmpresaNuevo";

// Biblioteca personal de rubros de la empresa (SubrubroEmpresa) — se llena
// desde "Guardar en Mis rubros" en cada fila de rubro del proyecto o con
// "Nuevo rubro" (alta desde cero). Consulta, alta y eliminación (sin edición).

// ── Helpers ─────────────────────────────────────────────────────────────────

const fmtFecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-UY", { day: "2-digit", month: "short", year: "numeric" });

// ── Card ───────────────────────────────────────────────────────────────

function CardSubrubro({ subrubro, onEliminado }: { subrubro: SubrubroEmpresa; onEliminado: (id: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const apu = subrubro.apus[0];

  const eliminar = async () => {
    setEliminando(true);
    try {
      const res = await fetch(`/api/mi-biblioteca/${subrubro.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onEliminado(subrubro.id);
    } catch (err) {
      console.error("[eliminar rubro de mi biblioteca]", err);
      window.alert("No se pudo quitar el rubro de Mis rubros.");
      setEliminando(false);
      setConfirmando(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Mobile: el nombre ocupa el ancho completo (sin cortar) y el precio
          baja a la derecha, debajo. Desde sm: una sola fila, nombre truncado. */}
      <div className="flex items-start sm:items-center gap-3 px-4 sm:px-5 py-4">
        <button
          onClick={() => setAbierto((v) => !v)}
          disabled={!apu}
          aria-expanded={abierto}
          className="flex-1 min-w-0 flex items-start sm:items-center gap-3 text-left disabled:cursor-default"
        >
          <span className="flex-shrink-0 text-slate-400 mt-0.5 sm:mt-0">
            {abierto ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </span>
          <span className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold text-[#1E293B] break-words sm:truncate">{subrubro.nombre}</span>
              <span className="block text-xs text-slate-400 mt-0.5">
                {subrubro.codigo && <>Rubro {subrubro.codigo} · </>}{subrubro.codigo ? "Guardado" : "Creado"} el {fmtFecha(subrubro.createdAt)}
              </span>
            </span>
            <span className="flex-shrink-0 self-end sm:self-auto text-right">
              <span className="block text-sm font-bold text-[#2563EB] whitespace-nowrap">{fmtMoneda(subrubro.precioUY)}</span>
              <span className="block text-xs text-slate-400">por {subrubro.unidad}</span>
            </span>
          </span>
        </button>

        <div className="flex-shrink-0 sm:w-[132px] flex justify-end">
          {confirmando ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500">¿Eliminar?</span>
              <button
                onClick={eliminar}
                disabled={eliminando}
                className="text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-md px-2 py-1 disabled:opacity-60"
              >
                {eliminando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Sí"}
              </button>
              <button
                onClick={() => setConfirmando(false)}
                disabled={eliminando}
                className="text-xs font-medium text-slate-500 hover:text-slate-700 rounded-md px-2 py-1"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmando(true)}
              title="Quitar de Mis rubros"
              aria-label="Quitar de Mis rubros"
              className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {abierto && apu && <Descompuesto apu={apu} unidad={subrubro.unidad} precioUY={subrubro.precioUY} />}
    </div>
  );
}

// ── Página ─────────────────────────────────────────────────────────────

export default function MiBibliotecaPage() {
  const [subrubros, setSubrubros] = useState<SubrubroEmpresa[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState("");
  // Total sin filtro: distingue "biblioteca vacía" de "la búsqueda no encontró nada".
  const [hayAlguno, setHayAlguno] = useState(false);
  const [modalNuevoAbierto, setModalNuevoAbierto] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; advertencia: boolean } | null>(null);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), aviso.advertencia ? 8000 : 3500);
    return () => clearTimeout(t);
  }, [aviso]);

  useEffect(() => {
    const q = filtro.trim();
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setCargando(true);
      fetch(`/api/mi-biblioteca${q ? `?q=${encodeURIComponent(q)}` : ""}`, { signal: controller.signal })
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((data: SubrubroEmpresa[]) => {
          setSubrubros(data);
          setError(null);
          if (!q) setHayAlguno(data.length > 0);
        })
        .catch((err) => {
          if (err?.name === "AbortError") return;
          console.error("[GET /api/mi-biblioteca]", err);
          setError("No se pudieron cargar tus rubros.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setCargando(false);
        });
    }, q ? 250 : 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [filtro]);

  const quitar = (id: string) => {
    const siguiente = subrubros.filter((s) => s.id !== id);
    setSubrubros(siguiente);
    if (!filtro.trim()) setHayAlguno(siguiente.length > 0);
  };

  // Rubro creado desde cero: se suma a la lista sin recargar. Con una
  // búsqueda activa se limpia el filtro (la lista se vuelve a pedir entera).
  const alCrearRubro = ({ subrubro, lineasSinPrecio }: RubroEmpresaCreado<SubrubroEmpresa>) => {
    setModalNuevoAbierto(false);
    setHayAlguno(true);
    if (filtro.trim()) setFiltro("");
    else setSubrubros((lista) => [...lista, subrubro].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")));
    setAviso(
      lineasSinPrecio.length > 0
        ? { texto: `Rubro creado. Sin precio: ${lineasSinPrecio.join(", ")}.`, advertencia: true }
        : { texto: "Rubro creado en Mis rubros.", advertencia: false }
    );
  };

  const vacia = !cargando && !error && !hayAlguno && !filtro.trim();

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      <div className="mb-6">
        <BotonVolverAlProyecto />
        <div className="flex items-center justify-between gap-3 mb-1">
          <h1 className="text-2xl font-semibold text-[#1A3A5C]">Mis rubros</h1>
          <button
            onClick={() => setModalNuevoAbierto(true)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-[8px] text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nuevo rubro
          </button>
        </div>
        <p className="text-slate-500 text-sm">
          Tus rubros favoritos, listos para reutilizar. Guardá cualquier rubro desde un proyecto y aparece acá con
          su APU completo.
          {!cargando && subrubros.length > 0 && !filtro.trim() && (
            <span className="text-slate-400"> {subrubros.length} {subrubros.length === 1 ? "rubro guardado" : "rubros guardados"}.</span>
          )}
        </p>
        {/* "Guardar en Mis rubros" es el tooltip exacto del botón de cada fila de rubro del presupuesto. */}
        <p className="text-slate-400 text-xs mt-1">
          Para guardar un rubro abrí cualquier proyecto, entrá al presupuesto y usá el botón{" "}
          <span className="font-medium text-slate-500">Guardar en Mis rubros</span> que aparece en cada rubro, o
          creá uno desde cero con <span className="font-medium text-slate-500">Nuevo rubro</span>.
        </p>
      </div>

      {vacia ? (
        <div className="flex flex-col items-center justify-center text-center bg-white rounded-2xl border border-slate-200 border-dashed py-16 px-6">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-4">
            <Bookmark className="w-5 h-5 text-[#2563EB]" />
          </div>
          <p className="text-sm text-slate-500 max-w-sm">
            Todavía no guardaste ningún rubro. Guardalos desde tus proyectos para reutilizarlos, o creá uno con Nuevo rubro.
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-400 mb-1.5">Buscá entre tus rubros guardados</p>
          <div className="relative mb-4">
            <Search className="w-4 h-4 text-slate-300 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Buscá por nombre del rubro…"
              aria-label="Buscar rubro por nombre"
              className="w-full pl-9 pr-3 py-2.5 text-sm bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30 focus:border-[#2563EB]/40 placeholder:text-slate-300"
            />
          </div>

          {error ? (
            <div className="bg-white rounded-2xl border border-red-200 px-6 py-10 text-center text-sm text-red-600">{error}</div>
          ) : cargando && subrubros.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 px-6 py-16 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-slate-300 mx-auto" />
            </div>
          ) : subrubros.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 border-dashed px-6 py-12 text-center text-sm text-slate-400">
              Ninguno de tus rubros coincide con “{filtro.trim()}”.
            </div>
          ) : (
            <div className={cn("space-y-3 transition-opacity", cargando && "opacity-60")}>
              {subrubros.map((s) => (
                <CardSubrubro key={s.id} subrubro={s} onEliminado={quitar} />
              ))}
            </div>
          )}
        </>
      )}

      {modalNuevoAbierto && (
        <ModalNuevoRubroEmpresa<SubrubroEmpresa> onClose={() => setModalNuevoAbierto(false)} onCreado={alCrearRubro} />
      )}

      {aviso && (
        <div
          role="status"
          className={cn(
            "fixed bottom-5 left-1/2 -translate-x-1/2 z-[130] flex items-center gap-2 rounded-[10px] px-4 py-2.5 shadow-lg max-w-[calc(100vw-32px)] border",
            aviso.advertencia ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"
          )}
        >
          {aviso.advertencia ? (
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          )}
          <span className={cn("text-sm font-medium", aviso.advertencia ? "text-amber-800" : "text-emerald-800")}>{aviso.texto}</span>
        </div>
      )}
    </div>
  );
}
