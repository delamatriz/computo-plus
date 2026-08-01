"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import {
  ArrowLeft,
  Download,
  Plus,
  X,
  ChevronDown,
  Sparkles,
  Calculator,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fileToBase64, type PlanoDetalle } from "@/components/metrajes/planoArchivo";
import type { PlanoResumen } from "@/components/metrajes/SeccionPlanos";

// SeccionPlanos y VisorPlano importan react-pdf (pdf.js), que revienta con
// "DOMMatrix is not defined" si su módulo se evalúa en el servidor — pdf.js
// usa esa API de navegador a nivel de módulo, no dentro de una función. Esta
// página es "use client" pero de todos modos Next la renderiza una vez en
// el servidor para el HTML inicial, así que un import estático de estos
// componentes rompía la página con 500 siempre. Con ssr:false nunca se
// evalúan del lado del servidor, solo en el browser.
const SeccionPlanos = dynamic(() => import("@/components/metrajes/SeccionPlanos"), {
  ssr: false,
  loading: () => (
    <div className="bg-white rounded-[16px] border border-slate-300 shadow-sm p-4">
      <p className="text-sm text-slate-400">Cargando…</p>
    </div>
  ),
});
const VisorPlano = dynamic(() => import("@/components/metrajes/VisorPlano"), { ssr: false });

/* ─── Tipos ───────────────────────────────────────────────── */
interface MetrajeFila {
  id: string;
  descripcion: string;
  largo: number | null;
  ancho: number | null;
  alto: number | null;
  cantidad: number | null;
  rubroId: string | null;
}

interface RubroOption {
  id: string;
  nombre: string;
  capituloNombre: string;
}

interface ElementoDetectado {
  descripcion: string;
  largo: number | null;
  ancho: number | null;
  alto: number | null;
  cantidad: number;
  subtotal: number;
  unidad: "M2" | "M3" | "ML" | "U";
  nota: string;
}

/* ─── Helpers ─────────────────────────────────────────────── */
function fmtNum(v: number, decimales = 2): string {
  return v.toLocaleString("es-UY", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

function subtotalFila(f: MetrajeFila): number {
  const valores = [f.largo, f.ancho, f.alto, f.cantidad];
  if (valores.every((v) => v == null)) return 0;
  return valores.reduce((acc: number, v) => acc * (v ?? 1), 1);
}

function nuevaFila(): MetrajeFila {
  return {
    id: `f${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    descripcion: "",
    largo: null,
    ancho: null,
    alto: null,
    cantidad: null,
    rubroId: null,
  };
}

/* ─── Página principal ────────────────────────────────────── */
export default function MetrajesPage() {
  const params = useParams();
  const proyectoId = (params?.id as string) ?? "";

  const [proyectoNombre, setProyectoNombre] = useState<string>("");
  const [rubrosDisponibles, setRubrosDisponibles] = useState<RubroOption[]>([]);

  const [filas, setFilas] = useState<MetrajeFila[]>([nuevaFila()]);

  // Fila con IA
  const [iaTexto, setIaTexto] = useState("");
  const [iaCargando, setIaCargando] = useState(false);

  // Análisis de imágenes con IA (dispara desde la card "Planos" — el
  // resultado se muestra en el mismo modal de siempre, ver más abajo)
  const [elementosDetectados, setElementosDetectados] = useState<ElementoDetectado[] | null>(null);
  const [observacionesIA, setObservacionesIA] = useState("");
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());

  // Calculadora rápida
  const [mostrarCalculadora, setMostrarCalculadora] = useState(false);

  // Planos — lista + plano abierto. El detalle vive acá (no en
  // SeccionPlanos) porque el visor se muestra como panel lateral, hermano
  // de la columna de contenido, no anidado dentro de la card "Planos".
  const [planos, setPlanos] = useState<PlanoResumen[]>([]);
  const [cargandoPlanos, setCargandoPlanos] = useState(true);
  const [errorPlanos, setErrorPlanos] = useState<string | null>(null);
  const [eliminandoIds, setEliminandoIds] = useState<Set<string>>(new Set());
  const [planoAbierto, setPlanoAbierto] = useState<PlanoDetalle | null>(null);
  const [cargandoDetallePlano, setCargandoDetallePlano] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  // Panel redimensionable — ancho del visor como % del split, arrastrando el
  // divisor. Solo aplica en desktop (lg+); en mobile el visor es overlay
  // full-screen y no hay nada que redimensionar. No se persiste a propósito
  // (resetea al recargar).
  const [anchoVisorPct, setAnchoVisorPct] = useState(40);
  const [isDesktop, setIsDesktop] = useState(false);
  const splitRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const actualizar = () => setIsDesktop(mq.matches);
    actualizar();
    mq.addEventListener("change", actualizar);
    return () => mq.removeEventListener("change", actualizar);
  }, []);

  const iniciarResizeVisor = (e: React.MouseEvent) => {
    e.preventDefault();
    const contenedor = splitRef.current;
    if (!contenedor) return;

    const onMouseMove = (ev: MouseEvent) => {
      const rect = contenedor.getBoundingClientRect();
      const pctDesdeIzquierda = ((ev.clientX - rect.left) / rect.width) * 100;
      setAnchoVisorPct(Math.min(70, Math.max(20, 100 - pctDesdeIzquierda)));
    };
    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    if (!proyectoId) return;
    let cancelado = false;
    (async () => {
      try {
        const res = await fetch(`/api/proyectos/${proyectoId}/planos`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!cancelado) setPlanos(data.planos ?? []);
      } catch {
        if (!cancelado) setErrorPlanos("No se pudieron cargar los planos.");
      } finally {
        if (!cancelado) setCargandoPlanos(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [proyectoId]);

  async function abrirPlano(id: string) {
    setCargandoDetallePlano(true);
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/planos/${id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPlanoAbierto(data.plano);
    } catch {
      setErrorPlanos("No se pudo abrir el plano.");
    } finally {
      setCargandoDetallePlano(false);
    }
  }

  async function eliminarPlano(id: string) {
    setEliminandoIds((prev) => new Set(prev).add(id));
    const anterior = planos;
    setPlanos((prev) => prev.filter((p) => p.id !== id));
    if (planoAbierto?.id === id) setPlanoAbierto(null);
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/planos/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      setPlanos(anterior);
      setErrorPlanos("No se pudo eliminar el plano.");
    } finally {
      setEliminandoIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function subirFotoComplementariaPlano(file: File) {
    if (!planoAbierto) return;
    setSubiendoFoto(true);
    try {
      const archivo = await fileToBase64(file);
      const res = await fetch(`/api/proyectos/${proyectoId}/planos/${planoAbierto.id}/fotos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archivo, nombreArchivoOriginal: file.name }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPlanoAbierto(data.plano);
      setPlanos((prev) => prev.map((p) => (p.id === planoAbierto.id ? { ...p, cantidadFotos: data.plano.fotos.length } : p)));
    } catch {
      setErrorPlanos("No se pudo subir la foto complementaria.");
    } finally {
      setSubiendoFoto(false);
    }
  }

  async function guardarNotasPlano(notas: string) {
    if (!planoAbierto) return;
    const res = await fetch(`/api/proyectos/${proyectoId}/planos/${planoAbierto.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notas }),
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    setPlanoAbierto(data.plano);
  }

  /* Cargar proyecto y rubros disponibles */
  useEffect(() => {
    if (!proyectoId) return;
    async function cargar() {
      try {
        const res = await fetch(`/api/proyectos/${proyectoId}`);
        if (!res.ok) return;
        const data = await res.json();
        setProyectoNombre(data.nombre ?? "");
        const opciones: RubroOption[] = [];
        for (const cap of data.capitulos ?? []) {
          for (const rubro of cap.rubros ?? []) {
            opciones.push({
              id: rubro.id,
              nombre: rubro.descripcion || "Rubro sin nombre",
              capituloNombre: cap.nombre,
            });
          }
        }
        setRubrosDisponibles(opciones);
      } catch (err) {
        console.error("[metrajes] cargar proyecto", err);
      }
    }
    cargar();
  }, [proyectoId]);

  /* Filas de la planilla */
  const actualizarFila = (id: string, field: keyof MetrajeFila, value: string) => {
    setFilas((prev) =>
      prev.map((f) =>
        f.id !== id
          ? f
          : {
              ...f,
              [field]:
                field === "descripcion" || field === "rubroId"
                  ? value || null
                  : value === ""
                  ? null
                  : parseFloat(value),
            }
      )
    );
  };

  const agregarFila = () => setFilas((prev) => [...prev, nuevaFila()]);

  const eliminarFila = (id: string) => setFilas((prev) => prev.filter((f) => f.id !== id));

  /* Fila generada a partir de descripción en lenguaje natural vía IA */
  const agregarFilaIA = async () => {
    if (!iaTexto.trim() || iaCargando) return;
    setIaCargando(true);
    try {
      const res = await fetch("/api/metrajes/sugerir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descripcion: iaTexto.trim() }),
      });
      if (!res.ok) throw new Error("Error al generar la fila");
      const data = await res.json();

      setFilas((prev) => [
        ...prev,
        {
          ...nuevaFila(),
          descripcion: data.nota ? `${data.descripcion} (${data.nota})` : data.descripcion,
          largo: data.largo ?? null,
          ancho: data.ancho ?? null,
          alto: data.alto ?? null,
          cantidad: data.cantidad ?? 1,
        },
      ]);
      setIaTexto("");
    } catch (err) {
      console.error("[metrajes] agregarFilaIA", err);
    } finally {
      setIaCargando(false);
    }
  };

  /* Analizar imágenes de un plano (+ sus fotos complementarias) con IA —
   * disparado desde la card "Planos". Recibe las imágenes ya en base64
   * (vienen de un PlanoProyecto/FotoComplementaria persistidos, no de un
   * File efímero) y un contexto opcional (las notas del plano). */
  const analizarConIA = async (imagenesBase64: string[], contexto: string | null) => {
    const res = await fetch("/api/metrajes/analizar-imagen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fotos: imagenesBase64, contexto: contexto?.trim() || undefined }),
    });
    if (!res.ok) throw new Error("Error al analizar las imágenes");
    const data = await res.json();
    const elementos: ElementoDetectado[] = data.elementos ?? [];
    setElementosDetectados(elementos);
    setObservacionesIA(data.observaciones ?? "");
    setSeleccionados(new Set(elementos.map((_, i) => i)));
  };

  const toggleSeleccionado = (i: number) => {
    setSeleccionados((prev) => {
      const copia = new Set(prev);
      if (copia.has(i)) copia.delete(i);
      else copia.add(i);
      return copia;
    });
  };

  const cerrarPanelAnalisis = () => {
    setElementosDetectados(null);
    setObservacionesIA("");
    setSeleccionados(new Set());
  };

  const agregarElementosSeleccionados = () => {
    if (!elementosDetectados) return;
    const nuevasFilas = elementosDetectados
      .filter((_, i) => seleccionados.has(i))
      .map((el) => ({
        ...nuevaFila(),
        descripcion: el.nota ? `${el.descripcion} (${el.nota})` : el.descripcion,
        largo: el.largo,
        ancho: el.ancho,
        alto: el.alto,
        cantidad: el.cantidad ?? 1,
      }));
    if (nuevasFilas.length > 0) setFilas((prev) => [...prev, ...nuevasFilas]);
    cerrarPanelAnalisis();
  };

  const totalGeneral = useMemo(
    () => filas.reduce((s, f) => s + subtotalFila(f), 0),
    [filas]
  );

  /* Exportar a Excel */
  const exportarExcel = () => {
    const fecha = new Date().toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" });
    const wb = XLSX.utils.book_new();

    const datos: (string | number | null)[][] = [
      [`METRAJES — ${proyectoNombre || "Proyecto"}`],
      [`Fecha de generación: ${fecha}`],
      [],
      ["DESCRIPCIÓN", "LARGO", "ANCHO", "ALTO", "CANT.", "SUBTOTAL", "RUBRO VINCULADO"],
      ...filas
        .filter((f) => f.descripcion.trim())
        .map((f) => {
          const rubro = rubrosDisponibles.find((r) => r.id === f.rubroId);
          return [
            f.descripcion,
            f.largo ?? null,
            f.ancho ?? null,
            f.alto ?? null,
            f.cantidad ?? null,
            parseFloat(subtotalFila(f).toFixed(2)),
            rubro ? rubro.nombre : "",
          ];
        }),
      ["TOTAL GENERAL", "", "", "", "", parseFloat(totalGeneral.toFixed(2)), ""],
    ];

    const ws = XLSX.utils.aoa_to_sheet(datos);
    ws["!cols"] = [{ wch: 36 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 28 }];

    XLSX.utils.book_append_sheet(wb, ws, "Metrajes");
    XLSX.writeFile(wb, `Metrajes-${(proyectoNombre || "proyecto").replace(/\s+/g, "-")}.xlsx`);
  };

  const inputCls =
    "w-full text-sm text-slate-600 bg-transparent focus:outline-none focus:bg-white focus:rounded focus:ring-1 focus:ring-[#2563EB]/20 placeholder:text-slate-300";

  return (
    <>
    <div className="min-h-full flex flex-col" style={{ background: "#F8FAFC" }}>
      {/* ── Header ───────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-4 md:px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <Link
            href={`/proyectos/${proyectoId}`}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors mb-3"
          >
            <ArrowLeft className="w-3 h-3" />
            {proyectoNombre || "Proyecto"}
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h1 className="text-lg md:text-xl font-bold text-[#1A3A5C]">
              Metrajes
              {proyectoNombre && (
                <span className="text-slate-400 font-normal"> — {proyectoNombre}</span>
              )}
            </h1>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={exportarExcel}
                className="flex items-center gap-1.5 px-3 py-2 rounded-[8px] border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Exportar Excel
              </button>
            </div>
          </div>
        </div>
      </div>

      <div ref={splitRef} className="w-full flex-1 flex flex-col lg:flex-row min-h-0">
      <div
        className={cn("w-full px-3 md:px-6 py-6 space-y-4", planoAbierto ? "lg:w-[60%]" : "max-w-6xl mx-auto")}
        style={isDesktop && planoAbierto ? { width: `${100 - anchoVisorPct}%` } : undefined}
      >
        {/* ── Planos (Etapa 1 — subida + visor, ver UI_UX_REDESIGN.md 6) ── */}
        {proyectoId && (
          <SeccionPlanos
            proyectoId={proyectoId}
            planos={planos}
            cargando={cargandoPlanos}
            error={errorPlanos}
            eliminandoIds={eliminandoIds}
            onPlanosActualizados={setPlanos}
            onAbrirPlano={abrirPlano}
            onEliminarPlano={eliminarPlano}
          />
        )}

        {/* ── Planilla de cómputo ───────────────────────────── */}
        <div className="bg-white rounded-[16px] border border-slate-300 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200">
            <span className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">
              Planilla de cómputo
            </span>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[860px]">
              {/* Cabecera */}
              <div className="flex items-center bg-slate-50 border-b border-slate-200" style={{ height: 32 }}>
                <div className="flex-1 px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Descripción</div>
                <div style={{ width: 88, flexShrink: 0 }} className="px-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-right">Largo</div>
                <div style={{ width: 88, flexShrink: 0 }} className="px-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-right">Ancho</div>
                <div style={{ width: 88, flexShrink: 0 }} className="px-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-right">Alto</div>
                <div style={{ width: 80, flexShrink: 0 }} className="px-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-right">Cant.</div>
                <div style={{ width: 110, flexShrink: 0 }} className="px-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-right">Subtotal</div>
                <div style={{ width: 220, flexShrink: 0 }} className="px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Rubro vinculado</div>
                <div style={{ width: 36, flexShrink: 0 }} />
              </div>

              {/* Filas */}
              {filas.map((fila, idx) => {
                const subtotal = subtotalFila(fila);
                return (
                  <div
                    key={fila.id}
                    className={cn(
                      "flex items-center hover:bg-blue-50/20 transition-colors",
                      idx % 2 === 1 ? "bg-[#F8FAFC]" : "bg-white"
                    )}
                    style={{ height: 36, borderBottom: "1px solid #F1F5F9" }}
                  >
                    <div className="flex-1 px-3">
                      <input
                        type="text"
                        value={fila.descripcion}
                        onChange={(e) => actualizarFila(fila.id, "descripcion", e.target.value)}
                        placeholder="Descripción del elemento"
                        className={inputCls}
                      />
                    </div>
                    <div style={{ width: 88, flexShrink: 0 }} className="px-2">
                      <input
                        type="number"
                        value={fila.largo ?? ""}
                        onChange={(e) => actualizarFila(fila.id, "largo", e.target.value)}
                        placeholder="—"
                        className={cn(inputCls, "text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none")}
                      />
                    </div>
                    <div style={{ width: 88, flexShrink: 0 }} className="px-2">
                      <input
                        type="number"
                        value={fila.ancho ?? ""}
                        onChange={(e) => actualizarFila(fila.id, "ancho", e.target.value)}
                        placeholder="—"
                        className={cn(inputCls, "text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none")}
                      />
                    </div>
                    <div style={{ width: 88, flexShrink: 0 }} className="px-2">
                      <input
                        type="number"
                        value={fila.alto ?? ""}
                        onChange={(e) => actualizarFila(fila.id, "alto", e.target.value)}
                        placeholder="—"
                        className={cn(inputCls, "text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none")}
                      />
                    </div>
                    <div style={{ width: 80, flexShrink: 0 }} className="px-2">
                      <input
                        type="number"
                        value={fila.cantidad ?? ""}
                        onChange={(e) => actualizarFila(fila.id, "cantidad", e.target.value)}
                        placeholder="—"
                        className={cn(inputCls, "text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none")}
                      />
                    </div>
                    <div style={{ width: 110, flexShrink: 0 }} className="px-2 text-right">
                      <span className={cn("text-sm font-semibold tabular-nums", subtotal > 0 ? "text-[#2563EB]" : "text-slate-300")}>
                        {subtotal > 0 ? fmtNum(subtotal) : "—"}
                      </span>
                    </div>
                    <div style={{ width: 220, flexShrink: 0 }} className="px-3">
                      <select
                        value={fila.rubroId ?? ""}
                        onChange={(e) => actualizarFila(fila.id, "rubroId", e.target.value)}
                        className={cn(inputCls, "cursor-pointer", !fila.rubroId && "text-slate-400")}
                      >
                        <option value="">Sin vincular</option>
                        {Object.entries(
                          rubrosDisponibles.reduce<Record<string, RubroOption[]>>((acc, r) => {
                            (acc[r.capituloNombre] ??= []).push(r);
                            return acc;
                          }, {})
                        ).map(([capNombre, rubros]) => (
                          <optgroup key={capNombre} label={capNombre}>
                            {rubros.map((r) => (
                              <option key={r.id} value={r.id}>{r.nombre}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                    <div style={{ width: 36, flexShrink: 0 }} className="flex items-center justify-center">
                      <button
                        onClick={() => eliminarFila(fila.id)}
                        className="text-slate-300 hover:text-red-500 transition-colors"
                        aria-label="Eliminar fila"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Agregar fila */}
              <div className="flex items-center pl-3" style={{ height: 32, borderTop: "1px solid #F1F5F9" }}>
                <button
                  onClick={agregarFila}
                  className="flex items-center gap-1.5 text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
                >
                  <Plus className="w-3 h-3" /> Agregar fila
                </button>
              </div>

              {/* Fila IA */}
              <div className="flex items-center gap-2 px-3 py-2.5 border-t border-slate-100 bg-[#F0F7FF]">
                <Sparkles className="w-4 h-4 text-[#2563EB] flex-shrink-0" />
                <input
                  type="text"
                  value={iaTexto}
                  onChange={(e) => setIaTexto(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && agregarFilaIA()}
                  placeholder="Describí el elemento (ej: tabique de durlock 2.40m x 3.10m, 4 unidades) y la IA completa la fila"
                  className="flex-1 min-w-0 text-sm text-slate-700 bg-white border border-blue-200 rounded-[8px] px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] placeholder:text-slate-400"
                />
                <button
                  onClick={agregarFilaIA}
                  disabled={!iaTexto.trim() || iaCargando}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-sm font-semibold transition-colors flex-shrink-0",
                    !iaTexto.trim() || iaCargando
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                      : "bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
                  )}
                >
                  {iaCargando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  Generar fila
                </button>
              </div>

              {/* Total general */}
              <div className="flex items-center border-t-2 border-slate-300 bg-white" style={{ height: 40 }}>
                <div className="flex-1 px-3 text-sm font-bold text-slate-400 uppercase tracking-wide">Total general</div>
                <div style={{ width: 88 }} />
                <div style={{ width: 88 }} />
                <div style={{ width: 88 }} />
                <div style={{ width: 80 }} />
                <div style={{ width: 110, flexShrink: 0 }} className="px-2 text-right">
                  <span className="text-base font-bold tabular-nums" style={{ color: "#1A3A5C" }}>
                    {fmtNum(totalGeneral)}
                  </span>
                </div>
                <div style={{ width: 220 }} />
                <div style={{ width: 36 }} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Calculadora rápida ────────────────────────────── */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => setMostrarCalculadora((v) => !v)}
            className="relative flex items-center justify-center gap-2 w-full py-3 rounded-[12px] border border-slate-300 text-slate-500 hover:text-slate-700 hover:border-slate-400 font-medium text-sm transition-colors bg-white"
          >
            <Calculator className="w-4 h-4" />
            Calculadora rápida
            <ChevronDown
              className={cn("w-4 h-4 absolute right-4 transition-transform", mostrarCalculadora && "rotate-180")}
            />
          </button>
          <AnimatePresence initial={false}>
            {mostrarCalculadora && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="rounded-[12px] border border-slate-300 bg-white p-3 max-w-xs">
                  <CalculadoraInline />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Divisor arrastrable — solo desktop, solo con un plano abierto ── */}
      {planoAbierto && (
        <div
          onMouseDown={iniciarResizeVisor}
          title="Arrastrar para redimensionar"
          className="hidden lg:flex items-stretch w-2.5 flex-shrink-0 cursor-col-resize group relative z-10"
        >
          <div className="w-px mx-auto bg-slate-200 group-hover:bg-[#2563EB] group-active:bg-[#2563EB] transition-colors" />
        </div>
      )}

      {/* ── Visor de plano (panel lateral, ver UI_UX_REDESIGN.md 6) ── */}
      {planoAbierto && (
        <VisorPlano
          plano={planoAbierto}
          onClose={() => setPlanoAbierto(null)}
          onSubirFoto={subirFotoComplementariaPlano}
          subiendoFoto={subiendoFoto}
          onGuardarNotas={guardarNotasPlano}
          onAnalizarConIA={analizarConIA}
          style={isDesktop ? { width: `${anchoVisorPct}%` } : undefined}
        />
      )}
      {cargandoDetallePlano && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <Loader2 className="w-6 h-6 animate-spin text-white" />
        </div>
      )}
      </div>

    </div>

      {/* ── Modal: elementos detectados por IA ────────────── */}
      <AnimatePresence>
        {elementosDetectados && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4"
            onClick={cerrarPanelAnalisis}
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-[16px] shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#2563EB]" />
                  <span className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">
                    Elementos detectados
                  </span>
                </div>
                <button
                  onClick={cerrarPanelAnalisis}
                  className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  aria-label="Cerrar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-auto px-5 py-4 space-y-2">
                {elementosDetectados.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">
                    No se detectaron elementos medibles en las imágenes.
                  </p>
                ) : (
                  elementosDetectados.map((el, i) => (
                    <label
                      key={i}
                      className={cn(
                        "flex items-start gap-3 px-3 py-2.5 rounded-[10px] border cursor-pointer transition-colors",
                        seleccionados.has(i)
                          ? "border-[#2563EB] bg-blue-50/50"
                          : "border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={seleccionados.has(i)}
                        onChange={() => toggleSeleccionado(i)}
                        className="mt-0.5 w-4 h-4 accent-[#2563EB] flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-[#1A3A5C]">{el.descripcion}</span>
                          <span className="text-sm font-semibold text-[#2563EB] tabular-nums flex-shrink-0">
                            {fmtNum(el.subtotal)} {el.unidad}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {[
                            el.largo != null ? `L: ${fmtNum(el.largo)}` : null,
                            el.ancho != null ? `A: ${fmtNum(el.ancho)}` : null,
                            el.alto != null ? `H: ${fmtNum(el.alto)}` : null,
                            el.cantidad != null ? `Cant: ${el.cantidad}` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                        {el.nota && (
                          <p className="text-xs text-slate-400 italic mt-1">{el.nota}</p>
                        )}
                      </div>
                    </label>
                  ))
                )}

                {observacionesIA && (
                  <div className="mt-3 px-3 py-2.5 rounded-[10px] bg-[#F0F7FF] border border-blue-100">
                    <p className="text-xs text-slate-500">{observacionesIA}</p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-slate-200 flex-shrink-0">
                <span className="text-xs text-slate-400">
                  {seleccionados.size} de {elementosDetectados.length} seleccionados
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={cerrarPanelAnalisis}
                    className="px-3 py-2 rounded-[8px] text-sm font-medium text-slate-500 hover:bg-slate-100 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={agregarElementosSeleccionados}
                    disabled={seleccionados.size === 0}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2 rounded-[8px] text-sm font-semibold transition-colors",
                      seleccionados.size === 0
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                        : "bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
                    )}
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar seleccionados a la planilla
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ─── Calculadora rápida inline ──────────────────────────── */
function CalculadoraInline() {
  const [display, setDisplay] = useState("0");
  const [operacion, setOperacion] = useState("");
  const [valorPrevio, setValorPrevio] = useState("");
  const [esperandoOperando, setEsperandoOperando] = useState(false);

  const presionarNumero = (num: string) => {
    if (esperandoOperando) {
      setDisplay(num);
      setEsperandoOperando(false);
    } else {
      setDisplay(display === "0" ? num : display + num);
    }
  };

  const presionarOperacion = (op: string) => {
    setValorPrevio(display);
    setOperacion(op);
    setEsperandoOperando(true);
  };

  const calcular = () => {
    const prev = parseFloat(valorPrevio);
    const curr = parseFloat(display);
    let resultado = 0;
    if (operacion === "+") resultado = prev + curr;
    if (operacion === "-") resultado = prev - curr;
    if (operacion === "×") resultado = prev * curr;
    if (operacion === "÷") resultado = curr !== 0 ? prev / curr : 0;
    setDisplay(resultado % 1 === 0 ? resultado.toString() : resultado.toFixed(2));
    setOperacion("");
    setEsperandoOperando(true);
  };

  const limpiar = () => {
    setDisplay("0");
    setOperacion("");
    setValorPrevio("");
    setEsperandoOperando(false);
  };

  const btnCls = "h-9 rounded-lg text-sm font-medium transition-colors";

  return (
    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
      <div className="bg-white rounded-lg px-3 py-2 text-right text-lg font-mono font-semibold text-[#1A3A5C] mb-2 border border-slate-200 min-h-[40px]">
        {parseFloat(display).toLocaleString("es-UY")}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        <button onClick={limpiar} className={`${btnCls} col-span-2 bg-red-50 text-red-600 hover:bg-red-100`}>C</button>
        <button onClick={() => presionarOperacion("÷")} className={`${btnCls} bg-blue-50 text-[#2563EB] hover:bg-blue-100`}>÷</button>
        <button onClick={() => presionarOperacion("×")} className={`${btnCls} bg-blue-50 text-[#2563EB] hover:bg-blue-100`}>×</button>

        {["7", "8", "9"].map((n) => (
          <button key={n} onClick={() => presionarNumero(n)} className={`${btnCls} bg-white border border-slate-200 text-[#1E293B] hover:bg-slate-100`}>{n}</button>
        ))}
        <button onClick={() => presionarOperacion("-")} className={`${btnCls} bg-blue-50 text-[#2563EB] hover:bg-blue-100`}>−</button>

        {["4", "5", "6"].map((n) => (
          <button key={n} onClick={() => presionarNumero(n)} className={`${btnCls} bg-white border border-slate-200 text-[#1E293B] hover:bg-slate-100`}>{n}</button>
        ))}
        <button onClick={() => presionarOperacion("+")} className={`${btnCls} bg-blue-50 text-[#2563EB] hover:bg-blue-100`}>+</button>

        {["1", "2", "3"].map((n) => (
          <button key={n} onClick={() => presionarNumero(n)} className={`${btnCls} bg-white border border-slate-200 text-[#1E293B] hover:bg-slate-100`}>{n}</button>
        ))}
        <button onClick={calcular} className={`${btnCls} row-span-2 bg-[#2563EB] text-white hover:bg-blue-700`}>=</button>

        <button onClick={() => presionarNumero("0")} className={`${btnCls} col-span-2 bg-white border border-slate-200 text-[#1E293B] hover:bg-slate-100`}>0</button>
        <button onClick={() => presionarNumero(".")} className={`${btnCls} bg-white border border-slate-200 text-[#1E293B] hover:bg-slate-100`}>.</button>
      </div>
    </div>
  );
}
