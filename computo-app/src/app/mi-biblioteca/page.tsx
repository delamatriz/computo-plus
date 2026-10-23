"use client";

import { useEffect, useState } from "react";
import { Bookmark, ChevronDown, ChevronRight, Hammer, Loader2, Package, Search, Trash2, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { BotonVolverAlProyecto } from "@/components/shared/BotonVolverAlProyecto";
import { EncabezadosAPU, textoRendimientoMO } from "@/components/shared/EncabezadosAPU";

// Biblioteca personal de rubros de la empresa (SubrubroEmpresa) — se llena
// desde "Guardar en Mis rubros" en cada fila de rubro del proyecto. Solo
// consulta y eliminación por ahora (sin edición).

// ── Tipos (respuesta de GET /api/mi-biblioteca) ────────────────────────

interface MaterialEmpresa {
  id: string;
  descripcion: string;
  unidad: string;
  cantidad: number;
  precioUnit: number;
  precioTotal: number;
  precioMTOPId: string | null;
}

interface EquipoEmpresa {
  id: string;
  descripcion: string;
  unidad: string;
  cantidad: number;
  costoUnit: number;
  costoTotal: number;
}

interface ManoObraEmpresa {
  id: string;
  categoria: string;
  cantidad: number;
  jornal: number;
  costoTotal: number;
  jornadasHoras: number | null;
}

interface APUEmpresa {
  id: string;
  materiales: MaterialEmpresa[];
  equipos: EquipoEmpresa[];
  manoObra: ManoObraEmpresa[];
  costoMateriales: number;
  costoEquipos: number;
  costoManoObra: number;
  costoTotal: number;
}

interface SubrubroEmpresa {
  id: string;
  nombre: string;
  unidad: string;
  precioUY: number;
  codigo: string | null;
  createdAt: string;
  apus: APUEmpresa[];
}

// ── Helpers ────────────────────────────────────────────────────────────

const fmtMoneda = (v: number) =>
  new Intl.NumberFormat("es-UY", { style: "currency", currency: "UYU", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
const fmtNum = (v: number, dec = 2) =>
  new Intl.NumberFormat("es-UY", { minimumFractionDigits: 0, maximumFractionDigits: dec }).format(v);
const fmtFecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-UY", { day: "2-digit", month: "short", year: "numeric" });

// ── Descompuesto ───────────────────────────────────────────────────────

// Anchos de las columnas numéricas de FilaInsumo — los encabezados usan los mismos.
const ANCHO_DETALLE = "w-36";
const ANCHO_PRECIO = "hidden sm:inline w-24";
const ANCHO_TOTAL = "w-24";

function SeccionAPU({
  titulo,
  icono,
  columnas,
  children,
}: {
  titulo: string;
  icono: React.ReactNode;
  columnas: React.ComponentProps<typeof EncabezadosAPU>["columnas"];
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        {icono}
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">{titulo}</h3>
      </div>
      <EncabezadosAPU columnas={columnas} />
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function FilaInsumo({ descripcion, detalle, precio, subtotal, aviso }: { descripcion: string; detalle: string; precio: string; subtotal: number; aviso?: string }) {
  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-50 text-sm">
      <div className="flex-1 min-w-0 flex items-center gap-1.5">
        <span className="text-slate-700 truncate">{descripcion}</span>
        {aviso && (
          <span title={aviso} className="flex-shrink-0 text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-px">
            precio fijo
          </span>
        )}
      </div>
      <span className={cn("flex-shrink-0 text-slate-400 text-xs text-right", ANCHO_DETALLE)}>{detalle}</span>
      <span className={cn("flex-shrink-0 text-xs text-right text-slate-500", ANCHO_PRECIO)}>{precio}</span>
      <span className={cn("flex-shrink-0 font-semibold text-slate-700 text-xs text-right", ANCHO_TOTAL)}>{fmtMoneda(subtotal)}</span>
    </div>
  );
}

function Descompuesto({ apu, unidad, precioUY }: { apu: APUEmpresa; unidad: string; precioUY: number }) {
  return (
    <div className="px-5 py-5 space-y-6 border-t border-slate-100">
      {apu.materiales.length > 0 && (
        <SeccionAPU
          titulo="Materiales"
          icono={<Package className="w-3.5 h-3.5 text-slate-400" />}
          columnas={[
            { label: "Descripción" },
            { label: "Cantidad", ancho: ANCHO_DETALLE, title: "Cantidad de material por unidad de rubro" },
            { label: "Precio unit.", ancho: ANCHO_PRECIO },
            { label: "Total", ancho: ANCHO_TOTAL, title: "Cantidad × precio unitario" },
          ]}
        >
          {apu.materiales.map((m) => (
            <FilaInsumo
              key={m.id}
              descripcion={m.descripcion}
              detalle={`${fmtNum(m.cantidad, 4)} ${m.unidad}`}
              precio={fmtMoneda(m.precioUnit)}
              subtotal={m.precioTotal}
              aviso={m.precioMTOPId ? undefined : "Sin vínculo a la Lista MTOP / catálogo: precio cargado a mano en el proyecto."}
            />
          ))}
        </SeccionAPU>
      )}
      {apu.manoObra.length > 0 && (
        <SeccionAPU
          titulo="Mano de obra"
          icono={<Hammer className="w-3.5 h-3.5 text-slate-400" />}
          columnas={[
            { label: "Categoría" },
            { label: "Rendimiento", ancho: ANCHO_DETALLE, title: `Unidades de rubro (${unidad}) producidas por jornada` },
            { label: "Jornal", ancho: ANCHO_PRECIO, title: "Jornal de referencia por jornada completa" },
            { label: "Total", ancho: ANCHO_TOTAL, title: `Costo de mano de obra por ${unidad}` },
          ]}
        >
          {apu.manoObra.map((mo) => (
            <FilaInsumo
              key={mo.id}
              descripcion={mo.categoria}
              detalle={textoRendimientoMO(mo.cantidad, unidad, mo.jornadasHoras ?? 8)}
              precio={fmtMoneda(mo.jornal)}
              subtotal={mo.costoTotal}
            />
          ))}
        </SeccionAPU>
      )}
      {apu.equipos.length > 0 && (
        <SeccionAPU
          titulo="Equipos"
          icono={<Wrench className="w-3.5 h-3.5 text-slate-400" />}
          columnas={[
            { label: "Descripción" },
            { label: "Cantidad", ancho: ANCHO_DETALLE, title: "Cantidad de equipo por unidad de rubro" },
            { label: "Costo unit.", ancho: ANCHO_PRECIO },
            { label: "Total", ancho: ANCHO_TOTAL, title: "Cantidad × costo unitario" },
          ]}
        >
          {apu.equipos.map((eq) => (
            <FilaInsumo
              key={eq.id}
              descripcion={eq.descripcion}
              detalle={`${fmtNum(eq.cantidad, 4)} ${eq.unidad}`}
              precio={fmtMoneda(eq.costoUnit)}
              subtotal={eq.costoTotal}
            />
          ))}
        </SeccionAPU>
      )}

      <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 space-y-1.5">
        {[
          ["Materiales", apu.costoMateriales],
          ["Mano de obra (con aportes patronales)", apu.costoManoObra],
          ["Equipos", apu.costoEquipos],
        ].map(([label, valor]) => (
          <div key={label as string} className="flex items-center justify-between text-xs text-slate-500">
            <span>{label}</span>
            <span className="font-medium text-slate-700">{fmtMoneda(valor as number)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-1.5 mt-1.5 border-t border-slate-200">
          <span>Costo directo</span>
          <span className="font-medium text-slate-700">{fmtMoneda(apu.costoTotal)}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Utilidad</span>
          <span className="font-medium text-slate-700">{fmtMoneda(precioUY - apu.costoTotal)}</span>
        </div>
        <div className="flex items-center justify-between pt-1.5 mt-1.5 border-t border-slate-200">
          <span className="text-sm font-bold text-[#1A3A5C]">Precio unitario</span>
          <span className="text-base font-bold text-[#2563EB]">
            {fmtMoneda(precioUY)} <span className="text-xs font-medium text-slate-400">/ {unidad}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

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
      <div className="flex items-center gap-3 px-5 py-4">
        <button
          onClick={() => setAbierto((v) => !v)}
          disabled={!apu}
          aria-expanded={abierto}
          className="flex-1 min-w-0 flex items-center gap-3 text-left disabled:cursor-default"
        >
          <span className="flex-shrink-0 text-slate-400">
            {abierto ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold text-[#1E293B] truncate">{subrubro.nombre}</span>
            <span className="block text-xs text-slate-400 mt-0.5">
              {subrubro.codigo && <>Rubro {subrubro.codigo} · </>}Guardado el {fmtFecha(subrubro.createdAt)}
            </span>
          </span>
          <span className="flex-shrink-0 text-right">
            <span className="block text-sm font-bold text-[#2563EB]">{fmtMoneda(subrubro.precioUY)}</span>
            <span className="block text-xs text-slate-400">por {subrubro.unidad}</span>
          </span>
        </button>

        <div className="flex-shrink-0 w-[132px] flex justify-end">
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

  const vacia = !cargando && !error && !hayAlguno && !filtro.trim();

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      <div className="mb-6">
        <BotonVolverAlProyecto />
        <h1 className="text-2xl font-semibold text-[#1A3A5C] mb-1">Mis rubros</h1>
        <p className="text-slate-500 text-sm">
          Tus rubros favoritos, listos para reutilizar. Guardá cualquier rubro desde un proyecto y aparece acá con
          su APU completo.
          {!cargando && subrubros.length > 0 && !filtro.trim() && (
            <span className="text-slate-400"> {subrubros.length} {subrubros.length === 1 ? "rubro guardado" : "rubros guardados"}.</span>
          )}
        </p>
        {/* "Guardar en Mis rubros" es el tooltip exacto del botón de cada fila de rubro del presupuesto. */}
        <p className="text-slate-400 text-xs mt-1">
          Para guardar un rubro: abrí un proyecto → presupuesto → hacé clic en{" "}
          <span className="font-medium text-slate-500">Guardar en Mis rubros</span> al lado de cualquier rubro.
        </p>
      </div>

      {vacia ? (
        <div className="flex flex-col items-center justify-center text-center bg-white rounded-2xl border border-slate-200 border-dashed py-16 px-6">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-4">
            <Bookmark className="w-5 h-5 text-[#2563EB]" />
          </div>
          <p className="text-sm text-slate-500 max-w-sm">
            Todavía no guardaste ningún rubro. Guardalos desde tus proyectos para reutilizarlos.
          </p>
        </div>
      ) : (
        <>
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
    </div>
  );
}
