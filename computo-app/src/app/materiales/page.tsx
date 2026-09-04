"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Package, Search, Upload, Loader2, Pencil } from "lucide-react";
import { ListaReferencias, type ReferenciaLink } from "@/components/ListaReferencias";
import { BadgeVerificacion, type FuenteMaterial } from "@/components/BadgeVerificacion";
import ModalImportarPrecios from "@/components/materiales/ModalImportarPrecios";
import { cn } from "@/lib/utils";

const referencias: ReferenciaLink[] = [
  {
    titulo: "Lista de Precios MTOP N°599",
    descripcion: "Precios de materiales de construcción — Ministerio de Transporte",
    url: "https://www.gub.uy/ministerio-transporte-obras-publicas/tematica/precios-construccion",
  },
  {
    titulo: "Índice ICCV — INE",
    descripcion: "Índice del Costo de la Construcción de Vivienda",
    url: "https://www.ine.gub.uy",
  },
];

interface MaterialCatalogo {
  id: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  precioUnitario: number;
  cantidadUnidad: string;
  numeroLista: number;
  proveedor: string | null;
  notaProcedencia: string | null;
  fechaUltimaVerificacion: string | null;
  requiereVerificacion: boolean;
  motivoVerificacion: string | null;
  actualizadoEn: string;
}

function fmtMon(v: number): string {
  if (!v) return "—";
  return `$ ${Math.round(v).toLocaleString("es-UY")}`;
}

// Parsea el precio tipeado a mano en el lápiz de edición — a propósito
// DISTINTO del criterio de Cantidad/Precio Unitario del rubro (valores
// chicos: m³, m², rendimientos, donde "." sí es decimal). Acá los precios
// suelen estar en el orden de los miles y la propia UI los muestra con
// punto como separador de miles al perder el foco (ver fmtMon) — si "."
// se leyera como decimal mientras se edita, lo tipeado ("1.800") dejaría
// de coincidir con lo que el usuario ve formateado un instante después
// ("$ 1.800"). Por eso acá "." se descarta siempre (nunca decimal) y
// solo "," representa el decimal.
function parsearPrecioTipeado(texto: string): number {
  return parseFloat(texto.replace(/\./g, "").replace(",", "."));
}

function fmtFecha(v: Date): string {
  return v.toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Fecha de la columna "Actualizado" — fechaUltimaVerificacion si existe
// (verificación real de precio de mercado, texto normal) o si no,
// actualizadoEn (fecha de carga/última edición del registro — nunca pasó
// por el sistema de verificación, por eso va en gris tenue: no hay que
// confundir "se cargó/corrigió" con "se verificó contra el mercado").
function fechaColumna(m: MaterialCatalogo): { texto: string; verificada: boolean } {
  if (m.fechaUltimaVerificacion) {
    return { texto: fmtFecha(new Date(m.fechaUltimaVerificacion)), verificada: true };
  }
  return { texto: fmtFecha(new Date(m.actualizadoEn)), verificada: false };
}

// Fecha general del catálogo — el MAX entre fechaUltimaVerificacion (la
// última vez que un precio se confirmó/corrigió) y actualizadoEn (que
// @updatedAt toca en CUALQUIER escritura, incluida la creación) de TODOS
// los materiales. No es "por material" — ese detalle ya vive en el
// tooltip del badge de cada fila (BadgeVerificacion), esto no lo toca.
function calcularFechaMaxima(materiales: MaterialCatalogo[]): Date | null {
  let max: Date | null = null;
  for (const m of materiales) {
    for (const raw of [m.fechaUltimaVerificacion, m.actualizadoEn]) {
      if (!raw) continue;
      const fecha = new Date(raw);
      if (Number.isNaN(fecha.getTime())) continue;
      if (!max || fecha > max) max = fecha;
    }
  }
  return max;
}

export default function MaterialesPage() {
  const [materiales, setMateriales] = useState<MaterialCatalogo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroSinPrecio, setFiltroSinPrecio] = useState(false);
  const [filtroPendiente, setFiltroPendiente] = useState(false);
  const [modalImportarAbierto, setModalImportarAbierto] = useState(false);
  // Material cuyo precio está en edición inline (click-to-edit) — mismo
  // patrón que precioEditId en DrawerAPU (proyectos/[id]/page.tsx).
  const [precioEditId, setPrecioEditId] = useState<string | null>(null);
  // Texto crudo tipeado mientras precioEditId está activo — mismo criterio
  // que el fix de Cantidad/Precio Unitario del rubro (commit 05c2953):
  // el input muestra este texto tal cual, sin reconstruirlo desde el
  // número parseado en cada tecla, así "." o "," nunca desaparecen a
  // mitad de tipeo.
  const [precioEditTexto, setPrecioEditTexto] = useState("");
  const [guardandoPrecioId, setGuardandoPrecioId] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setCargando(true);
    fetch("/api/precios-mtop")
      .then((r) => r.json())
      .then((data) => setMateriales(Array.isArray(data) ? data : []))
      .catch(() => setMateriales([]))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const proveedoresExistentes = useMemo(() => {
    const set = new Set<string>();
    for (const m of materiales) if (m.proveedor) set.add(m.proveedor);
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [materiales]);

  // Guarda el precio corregido inline y actualiza el material local (sin
  // re-fetch de toda la tabla) con lo que devuelve el server — mismo
  // criterio que sincronizarPrecioMTOP en proyectos/[id]/page.tsx: así el
  // badge y la columna "Actualizado" pasan a "Verificado" al instante.
  async function guardarPrecio(id: string, valor: number) {
    setPrecioEditId(null);
    if (!Number.isFinite(valor) || valor <= 0) return;
    const actual = materiales.find((m) => m.id === id);
    if (actual && actual.precioUnitario === valor) return; // sin cambios, no pega al servidor

    setGuardandoPrecioId(id);
    try {
      const res = await fetch(`/api/precios-mtop/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ precioUnitario: valor }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setMateriales((prev) =>
        prev.map((m) =>
          m.id !== id
            ? m
            : {
                ...m,
                precioUnitario: data.precioUnitario,
                fechaUltimaVerificacion: data.fechaUltimaVerificacion,
                requiereVerificacion: data.requiereVerificacion,
                motivoVerificacion: data.motivoVerificacion,
                actualizadoEn: data.fechaUltimaVerificacion ?? m.actualizadoEn,
              }
        )
      );
    } catch (err) {
      console.error("[editar precio inline]", err);
    } finally {
      setGuardandoPrecioId(null);
    }
  }

  function esPendiente(m: MaterialCatalogo): boolean {
    return !!(m.proveedor || m.notaProcedencia) && !m.fechaUltimaVerificacion;
  }

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return materiales.filter((m) => {
      if (q && !m.descripcion.toLowerCase().includes(q)) return false;
      if (filtroSinPrecio && m.precioUnitario > 0) return false;
      if (filtroPendiente && !esPendiente(m)) return false;
      return true;
    });
  }, [materiales, busqueda, filtroSinPrecio, filtroPendiente]);

  const fechaMaxima = useMemo(() => calcularFechaMaxima(materiales), [materiales]);

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl font-semibold text-[#1A3A5C] mb-2">Materiales</h1>
          <p className="text-slate-500">
            Catálogo de materiales de construcción y sus precios de referencia — {materiales.length} en total.
          </p>
          <p className="text-sm text-slate-400 mt-2 max-w-2xl">
            Este catálogo combina la Lista Oficial MTOP N°599 con materiales de mercado libre y listas importadas. El
            badge de cada fila indica si el precio está verificado, pendiente de verificar, o si falta cotizar. Usá
            los filtros para encontrar rápido lo que necesitás revisar. ¿Tenés tu propia lista de precios? Subila
            para complementar este catálogo — hacé clic en &quot;Importar lista de precios&quot;.
          </p>
          {!cargando && (
            <p className="text-xs text-slate-400 mt-1.5">
              Catálogo actualizado al: {fechaMaxima ? fmtFecha(fechaMaxima) : "Sin actualizaciones registradas"}
            </p>
          )}
        </div>
        <button
          onClick={() => setModalImportarAbierto(true)}
          className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#1D4ED8] transition-colors"
        >
          <Upload className="w-4 h-4" />
          Importar lista de precios
        </button>
      </div>

      <div className="mb-8">
        <ListaReferencias items={referencias} />
      </div>

      {/* Buscador + filtros */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por descripción..."
            className="w-full pl-9 pr-3 py-2.5 rounded-[10px] border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
          />
        </div>
        <button
          onClick={() => setFiltroSinPrecio((p) => !p)}
          className={cn(
            "px-3 py-2 rounded-[8px] text-xs font-semibold border transition-colors",
            filtroSinPrecio
              ? "bg-red-50 text-red-600 border-red-200"
              : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
          )}
        >
          Sin precio
        </button>
        <button
          onClick={() => setFiltroPendiente((p) => !p)}
          className={cn(
            "px-3 py-2 rounded-[8px] text-xs font-semibold border transition-colors",
            filtroPendiente
              ? "bg-amber-50 text-amber-600 border-amber-200"
              : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
          )}
        >
          Pendiente de verificar
        </button>
      </div>

      {/* Tabla */}
      <div className="rounded-[16px] border border-slate-200 bg-white overflow-hidden">
        {cargando ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando materiales...
          </div>
        ) : filtrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-16 px-6">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-4">
              <Package className="w-5 h-5 text-[#2563EB]" />
            </div>
            <p className="text-sm text-slate-500 max-w-sm">
              {materiales.length === 0
                ? "Todavía no hay materiales cargados."
                : "Ningún material coincide con la búsqueda o los filtros elegidos."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-500 text-xs uppercase tracking-wide">
                    Descripción
                  </th>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-500 text-xs uppercase tracking-wide">
                    Unidad
                  </th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-500 text-xs uppercase tracking-wide">
                    Precio
                  </th>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-500 text-xs uppercase tracking-wide">
                    Fuente
                  </th>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-500 text-xs uppercase tracking-wide">
                    Actualizado
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((m) => {
                  const fuente: FuenteMaterial = {
                    proveedor: m.proveedor,
                    notaProcedencia: m.notaProcedencia,
                    nombreProducto: null,
                    urlReferencia: null,
                    fechaUltimaVerificacion: m.fechaUltimaVerificacion,
                    requiereVerificacion: m.requiereVerificacion,
                    motivoVerificacion: m.motivoVerificacion,
                  };
                  const fecha = fechaColumna(m);
                  return (
                    <tr key={m.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-700">{m.descripcion}</span>
                          <BadgeVerificacion fuente={fuente} />
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{m.unidad}</td>
                      <td className="px-4 py-2.5 text-right">
                        {precioEditId === m.id ? (
                          <input
                            type="text"
                            inputMode="decimal"
                            autoFocus
                            value={precioEditTexto}
                            onChange={(e) => setPrecioEditTexto(e.target.value)}
                            onFocus={(e) => e.target.select()}
                            onBlur={() => guardarPrecio(m.id, parsearPrecioTipeado(precioEditTexto))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                              if (e.key === "Escape") setPrecioEditId(null);
                            }}
                            placeholder="0.00"
                            className="w-24 text-right text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-[6px] px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30 tabular-nums"
                          />
                        ) : (
                          <div className="relative group inline-flex items-center gap-1.5 justify-end w-full">
                            {guardandoPrecioId === m.id ? (
                              <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setPrecioEditId(m.id);
                                  setPrecioEditTexto(m.precioUnitario ? String(m.precioUnitario) : "");
                                }}
                                title="Editar precio"
                                className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-[#2563EB] transition-opacity"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            )}
                            <span className="tabular-nums font-medium text-slate-700">{fmtMon(m.precioUnitario)}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {m.proveedor || m.notaProcedencia ? (
                          <span className="text-xs text-slate-500 truncate block max-w-[220px]" title={m.proveedor ?? m.notaProcedencia ?? undefined}>
                            {m.proveedor ?? m.notaProcedencia}
                          </span>
                        ) : (
                          <span className="text-xs text-emerald-600 font-semibold">Lista {m.numeroLista}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={cn("text-xs tabular-nums", fecha.verificada ? "text-slate-600" : "text-slate-300")}
                          title={fecha.verificada ? undefined : "Fecha de carga/última edición — no pasó por verificación de precio de mercado"}
                        >
                          {fecha.texto}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {!cargando && materiales.length > 0 && (
        <p className="text-xs text-slate-400 mt-2">
          Mostrando {filtrados.length} de {materiales.length}.
        </p>
      )}

      {modalImportarAbierto && (
        <ModalImportarPrecios
          proveedoresExistentes={proveedoresExistentes}
          onClose={() => setModalImportarAbierto(false)}
          onImportado={cargar}
        />
      )}
    </div>
  );
}
