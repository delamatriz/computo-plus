"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { X, Upload, Loader2, CheckCircle2, AlertTriangle, FileText, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  mejorCoincidencia,
  type CandidatoImportacion,
  type CoincidenciaImportacion,
} from "@/lib/similitudDescripcion";

interface Props {
  proveedoresExistentes: string[];
  onClose: () => void;
  onImportado: () => void;
}

type CampoMapeable = "codigo" | "descripcion" | "unidad" | "precio";
type Fuente = "excel" | "pdf";
type Confianza = "alta" | "media" | "baja";

// Encabezados típicos, case-insensitive — usados solo para PRE-seleccionar
// la columna en los desplegables; el usuario siempre puede corregir a
// mano si la auto-detección falla o el archivo viene en otro idioma.
const SINONIMOS: Record<CampoMapeable, string[]> = {
  codigo: ["codigo", "código", "code", "cod", "sku"],
  descripcion: ["descripcion", "descripción", "desc", "producto", "item", "ítem", "artículo", "articulo", "material", "nombre"],
  unidad: ["unidad", "un", "medida", "um", "unid", "unit"],
  precio: ["precio", "price", "valor", "importe", "costo", "$"],
};

const CONFIANZA_ESTILO: Record<Confianza, string> = {
  alta: "bg-emerald-50 text-emerald-700",
  media: "bg-amber-50 text-amber-700",
  baja: "bg-red-50 text-red-600",
};

const CONFIANZA_LABEL: Record<Confianza, string> = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

function detectarColumna(headers: string[], campo: CampoMapeable): number | null {
  const normalizados = headers.map((h) => String(h ?? "").trim().toLowerCase());
  const sinonimos = SINONIMOS[campo];
  // 1° pasada: coincidencia exacta (evita que "descripción" matchee antes
  // que "código" solo porque contiene otra palabra parecida)
  for (let i = 0; i < normalizados.length; i++) {
    if (sinonimos.includes(normalizados[i])) return i;
  }
  // 2° pasada: contiene el sinónimo como substring
  for (let i = 0; i < normalizados.length; i++) {
    if (sinonimos.some((s) => normalizados[i].includes(s))) return i;
  }
  return null;
}

/** Acepta "1234.56", "1.234,56" y "1234,56" — formatos típicos de Excel/CSV UY. */
function parsearPrecio(valor: unknown): number | null {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  const texto = String(valor ?? "").trim();
  if (!texto) return null;
  let normalizado = texto.replace(/[^\d.,-]/g, "");
  if (normalizado.includes(",") && normalizado.includes(".")) {
    // Ambos separadores presentes — el último es el decimal
    normalizado =
      normalizado.lastIndexOf(",") > normalizado.lastIndexOf(".")
        ? normalizado.replace(/\./g, "").replace(",", ".")
        : normalizado.replace(/,/g, "");
  } else if (normalizado.includes(",")) {
    normalizado = normalizado.replace(",", ".");
  }
  const num = Number(normalizado);
  return Number.isFinite(num) ? num : null;
}

function leerComoDataURL(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(f);
  });
}

// Forma común antes de clasificar contra el catálogo — la arma tanto el
// parseo de Excel/CSV (client-side, ver manejarArchivo) como la respuesta
// de /api/precios-mtop/extraer-pdf. `confianza` solo viene de la fuente
// PDF; ausente (undefined) para Excel, que no tiene ese concepto.
interface FilaBase {
  fila: number;
  codigo: string;
  descripcion: string;
  unidad: string;
  precioUnitario: number | null;
  confianza?: Confianza;
}

interface FilaVistaPrevia extends FilaBase {
  coincidencia: CoincidenciaImportacion | null;
  valida: boolean;
  // Tildado para importar — true por default, salvo confianza "baja"
  // (arranca destildada, el usuario la revisa y tilda a mano si
  // corresponde). Para filas de Excel (sin confianza) siempre true, no
  // hay checkbox visible — mismo comportamiento que antes de este cambio.
  incluida: boolean;
}

export default function ModalImportarPrecios({ proveedoresExistentes, onClose, onImportado }: Props) {
  const [fuente, setFuente] = useState<Fuente>("excel");
  const [proveedor, setProveedor] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [filasCrudas, setFilasCrudas] = useState<unknown[][]>([]);
  const [mapeo, setMapeo] = useState<Record<CampoMapeable, number | null>>({
    codigo: null,
    descripcion: null,
    unidad: null,
    precio: null,
  });
  const [archivoPDF, setArchivoPDF] = useState<File | null>(null);
  // Filas ya extraídas por Claude, previas a clasificar contra el
  // catálogo — se guardan aparte de vistaPrevia para poder reclasificar
  // (ej. el usuario corrige el proveedor sugerido) sin volver a mandarle
  // el PDF a Claude.
  const [filasBasePDF, setFilasBasePDF] = useState<FilaBase[] | null>(null);
  const [extrayendoPDF, setExtrayendoPDF] = useState(false);

  const [vistaPrevia, setVistaPrevia] = useState<FilaVistaPrevia[] | null>(null);
  const [cargandoArchivo, setCargandoArchivo] = useState(false);
  const [cargandoPreview, setCargandoPreview] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumen, setResumen] = useState<{ actualizados: number; nuevos: number; total: number } | null>(null);
  // Candidatos del último fetch contra el catálogo (por proveedor) — se
  // reusan al editar una fila a mano (ver editarFilaPDF), para no pegarle
  // una consulta nueva al servidor por cada tecla.
  const [candidatosCache, setCandidatosCache] = useState<CandidatoImportacion[]>([]);
  // Materiales de rubros reales SIN precioMTOPId cuyo matching por texto
  // (sin filtrar proveedor, ver resolverPreciosVigentes/
  // buscarCoincidenciasPorTexto) se volvió ambiguo con las filas que esta
  // importación acaba de agregar/actualizar al catálogo — mismo tipo de
  // problema silencioso que pasó con "Cemento Portland" antes de tener el
  // vínculo real. Vacío en la enorme mayoría de las importaciones (hoy
  // solo hay 4 materiales sin vínculo en toda la base), por eso solo se
  // muestra la sección si hay algo que avisar.
  const [ambiguosDetectados, setAmbiguosDetectados] = useState<
    { materialAPUId: string; proyectoId: string; proyectoNombre: string; rubroNombre: string; descripcion: string; candidatos: { id: string; descripcion: string; precio: number }[] }[]
  >([]);

  const mapeoCompleto = mapeo.descripcion != null && mapeo.unidad != null && mapeo.precio != null;

  function cambiarFuente(f: Fuente) {
    if (f === fuente) return;
    setFuente(f);
    setError(null);
    setVistaPrevia(null);
    setResumen(null);
    setArchivo(null);
    setHeaders([]);
    setFilasCrudas([]);
    setMapeo({ codigo: null, descripcion: null, unidad: null, precio: null });
    setArchivoPDF(null);
    setFilasBasePDF(null);
  }

  async function manejarArchivo(f: File) {
    setError(null);
    setVistaPrevia(null);
    setResumen(null);
    setArchivo(f);
    setCargandoArchivo(true);
    try {
      // CSV es texto plano — si se lee como ArrayBuffer crudo, SheetJS no
      // siempre detecta UTF-8 y las tildes/ñ salen mojibake ("CÃ³digo").
      // Decodificando primero como texto UTF-8 y pasando ese string
      // (type: "string") evita el problema. Los .xlsx/.xls SÍ son binarios
      // reales — esos siguen leyéndose como ArrayBuffer, sin tocar.
      const esCSV = f.name.toLowerCase().endsWith(".csv") || f.type === "text/csv";
      const wb = esCSV
        ? XLSX.read(new TextDecoder("utf-8").decode(await f.arrayBuffer()), { type: "string" })
        : XLSX.read(await f.arrayBuffer(), { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const filas: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      if (filas.length < 2) {
        setError("El archivo no tiene filas de datos (solo encabezado, o está vacío).");
        setCargandoArchivo(false);
        return;
      }
      const encabezados = filas[0].map((h) => String(h ?? ""));
      setHeaders(encabezados);
      setFilasCrudas(filas.slice(1).filter((f) => f.some((c) => String(c ?? "").trim() !== "")));
      setMapeo({
        codigo: detectarColumna(encabezados, "codigo"),
        descripcion: detectarColumna(encabezados, "descripcion"),
        unidad: detectarColumna(encabezados, "unidad"),
        precio: detectarColumna(encabezados, "precio"),
      });
    } catch (err) {
      console.error("[importar precios] error leyendo archivo", err);
      setError("No se pudo leer el archivo — confirmá que sea un Excel (.xlsx/.xls) o CSV válido.");
    } finally {
      setCargandoArchivo(false);
    }
  }

  function manejarArchivoPDF(f: File) {
    setError(null);
    setVistaPrevia(null);
    setResumen(null);
    setFilasBasePDF(null);
    setArchivoPDF(f);
  }

  // Clasifica un lote de filas base contra el catálogo del proveedor dado
  // — mismo criterio de matching (isomorfo, ver similitudDescripcion.ts)
  // que ya usaba el flujo de Excel, ahora compartido con PDF para no
  // duplicar la lógica de "Actualiza" vs "Nuevo".
  async function clasificarContraCatalogo(filasBase: FilaBase[], proveedorActual: string): Promise<FilaVistaPrevia[]> {
    const res = await fetch(`/api/precios-mtop?proveedorExacto=${encodeURIComponent(proveedorActual)}`);
    const candidatos: CandidatoImportacion[] = res.ok ? await res.json() : [];
    setCandidatosCache(candidatos);
    return filasBase.map((f) => {
      const valida = f.descripcion.trim().length > 0 && f.unidad.trim().length > 0 && f.precioUnitario != null && f.precioUnitario > 0;
      const coincidencia = valida ? mejorCoincidencia(f.descripcion, candidatos) : null;
      return { ...f, coincidencia, valida, incluida: f.confianza !== "baja" };
    });
  }

  async function previsualizar() {
    if (!proveedor.trim() || !mapeoCompleto) return;
    setCargandoPreview(true);
    setError(null);
    try {
      const filasBase: FilaBase[] = filasCrudas.map((f, i) => {
        const descripcion = String(f[mapeo.descripcion!] ?? "").trim();
        const unidad = String(f[mapeo.unidad!] ?? "").trim();
        const precioUnitario = parsearPrecio(f[mapeo.precio!]);
        const codigo = mapeo.codigo != null ? String(f[mapeo.codigo] ?? "").trim() : "";
        return { fila: i + 2, codigo, descripcion, unidad, precioUnitario };
      });
      setVistaPrevia(await clasificarContraCatalogo(filasBase, proveedor.trim()));
    } catch (err) {
      console.error("[importar precios] error en preview", err);
      setError("No se pudo generar la vista previa. Probá de nuevo.");
    } finally {
      setCargandoPreview(false);
    }
  }

  async function extraerConIA() {
    if (!archivoPDF) return;
    setExtrayendoPDF(true);
    setError(null);
    try {
      const dataUrl = await leerComoDataURL(archivoPDF);
      const res = await fetch("/api/precios-mtop/extraer-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archivo: dataUrl }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(
          data?.error === "no_es_pdf"
            ? "El archivo elegido no es un PDF válido."
            : "No pude leer la lista con certeza. Probá con otro PDF, o cargala como Excel/CSV."
        );
        return;
      }
      const data: {
        proveedor: string | null;
        items: { codigo: string | null; descripcion: string; unidad: string | null; precioUnitario: number; confianza: Confianza }[];
      } = await res.json();

      const proveedorFinal = proveedor.trim() || data.proveedor || "";
      if (!proveedor.trim() && data.proveedor) setProveedor(data.proveedor);

      const filasBase: FilaBase[] = data.items.map((it, i) => ({
        fila: i + 1,
        codigo: it.codigo ?? "",
        descripcion: it.descripcion,
        unidad: it.unidad ?? "",
        precioUnitario: it.precioUnitario,
        confianza: it.confianza,
      }));
      setFilasBasePDF(filasBase);
      setVistaPrevia(await clasificarContraCatalogo(filasBase, proveedorFinal));
    } catch (err) {
      console.error("[importar precios] error extrayendo PDF", err);
      setError("No se pudo leer el PDF. Probá de nuevo.");
    } finally {
      setExtrayendoPDF(false);
    }
  }

  // Re-clasifica las filas ya extraídas contra el catálogo, sin volver a
  // llamar a Claude — para cuando el usuario corrige el proveedor después
  // de ver el resultado de la extracción.
  async function reclasificarPDF() {
    if (!filasBasePDF) return;
    setCargandoPreview(true);
    setError(null);
    try {
      setVistaPrevia(await clasificarContraCatalogo(filasBasePDF, proveedor.trim()));
    } catch (err) {
      console.error("[importar precios] error reclasificando", err);
      setError("No se pudo reclasificar. Probá de nuevo.");
    } finally {
      setCargandoPreview(false);
    }
  }

  function editarFilaPDF(fila: number, campo: "descripcion" | "unidad" | "precioUnitario", valor: string) {
    setVistaPrevia((prev) => {
      if (!prev) return prev;
      return prev.map((f) => {
        if (f.fila !== fila) return f;
        const actualizada: FilaVistaPrevia = {
          ...f,
          [campo]: campo === "precioUnitario" ? parsearPrecio(valor) : valor,
        };
        actualizada.valida =
          actualizada.descripcion.trim().length > 0 &&
          actualizada.unidad.trim().length > 0 &&
          actualizada.precioUnitario != null &&
          actualizada.precioUnitario > 0;
        actualizada.coincidencia = actualizada.valida ? mejorCoincidencia(actualizada.descripcion, candidatosCache) : null;
        return actualizada;
      });
    });
  }

  function alternarIncluida(fila: number) {
    setVistaPrevia((prev) => (prev ? prev.map((f) => (f.fila === fila ? { ...f, incluida: !f.incluida } : f)) : prev));
  }

  async function confirmarImportacion() {
    if (!vistaPrevia) return;
    setConfirmando(true);
    setError(null);
    try {
      const filas = vistaPrevia
        .filter((f) => f.valida && f.incluida)
        .map((f) => ({
          codigo: f.codigo || undefined,
          descripcion: f.descripcion,
          unidad: f.unidad,
          precioUnitario: f.precioUnitario,
        }));
      const res = await fetch("/api/precios-mtop/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proveedor: proveedor.trim(), filas }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `Error del servidor (${res.status})`);
      }
      const data = await res.json();
      setResumen(data.resumen);
      setAmbiguosDetectados(data.ambiguosDetectados ?? []);
      onImportado();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo confirmar la importación.");
    } finally {
      setConfirmando(false);
    }
  }

  const conteo = useMemo(() => {
    if (!vistaPrevia) return null;
    const validas = vistaPrevia.filter((f) => f.valida);
    return {
      actualiza: validas.filter((f) => f.coincidencia).length,
      nuevo: validas.filter((f) => !f.coincidencia).length,
      invalidas: vistaPrevia.length - validas.length,
      tildadas: vistaPrevia.filter((f) => f.valida && f.incluida).length,
    };
  }, [vistaPrevia]);

  const puedeConfirmar = (conteo?.tildadas ?? 0) > 0;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={confirmando ? undefined : onClose} />
      <div className="relative w-full max-w-3xl max-h-[85vh] bg-white rounded-[16px] shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
          <h2 className="text-base font-bold text-[#1A3A5C]">Importar lista de precios</h2>
          <button
            onClick={onClose}
            disabled={confirmando}
            className="p-1.5 rounded-[6px] text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          {resumen ? (
            <div className="py-8">
              <div className="text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                <p className="text-sm font-semibold text-[#1A3A5C] mb-1">Importación aplicada</p>
                <p className="text-sm text-slate-500">
                  {resumen.actualizados} material{resumen.actualizados !== 1 ? "es" : ""} actualizado
                  {resumen.actualizados !== 1 ? "s" : ""}, {resumen.nuevos} nuevo{resumen.nuevos !== 1 ? "s" : ""} — de{" "}
                  {resumen.total} fila{resumen.total !== 1 ? "s" : ""} válida{resumen.total !== 1 ? "s" : ""}.
                </p>
              </div>

              {ambiguosDetectados.length > 0 && (
                <div className="mt-6 rounded-[10px] border border-amber-200 bg-amber-50 p-4">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-700 mb-2">
                    <AlertTriangle className="w-4 h-4" />
                    {ambiguosDetectados.length} material{ambiguosDetectados.length !== 1 ? "es" : ""} podría
                    {ambiguosDetectados.length !== 1 ? "n" : ""} necesitar revisión
                  </p>
                  <p className="text-xs text-amber-600 mb-3">
                    Estos materiales todavía no tienen un vínculo real con el catálogo, y ahora coinciden por texto
                    con más de una fila — el próximo "actualizar al precio vigente" podría tomar la variante
                    equivocada.
                  </p>
                  <ul className="space-y-2">
                    {ambiguosDetectados.map((a) => (
                      <li key={a.materialAPUId} className="text-xs bg-white rounded-[8px] border border-amber-100 px-3 py-2">
                        <a
                          href={`/materiales?q=${encodeURIComponent(a.descripcion)}&from=${a.proyectoId}`}
                          className="font-semibold text-[#2563EB] hover:underline"
                        >
                          {a.descripcion}
                        </a>
                        <span className="text-slate-500"> — {a.proyectoNombre} / {a.rubroNombre}</span>
                        <span className="block text-slate-400 mt-0.5">
                          {a.candidatos.length} coincidencias: {a.candidatos.map((c) => c.descripcion).join(", ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Fuente */}
              <div className="flex items-center gap-1 rounded-[8px] bg-slate-100 p-1 w-fit">
                {(["excel", "pdf"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => cambiarFuente(f)}
                    className={cn(
                      "px-3 py-1.5 rounded-[6px] text-xs font-medium transition-colors",
                      fuente === f ? "bg-white text-[#1A3A5C] shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    {f === "excel" ? "Excel / CSV" : "PDF"}
                  </button>
                ))}
              </div>

              {/* Proveedor */}
              <div>
                <label className="block text-sm font-semibold text-[#1A3A5C] mb-1.5">Proveedor</label>
                <input
                  type="text"
                  list="proveedores-existentes"
                  value={proveedor}
                  onChange={(e) => {
                    setProveedor(e.target.value);
                    setVistaPrevia(null);
                  }}
                  placeholder="Ej: Sodimac Uruguay, Barraca Carmela..."
                  className="w-full px-3 py-2 rounded-[10px] border border-slate-300 bg-[#F8FAFC] text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
                />
                <datalist id="proveedores-existentes">
                  {proveedoresExistentes.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
                <p className="text-xs text-slate-400 mt-1">
                  {fuente === "excel"
                    ? "Elegí uno ya usado o escribí uno nuevo — todos los proveedores conviven en el mismo catálogo."
                    : "Si el PDF trae un membrete identificable, se completa solo al extraer — igual podés corregirlo."}
                </p>
              </div>

              {fuente === "excel" ? (
                <>
                  {/* Archivo Excel/CSV */}
                  <div>
                    <label className="block text-sm font-semibold text-[#1A3A5C] mb-1.5">Archivo (Excel o CSV)</label>
                    <label
                      className={cn(
                        "flex items-center justify-center gap-2 px-4 py-6 rounded-[10px] border-2 border-dashed cursor-pointer transition-colors",
                        archivo ? "border-emerald-300 bg-emerald-50" : "border-slate-300 bg-[#F8FAFC] hover:border-[#2563EB]/40"
                      )}
                    >
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) manejarArchivo(f);
                        }}
                      />
                      {cargandoArchivo ? (
                        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                      ) : (
                        <Upload className="w-4 h-4 text-slate-400" />
                      )}
                      <span className="text-sm text-slate-600">
                        {archivo ? archivo.name : "Hacé clic para elegir un archivo"}
                      </span>
                    </label>
                  </div>

                  {/* Mapeo de columnas */}
                  {headers.length > 0 && (
                    <div className="rounded-[10px] border border-slate-200 p-3 space-y-2">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Columnas del archivo ({filasCrudas.length} fila{filasCrudas.length !== 1 ? "s" : ""} de datos)
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {(["codigo", "descripcion", "unidad", "precio"] as CampoMapeable[]).map((campo) => (
                          <div key={campo}>
                            <label className="block text-[11px] text-slate-500 mb-0.5 capitalize">
                              {campo === "codigo" ? "Código (opcional)" : campo}
                            </label>
                            <select
                              value={mapeo[campo] ?? ""}
                              onChange={(e) => {
                                const val = e.target.value === "" ? null : Number(e.target.value);
                                setMapeo((prev) => ({ ...prev, [campo]: val }));
                                setVistaPrevia(null);
                              }}
                              className="w-full text-xs border border-slate-200 rounded-[6px] px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30"
                            >
                              <option value="">— sin asignar —</option>
                              {headers.map((h, i) => (
                                <option key={i} value={i}>
                                  {h || `Columna ${i + 1}`}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                      {!mapeoCompleto && (
                        <p className="text-xs text-amber-600 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Descripción, Unidad y Precio son obligatorias.
                        </p>
                      )}
                    </div>
                  )}

                  {error && <p className="text-xs text-red-600">{error}</p>}

                  {headers.length > 0 && !vistaPrevia && (
                    <button
                      onClick={previsualizar}
                      disabled={!proveedor.trim() || !mapeoCompleto || cargandoPreview}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-[10px] bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1A3A5C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {cargandoPreview && <Loader2 className="w-4 h-4 animate-spin" />}
                      {cargandoPreview ? "Generando vista previa..." : "Previsualizar"}
                    </button>
                  )}
                </>
              ) : (
                <>
                  {/* Archivo PDF */}
                  <div>
                    <label className="block text-sm font-semibold text-[#1A3A5C] mb-1.5">Archivo (PDF)</label>
                    <label
                      className={cn(
                        "flex items-center justify-center gap-2 px-4 py-6 rounded-[10px] border-2 border-dashed cursor-pointer transition-colors",
                        archivoPDF ? "border-emerald-300 bg-emerald-50" : "border-slate-300 bg-[#F8FAFC] hover:border-[#2563EB]/40"
                      )}
                    >
                      <input
                        type="file"
                        accept=".pdf,application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) manejarArchivoPDF(f);
                        }}
                      />
                      <FileText className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-600">
                        {archivoPDF ? archivoPDF.name : "Hacé clic para elegir un PDF"}
                      </span>
                    </label>
                    <p className="text-xs text-slate-400 mt-1">
                      Una IA lee el PDF y arma la lista — revisá el resultado antes de confirmar, sobre todo las filas
                      de confianza media o baja.
                    </p>
                  </div>

                  {error && <p className="text-xs text-red-600">{error}</p>}

                  {archivoPDF && !vistaPrevia && (
                    <button
                      onClick={filasBasePDF ? reclasificarPDF : extraerConIA}
                      disabled={extrayendoPDF || cargandoPreview}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-[10px] bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1A3A5C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {(extrayendoPDF || cargandoPreview) ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                      {extrayendoPDF
                        ? "Leyendo PDF con IA..."
                        : cargandoPreview
                        ? "Clasificando..."
                        : filasBasePDF
                        ? "Volver a clasificar con este proveedor"
                        : "Extraer con IA"}
                    </button>
                  )}
                </>
              )}

              {/* Vista previa */}
              {vistaPrevia && conteo && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-xs flex-wrap">
                    <span className="px-2 py-1 rounded-[6px] bg-blue-50 text-blue-700 font-semibold">
                      {conteo.actualiza} actualiza
                    </span>
                    <span className="px-2 py-1 rounded-[6px] bg-emerald-50 text-emerald-700 font-semibold">
                      {conteo.nuevo} nuevo{conteo.nuevo !== 1 ? "s" : ""}
                    </span>
                    {conteo.invalidas > 0 && (
                      <span className="px-2 py-1 rounded-[6px] bg-red-50 text-red-600 font-semibold">
                        {conteo.invalidas} sin datos válidos (se ignoran)
                      </span>
                    )}
                    {fuente === "pdf" && (
                      <span className="px-2 py-1 rounded-[6px] bg-slate-100 text-slate-600 font-semibold">
                        {conteo.tildadas} tildada{conteo.tildadas !== 1 ? "s" : ""} para importar
                      </span>
                    )}
                  </div>
                  <div className="rounded-[10px] border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto max-h-64 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 sticky top-0">
                          <tr>
                            {fuente === "pdf" && <th className="px-3 py-2 w-8"></th>}
                            <th className="text-left px-3 py-2 font-semibold text-slate-500">Descripción</th>
                            {fuente === "pdf" && (
                              <th className="text-left px-3 py-2 font-semibold text-slate-500 w-20">Unidad</th>
                            )}
                            {fuente === "pdf" && (
                              <th className="text-left px-3 py-2 font-semibold text-slate-500 w-20">Confianza</th>
                            )}
                            <th className="text-left px-3 py-2 font-semibold text-slate-500">Estado</th>
                            <th className="text-right px-3 py-2 font-semibold text-slate-500">Precio actual</th>
                            <th className="text-right px-3 py-2 font-semibold text-slate-500">Precio nuevo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {vistaPrevia.map((f) => (
                            <tr
                              key={f.fila}
                              className={cn(
                                "border-t border-slate-100",
                                !f.valida && "opacity-40",
                                f.valida && !f.incluida && "opacity-50 bg-slate-50/60"
                              )}
                            >
                              {fuente === "pdf" && (
                                <td className="px-3 py-2">
                                  <input
                                    type="checkbox"
                                    checked={f.incluida}
                                    onChange={() => alternarIncluida(f.fila)}
                                    disabled={!f.valida}
                                    className="rounded border-slate-300"
                                  />
                                </td>
                              )}
                              <td className="px-3 py-2 text-slate-700">
                                {fuente === "pdf" ? (
                                  <input
                                    type="text"
                                    value={f.descripcion}
                                    onChange={(e) => editarFilaPDF(f.fila, "descripcion", e.target.value)}
                                    className="w-full min-w-[140px] px-1.5 py-1 text-xs border border-transparent hover:border-slate-200 focus:border-[#2563EB] rounded-[4px] bg-transparent focus:bg-white focus:outline-none"
                                  />
                                ) : (
                                  f.descripcion || <span className="italic text-slate-400">(sin descripción)</span>
                                )}
                              </td>
                              {fuente === "pdf" && (
                                <td className="px-3 py-2">
                                  <input
                                    type="text"
                                    value={f.unidad}
                                    onChange={(e) => editarFilaPDF(f.fila, "unidad", e.target.value)}
                                    className="w-16 px-1.5 py-1 text-xs border border-transparent hover:border-slate-200 focus:border-[#2563EB] rounded-[4px] bg-transparent focus:bg-white focus:outline-none"
                                  />
                                </td>
                              )}
                              {fuente === "pdf" && (
                                <td className="px-3 py-2">
                                  {f.confianza && (
                                    <span className={cn("px-1.5 py-0.5 rounded-[4px] font-semibold", CONFIANZA_ESTILO[f.confianza])}>
                                      {CONFIANZA_LABEL[f.confianza]}
                                    </span>
                                  )}
                                </td>
                              )}
                              <td className="px-3 py-2">
                                {!f.valida ? (
                                  <span className="text-red-500">Sin datos válidos</span>
                                ) : f.coincidencia ? (
                                  <span className="text-blue-600" title={`Coincide con: ${f.coincidencia.candidato.descripcion} (${Math.round(f.coincidencia.score * 100)}% similitud)`}>
                                    Actualiza — {f.coincidencia.candidato.codigo}
                                  </span>
                                ) : (
                                  <span className="text-emerald-600">Nuevo</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                                {f.coincidencia ? `$ ${Math.round(f.coincidencia.candidato.precioUnitario).toLocaleString("es-UY")}` : "—"}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums font-semibold text-[#1A3A5C]">
                                {fuente === "pdf" ? (
                                  <input
                                    type="number"
                                    value={f.precioUnitario ?? ""}
                                    onChange={(e) => editarFilaPDF(f.fila, "precioUnitario", e.target.value)}
                                    className="w-20 px-1.5 py-1 text-right text-xs border border-transparent hover:border-slate-200 focus:border-[#2563EB] rounded-[4px] bg-transparent focus:bg-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                ) : f.precioUnitario != null ? (
                                  `$ ${Math.round(f.precioUnitario).toLocaleString("es-UY")}`
                                ) : (
                                  "—"
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2 flex-shrink-0">
          {resumen ? (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-[8px] text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] transition-colors"
            >
              Cerrar
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                disabled={confirmando}
                className="px-4 py-2 rounded-[8px] text-sm font-medium text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-40"
              >
                Cancelar
              </button>
              {vistaPrevia && (
                <button
                  onClick={confirmarImportacion}
                  disabled={confirmando || !puedeConfirmar}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-2 rounded-[8px] text-sm font-semibold text-white transition-colors",
                    confirmando ? "bg-slate-300 cursor-not-allowed" : "bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {confirmando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {confirmando ? "Importando..." : "Confirmar importación"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
