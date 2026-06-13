"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import {
  ArrowLeft,
  Download,
  Plus,
  X,
  Camera,
  FileText,
  ChevronDown,
  Sparkles,
  Calculator,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

interface FotoRelevamiento {
  file: File;
  preview: string;
}

const MAX_FOTOS = 10;
const MAX_DOCS = 5;

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

/* ─── Card colapsable ─────────────────────────────────────── */
function CardColapsable({
  titulo,
  defaultAbierta = true,
  children,
}: {
  titulo: string;
  defaultAbierta?: boolean;
  children: React.ReactNode;
}) {
  const [abierta, setAbierta] = useState(defaultAbierta);
  return (
    <div className="bg-white rounded-[16px] border border-slate-300 shadow-sm overflow-hidden">
      <button
        onClick={() => setAbierta((p) => !p)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors text-left"
      >
        <span className="text-sm font-bold text-[#1A3A5C] uppercase tracking-wide">{titulo}</span>
        <ChevronDown
          className={cn("w-4 h-4 text-slate-400 transition-transform", abierta && "rotate-180")}
        />
      </button>
      <AnimatePresence initial={false}>
        {abierta && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-100 px-5 py-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Página principal ────────────────────────────────────── */
export default function MetrajesPage() {
  const params = useParams();
  const proyectoId = (params?.id as string) ?? "";

  const [proyectoNombre, setProyectoNombre] = useState<string>("");
  const [rubrosDisponibles, setRubrosDisponibles] = useState<RubroOption[]>([]);

  const [filas, setFilas] = useState<MetrajeFila[]>([nuevaFila()]);

  // Documentación
  const [fotos, setFotos] = useState<FotoRelevamiento[]>([]);
  const [documentos, setDocumentos] = useState<File[]>([]);
  const [notas, setNotas] = useState("");
  const fotosInputRef = useRef<HTMLInputElement>(null);
  const docsInputRef = useRef<HTMLInputElement>(null);

  // Fila con IA
  const [iaTexto, setIaTexto] = useState("");
  const [iaCargando, setIaCargando] = useState(false);

  // Calculadora rápida
  const [mostrarCalculadora, setMostrarCalculadora] = useState(false);

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

  /* Fotos de relevamiento */
  const agregarFotos = (files: FileList | null) => {
    if (!files) return;
    const nuevas = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, MAX_FOTOS - fotos.length)
      .map((file) => ({ file, preview: URL.createObjectURL(file) }));
    if (nuevas.length > 0) setFotos((prev) => [...prev, ...nuevas]);
  };

  const quitarFoto = (index: number) => {
    setFotos((prev) => {
      const copia = [...prev];
      URL.revokeObjectURL(copia[index].preview);
      copia.splice(index, 1);
      return copia;
    });
  };

  /* Documentos PDF/DWG */
  const agregarDocumentos = (files: FileList | null) => {
    if (!files) return;
    const nuevos = Array.from(files).slice(0, MAX_DOCS - documentos.length);
    if (nuevos.length > 0) setDocumentos((prev) => [...prev, ...nuevos]);
  };

  const quitarDocumento = (index: number) => {
    setDocumentos((prev) => prev.filter((_, i) => i !== index));
  };

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

  /* Fila generada a partir de descripción en lenguaje natural (placeholder local) */
  const agregarFilaIA = async () => {
    if (!iaTexto.trim() || iaCargando) return;
    setIaCargando(true);
    try {
      await new Promise((r) => setTimeout(r, 400));
      setFilas((prev) => [
        ...prev,
        {
          ...nuevaFila(),
          descripcion: iaTexto.trim(),
          cantidad: 1,
        },
      ]);
      setIaTexto("");
    } finally {
      setIaCargando(false);
    }
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
            <button
              onClick={exportarExcel}
              className="flex items-center gap-1.5 px-3 py-2 rounded-[8px] border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors flex-shrink-0"
            >
              <Download className="w-3.5 h-3.5" /> Exportar Excel
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto w-full px-3 md:px-6 py-6 flex-1 space-y-4">
        {/* ── Documentación ────────────────────────────────── */}
        <CardColapsable titulo="Documentación">
          <div className="space-y-5">
            {/* Fotos de relevamiento */}
            <div>
              <label className="block text-sm font-semibold text-[#1A3A5C] mb-2">
                Fotos de relevamiento
              </label>
              <input
                ref={fotosInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  agregarFotos(e.target.files);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fotosInputRef.current?.click()}
                disabled={fotos.length >= MAX_FOTOS}
                className={cn(
                  "flex items-center gap-1.5 text-xs font-medium transition-colors",
                  fotos.length >= MAX_FOTOS
                    ? "text-slate-300 cursor-not-allowed"
                    : "text-slate-400 hover:text-[#2563EB]"
                )}
              >
                <Camera className="w-3.5 h-3.5" />
                Agregar fotos
                {fotos.length > 0 && (
                  <span className="text-slate-300">({fotos.length}/{MAX_FOTOS})</span>
                )}
              </button>

              {fotos.length > 0 && (
                <div className="mt-3 grid grid-cols-3 sm:grid-cols-5 md:grid-cols-10 gap-2">
                  {fotos.map((foto, i) => (
                    <div key={foto.preview} className="relative aspect-square rounded-[8px] overflow-hidden border border-slate-200 group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={foto.preview} alt={`Relevamiento ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => quitarFoto(i)}
                        className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                        aria-label="Quitar foto"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Documentos PDF/DWG */}
            <div>
              <label className="block text-sm font-semibold text-[#1A3A5C] mb-2">
                Planos y documentos (PDF / DWG)
              </label>
              <input
                ref={docsInputRef}
                type="file"
                accept=".pdf,.dwg,application/pdf"
                multiple
                className="hidden"
                onChange={(e) => {
                  agregarDocumentos(e.target.files);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => docsInputRef.current?.click()}
                disabled={documentos.length >= MAX_DOCS}
                className={cn(
                  "flex items-center gap-1.5 text-xs font-medium transition-colors",
                  documentos.length >= MAX_DOCS
                    ? "text-slate-300 cursor-not-allowed"
                    : "text-slate-400 hover:text-[#2563EB]"
                )}
              >
                <FileText className="w-3.5 h-3.5" />
                Agregar documentos
                {documentos.length > 0 && (
                  <span className="text-slate-300">({documentos.length}/{MAX_DOCS})</span>
                )}
              </button>

              {documentos.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {documentos.map((doc, i) => (
                    <li
                      key={`${doc.name}-${i}`}
                      className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-[8px] border border-slate-200 bg-slate-50 text-sm text-slate-600"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="truncate">{doc.name}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => quitarDocumento(i)}
                        className="text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
                        aria-label="Quitar documento"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Notas */}
            <div>
              <label className="block text-sm font-semibold text-[#1A3A5C] mb-2">
                Notas
              </label>
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={3}
                placeholder="Observaciones del relevamiento, accesos, estado del lugar, etc."
                className="w-full px-3 py-2 rounded-[10px] border border-slate-300 bg-[#F8FAFC] text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all resize-none"
              />
            </div>
          </div>
        </CardColapsable>

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
    </div>
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
