"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Search,
  ChevronRight,
  ChevronDown,
  FileQuestion,
  Loader2,
  Hammer,
  Wrench,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BadgeVerificacion, type FuenteMaterial } from "@/components/BadgeVerificacion";
import { BotonVolverAlProyecto } from "@/components/shared/BotonVolverAlProyecto";
import { EncabezadosAPU, textoRendimientoMO } from "@/components/shared/EncabezadosAPU";
import { useSuperadmin } from "@/hooks/useSuperadmin";
import { fmtRendimiento } from "@/lib/formatoNumeros";

// ── Tipos ──────────────────────────────────────────────────────────────

interface SubrubroNodo {
  id: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  tieneApuEstandar: boolean;
}

interface SubcapituloNodo {
  id: string;
  nombre: string;
  subrubros: SubrubroNodo[];
}

interface CapituloNodo {
  id: string;
  nombre: string;
  subrubrosDirectos: SubrubroNodo[];
  subcapitulos: SubcapituloNodo[];
}

// FuenteMaterial y BadgeVerificacion ahora viven en
// @/components/BadgeVerificacion — compartidos con DrawerAPU (ver
// proyectos/[id]/page.tsx).

interface MaterialDescompuesto {
  id: string;
  descripcion: string;
  unidad: string;
  rendimiento: number;
  precioUnit: number;
  subtotal: number;
  fuente: FuenteMaterial | null;
}

interface ManoObraDescompuesto {
  id: string;
  categoria: string;
  jornadaHs: number;
  rendimiento: number;
  jornalRef: number;
  aporte: number;
}

interface EquipoDescompuesto {
  id: string;
  descripcion: string;
  unidad: string;
  rendimiento: number;
  costoUnit: number;
  subtotal: number;
}

interface Descompuesto {
  id: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  precioUY: number;
  fechaBase: string;
  origen: string;
  capitulo: string | null;
  subcapitulo: string | null;
  apu: {
    utilidadPct: number;
    materiales: MaterialDescompuesto[];
    manoObra: ManoObraDescompuesto[];
    equipos: EquipoDescompuesto[];
    costoDirecto: number;
    precioUnitFinal: number;
  } | null;
}

// ── Helpers de formato ────────────────────────────────────────────────

function fmtMoneda(v: number): string {
  if (!v) return "—";
  return `$ ${v.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtNum(v: number, decimales = 3): string {
  return v.toLocaleString("es-UY", { minimumFractionDigits: 0, maximumFractionDigits: decimales });
}

// SubrubroEstandar.origen de los rubros que conservan el precio de la lista SAU.
const ORIGEN_SAU = "sau_ago2022";
// @default de SubrubroEstandar.fechaBase (schema.prisma).
const FECHA_BASE_DEFAULT = "2022-08";

// SubrubroEstandar.fechaBase se guarda "aaaa-mm" ("2026-07") → "jul-2026".
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function fmtFechaBase(fecha: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(fecha);
  const mes = m ? MESES_CORTOS[Number(m[2]) - 1] : undefined;
  return m && mes ? `${mes}-${m[1]}` : fecha;
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// ── Árbol de navegación ──────────────────────────────────────────────

function ArbolBiblioteca({
  capitulos,
  seleccionadoId,
  onSeleccionar,
  filtro,
}: {
  capitulos: CapituloNodo[];
  seleccionadoId: string | null;
  onSeleccionar: (id: string) => void;
  filtro: string;
}) {
  const [capsAbiertos, setCapsAbiertos] = useState<Set<string>>(new Set());
  const [subcapsAbiertos, setSubcapsAbiertos] = useState<Set<string>>(new Set());

  const filtroActivo = filtro.trim().length > 0;
  const q = norm(filtro.trim());

  // Árbol filtrado por búsqueda — solo quedan las ramas con al menos un match.
  // Si coincide el nombre del capítulo (ej. "demoliciones") queda entero; lo
  // mismo con un subcapítulo. Si no, se filtra rubro por rubro.
  const capitulosFiltrados = useMemo(() => {
    if (!filtroActivo) return capitulos;
    return capitulos
      .map((c) => {
        if (norm(c.nombre).includes(q)) return c;
        const subrubrosDirectos = c.subrubrosDirectos.filter((r) => norm(r.descripcion).includes(q));
        const subcapitulos = c.subcapitulos
          .map((sc) =>
            norm(sc.nombre).includes(q)
              ? sc
              : { ...sc, subrubros: sc.subrubros.filter((r) => norm(r.descripcion).includes(q)) }
          )
          .filter((sc) => sc.subrubros.length > 0);
        return { ...c, subrubrosDirectos, subcapitulos };
      })
      .filter((c) => c.subrubrosDirectos.length > 0 || c.subcapitulos.length > 0);
  }, [capitulos, filtroActivo, q]);

  const capAbierto = (id: string) => filtroActivo || capsAbiertos.has(id);
  const subcapAbierto = (id: string) => filtroActivo || subcapsAbiertos.has(id);

  const toggleCap = (id: string) =>
    setCapsAbiertos((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const toggleSubcap = (id: string) =>
    setSubcapsAbiertos((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const FilaRubro = ({ r }: { r: SubrubroNodo }) => (
    <button
      onClick={() => onSeleccionar(r.id)}
      title={r.descripcion}
      className={cn(
        "w-full flex items-center gap-1.5 text-left pl-3 pr-2 py-1.5 rounded-[6px] text-[13px] transition-colors",
        seleccionadoId === r.id
          ? "bg-brand-pale text-brand-accent font-semibold"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
      )}
    >
      <span className="truncate flex-1">{r.descripcion}</span>
      {!r.tieneApuEstandar && (
        <span title="Sin descompuesto (APU) cargado" className="flex-shrink-0">
          <FileQuestion className="w-3 h-3 text-slate-300" />
        </span>
      )}
    </button>
  );

  if (capitulosFiltrados.length === 0) {
    return (
      <div className="px-3 py-6 text-center text-sm text-slate-400">
        Ningún rubro coincide con &quot;{filtro}&quot;
      </div>
    );
  }

  return (
    <div className="space-y-0.5 pb-2">
      {capitulosFiltrados.map((c) => {
        const totalRubros =
          c.subrubrosDirectos.length + c.subcapitulos.reduce((s, sc) => s + sc.subrubros.length, 0);
        return (
          <div key={c.id}>
            <button
              onClick={() => toggleCap(c.id)}
              className="w-full flex items-center gap-1.5 px-2 py-2 rounded-[6px] text-left hover:bg-slate-50 transition-colors"
            >
              {capAbierto(c.id) ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              )}
              <span className="flex-1 truncate text-[13px] font-bold text-[#1A3A5C]">{c.nombre}</span>
              <span className="flex-shrink-0 text-[10px] font-medium text-slate-400">{totalRubros}</span>
            </button>

            {capAbierto(c.id) && (
              <div className="ml-2 pl-3 border-l border-slate-150" style={{ borderColor: "#EDF2F7" }}>
                {c.subrubrosDirectos.map((r) => (
                  <FilaRubro key={r.id} r={r} />
                ))}
                {c.subcapitulos.map((sc) => (
                  <div key={sc.id}>
                    <button
                      onClick={() => toggleSubcap(sc.id)}
                      className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-[6px] text-left hover:bg-slate-50 transition-colors"
                    >
                      {subcapAbierto(sc.id) ? (
                        <ChevronDown className="w-3 h-3 text-slate-300 flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
                      )}
                      <span className="flex-1 truncate text-[12px] font-semibold text-slate-500 uppercase tracking-wide">
                        {sc.nombre}
                      </span>
                      <span className="flex-shrink-0 text-[10px] font-medium text-slate-400">
                        {sc.subrubros.length}
                      </span>
                    </button>
                    {subcapAbierto(sc.id) && (
                      <div className="ml-2 pl-3 border-l" style={{ borderColor: "#EDF2F7" }}>
                        {sc.subrubros.map((r) => (
                          <FilaRubro key={r.id} r={r} />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}


// ── Panel de descompuesto ───────────────────────────────────────────────

function PanelDescompuesto({ data }: { data: Descompuesto }) {
  const apu = data.apu;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-200">
        <p className="text-xs text-slate-400 mb-1">
          {[data.capitulo, data.subcapitulo].filter(Boolean).join(" › ")}
          {data.codigo && <span className="ml-2 text-slate-300">· {data.codigo}</span>}
        </p>
        <h2 className="text-lg font-bold text-[#1A3A5C] leading-tight">{data.descripcion}</h2>
        <div className="flex items-center gap-4 mt-2">
          <span className="text-xs text-slate-500">
            Unidad: <span className="font-semibold text-slate-700">{data.unidad}</span>
          </span>
          {!!data.precioUY && (
            <span className="text-xs text-slate-400">
              {/* La sigla SAU solo si el rubro conserva el precio de la lista
                  SAU (origen "sau_ago2022"); el resto es "Precio base". La
                  fecha "2022-08" es el @default de fechaBase: en un rubro no
                  SAU no es real (nadie la cargó), así que no se muestra. */}
              {data.origen === ORIGEN_SAU ? "Precio SAU (Sociedad de Arquitectos del Uruguay) base" : "Precio base"}
              {(data.origen === ORIGEN_SAU || data.fechaBase !== FECHA_BASE_DEFAULT) &&
                ` (${fmtFechaBase(data.fechaBase)})`}
              : {fmtMoneda(data.precioUY)}
            </span>
          )}
        </div>
      </div>

      {!apu ? (
        <div className="px-6 py-10 text-center">
          <FileQuestion className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400">Este rubro todavía no tiene descompuesto (APU) cargado en la biblioteca.</p>
        </div>
      ) : (
        <div className="px-6 py-5 space-y-6">
          <SeccionMateriales materiales={apu.materiales} />
          <SeccionManoObra manoObra={apu.manoObra} unidad={data.unidad} />
          {apu.equipos.length > 0 && <SeccionEquipos equipos={apu.equipos} />}

          {/* Solo informa: un material a $0 ("sin precio") deja el total por
              debajo del real. No bloquea la consulta. */}
          {apu.materiales.some((m) => m.precioUnit === 0) && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-800">
                Este rubro tiene materiales sin precio cargado — el precio unitario mostrado está incompleto. Los precios
                faltantes se actualizan desde Materiales.
              </p>
            </div>
          )}

          {/* Resumen final */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Costo directo</span>
              <span className="font-medium text-slate-700">{fmtMoneda(apu.costoDirecto)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Utilidad ({fmtNum(apu.utilidadPct, 1)}%)</span>
              <span className="font-medium text-slate-700">
                {fmtMoneda(apu.precioUnitFinal - apu.costoDirecto)}
              </span>
            </div>
            <div className="flex items-center justify-between pt-1.5 mt-1.5 border-t border-slate-200">
              <span className="text-sm font-bold text-[#1A3A5C]">Precio unitario final</span>
              <span className="text-base font-bold text-[#2563EB]">
                {fmtMoneda(apu.precioUnitFinal)} <span className="text-xs font-medium text-slate-400">/ {data.unidad}</span>
              </span>
            </div>
            {/* Los aportes patronales van solo sobre la mano de obra: sin MO, el precio no cambia en el proyecto. */}
            {apu.manoObra.length > 0 && (
              <p className="text-[11px] text-slate-400 text-right">
                No incluye aportes patronales — al agregar el rubro a un proyecto el precio final será mayor.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SeccionAPU({
  titulo,
  icono,
  children,
}: {
  titulo: string;
  icono: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        {icono}
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">{titulo}</h3>
      </div>
      {children}
    </div>
  );
}

function SeccionMateriales({ materiales }: { materiales: MaterialDescompuesto[] }) {
  // Mismo criterio que /materiales: el cliente ve "Sin verificar", el SUPERADMIN "Pendiente de verificar".
  const esSuperadmin = useSuperadmin() === true;
  if (materiales.length === 0) return null;
  return (
    <SeccionAPU titulo="Materiales" icono={<Package className="w-3.5 h-3.5 text-slate-400" />}>
      <EncabezadosAPU
        columnas={[
          { label: "Descripción" },
          { label: "Cantidad", ancho: "w-24", title: "Cantidad de material por unidad de rubro" },
          { label: "Precio unit.", ancho: "w-20" },
          { label: "Total", ancho: "w-24", title: "Cantidad × precio unitario" },
        ]}
      />
      <div className="space-y-1">
        {materiales.map((m) => (
          <div key={m.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-50 text-sm">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-700 truncate">{m.descripcion}</span>
                {m.fuente && <BadgeVerificacion fuente={m.fuente} etiquetaPendiente={esSuperadmin ? undefined : "Sin verificar"} />}
              </div>
              {m.fuente?.nombreProducto && (
                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                  {(m.fuente.proveedor || m.fuente.notaProcedencia) && (
                    <span className="font-medium text-slate-500">{m.fuente.proveedor || m.fuente.notaProcedencia}</span>
                  )}
                  {(m.fuente.proveedor || m.fuente.notaProcedencia) && " — "}
                  {m.fuente.nombreProducto}
                </p>
              )}
            </div>
            <span className="flex-shrink-0 text-slate-400 text-xs w-24 text-right">
              {fmtRendimiento(m.rendimiento)} {m.unidad}
            </span>
            <span
              className={cn(
                "flex-shrink-0 text-xs w-20 text-right",
                m.precioUnit === 0 ? "text-amber-500 font-medium" : "text-slate-500"
              )}
            >
              {m.precioUnit === 0 ? "sin precio" : fmtMoneda(m.precioUnit)}
            </span>
            <span className="flex-shrink-0 font-semibold text-slate-700 text-xs w-24 text-right">
              {fmtMoneda(m.subtotal)}
            </span>
          </div>
        ))}
      </div>
    </SeccionAPU>
  );
}

// rendimiento = unidades del rubro producidas por jornada de jornadaHs horas
// (la línea de MO no guarda unidad propia: es la del rubro). El total es
// jornal ÷ rendimiento — costo de MO por unidad de rubro.
function SeccionManoObra({ manoObra, unidad }: { manoObra: ManoObraDescompuesto[]; unidad: string }) {
  if (manoObra.length === 0) return null;
  return (
    <SeccionAPU titulo="Mano de obra" icono={<Hammer className="w-3.5 h-3.5 text-slate-400" />}>
      <EncabezadosAPU
        columnas={[
          { label: "Categoría" },
          { label: "Rendimiento", ancho: "w-36", title: `Unidades de rubro (${unidad}) producidas por jornada` },
          { label: "Jornal", ancho: "w-20", title: "Jornal de referencia por jornada completa" },
          { label: "Total", ancho: "w-24", title: `Jornal ÷ rendimiento, por ${unidad}` },
        ]}
      />
      <div className="space-y-1">
        {manoObra.map((mo) => (
          <div key={mo.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-50 text-sm">
            <span className="flex-1 min-w-0 truncate text-slate-700">{mo.categoria}</span>
            <span className="flex-shrink-0 text-slate-400 text-xs w-36 text-right">
              {textoRendimientoMO(mo.rendimiento, unidad, mo.jornadaHs)}
            </span>
            <span
              className={cn(
                "flex-shrink-0 text-xs w-20 text-right",
                mo.jornalRef === 0 ? "text-amber-500 font-medium" : "text-slate-500"
              )}
            >
              {mo.jornalRef === 0 ? "sin jornal" : fmtMoneda(mo.jornalRef)}
            </span>
            <span className="flex-shrink-0 font-semibold text-slate-700 text-xs w-24 text-right">
              {fmtMoneda(mo.aporte)}
            </span>
          </div>
        ))}
      </div>
    </SeccionAPU>
  );
}

function SeccionEquipos({ equipos }: { equipos: EquipoDescompuesto[] }) {
  return (
    <SeccionAPU titulo="Equipos" icono={<Wrench className="w-3.5 h-3.5 text-slate-400" />}>
      <EncabezadosAPU
        columnas={[
          { label: "Descripción" },
          { label: "Cantidad", ancho: "w-24", title: "Cantidad de equipo por unidad de rubro" },
          { label: "Costo unit.", ancho: "w-20" },
          { label: "Total", ancho: "w-24", title: "Cantidad × costo unitario" },
        ]}
      />
      <div className="space-y-1">
        {equipos.map((eq) => (
          <div key={eq.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-50 text-sm">
            <span className="flex-1 min-w-0 truncate text-slate-700">{eq.descripcion}</span>
            <span className="flex-shrink-0 text-slate-400 text-xs w-24 text-right">
              {fmtRendimiento(eq.rendimiento)} {eq.unidad}
            </span>
            <span
              className={cn(
                "flex-shrink-0 text-xs w-20 text-right",
                eq.costoUnit === 0 ? "text-amber-500 font-medium" : "text-slate-500"
              )}
            >
              {eq.costoUnit === 0 ? "sin costo" : fmtMoneda(eq.costoUnit)}
            </span>
            <span className="flex-shrink-0 font-semibold text-slate-700 text-xs w-24 text-right">
              {fmtMoneda(eq.subtotal)}
            </span>
          </div>
        ))}
      </div>
    </SeccionAPU>
  );
}

// ── Página ───────────────────────────────────────────────────────────

export default function BibliotecaPage() {
  const [capitulos, setCapitulos] = useState<CapituloNodo[]>([]);
  const [cargandoArbol, setCargandoArbol] = useState(true);
  const [filtro, setFiltro] = useState("");
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [descompuesto, setDescompuesto] = useState<Descompuesto | null>(null);
  const [cargandoDescompuesto, setCargandoDescompuesto] = useState(false);
  const [errorDescompuesto, setErrorDescompuesto] = useState(false);

  useEffect(() => {
    fetch("/api/subrubros-estandar/jerarquia")
      .then((r) => r.json())
      .then((data) => setCapitulos(data))
      .finally(() => setCargandoArbol(false));
  }, []);

  useEffect(() => {
    if (!seleccionadoId) return;
    setCargandoDescompuesto(true);
    setDescompuesto(null);
    setErrorDescompuesto(false);
    // Si falla (red o error del servidor) se muestra un mensaje — antes se
    // quedaba cargando para siempre.
    fetch(`/api/subrubros-estandar/${seleccionadoId}/descompuesto`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => setDescompuesto(data))
      .catch(() => setErrorDescompuesto(true))
      .finally(() => setCargandoDescompuesto(false));
  }, [seleccionadoId]);

  const totalRubros = useMemo(
    () =>
      capitulos.reduce(
        (s, c) => s + c.subrubrosDirectos.length + c.subcapitulos.reduce((s2, sc) => s2 + sc.subrubros.length, 0),
        0
      ),
    [capitulos]
  );

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-x-5 mb-4">
          <Link
            href="/proyectos"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#2563EB] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Mis Proyectos
          </Link>
          <BotonVolverAlProyecto className="inline-flex max-w-full items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-[#2563EB] transition-colors" />
        </div>
        <h1 className="text-2xl font-semibold text-[#1A3A5C] mb-1">Catálogo de Rubros</h1>
        <p className="text-slate-500 text-sm">
          Explorá los rubros de obra con sus análisis de precios (APU). Hacé clic en un capítulo para ver sus
          rubros y el desglose completo de materiales, mano de obra y equipos.
          {totalRubros > 0 && <span className="text-slate-400"> {totalRubros} rubros disponibles.</span>}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Para agregar un rubro a tu presupuesto, abrí el proyecto y usá &apos;+ Agregar rubro&apos; en cada capítulo.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-5 items-start">
        {/* Panel izquierdo — árbol + buscador */}
        <div className="w-full lg:w-[340px] flex-shrink-0 bg-white rounded-2xl border border-slate-200 overflow-hidden lg:sticky lg:top-20">
          <div className="p-3 border-b border-slate-200">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-300 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder="Buscar capítulo o rubro…"
                className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30 focus:border-[#2563EB]/40 placeholder:text-slate-300"
              />
            </div>
          </div>
          <div className="max-h-[70vh] overflow-y-auto p-2">
            {/* La lista inicial son capítulos, no rubros sueltos; con búsqueda
                activa se mezclan capítulos enteros y rubros que coinciden. */}
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 px-2 pt-1 pb-1.5">
              {filtro.trim() ? "Resultados" : "Capítulos"}
            </p>
            {cargandoArbol ? (
              <div className="flex items-center justify-center py-10 text-slate-300">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : (
              <ArbolBiblioteca
                capitulos={capitulos}
                seleccionadoId={seleccionadoId}
                onSeleccionar={setSeleccionadoId}
                filtro={filtro}
              />
            )}
          </div>
        </div>

        {/* Panel derecho — descompuesto */}
        <div className="flex-1 min-w-0 w-full">
          {!seleccionadoId ? (
            <div className="bg-white rounded-2xl border border-slate-200 border-dashed px-6 py-20 text-center">
              <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Seleccioná un rubro del árbol para ver su descompuesto completo.</p>
            </div>
          ) : errorDescompuesto ? (
            <div className="bg-white rounded-2xl border border-slate-200 px-6 py-20 text-center">
              <AlertTriangle className="w-6 h-6 text-amber-500 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No se pudo cargar el descompuesto. Intentá de nuevo.</p>
            </div>
          ) : cargandoDescompuesto || !descompuesto ? (
            <div className="bg-white rounded-2xl border border-slate-200 px-6 py-20 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-slate-300 mx-auto" />
            </div>
          ) : (
            <PanelDescompuesto data={descompuesto} />
          )}
        </div>
      </div>
    </div>
  );
}
