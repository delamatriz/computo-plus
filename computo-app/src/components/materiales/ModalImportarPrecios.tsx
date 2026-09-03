"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { X, Upload, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
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

// Encabezados típicos, case-insensitive — usados solo para PRE-seleccionar
// la columna en los desplegables; el usuario siempre puede corregir a
// mano si la auto-detección falla o el archivo viene en otro idioma.
const SINONIMOS: Record<CampoMapeable, string[]> = {
  codigo: ["codigo", "código", "code", "cod", "sku"],
  descripcion: ["descripcion", "descripción", "desc", "producto", "item", "ítem", "artículo", "articulo", "material", "nombre"],
  unidad: ["unidad", "un", "medida", "um", "unid", "unit"],
  precio: ["precio", "price", "valor", "importe", "costo", "$"],
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

interface FilaVistaPrevia {
  fila: number; // número de fila del archivo (1-indexed, sin encabezado)
  codigo: string;
  descripcion: string;
  unidad: string;
  precioUnitario: number | null;
  coincidencia: CoincidenciaImportacion | null;
  valida: boolean;
}

export default function ModalImportarPrecios({ proveedoresExistentes, onClose, onImportado }: Props) {
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
  const [vistaPrevia, setVistaPrevia] = useState<FilaVistaPrevia[] | null>(null);
  const [cargandoArchivo, setCargandoArchivo] = useState(false);
  const [cargandoPreview, setCargandoPreview] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumen, setResumen] = useState<{ actualizados: number; nuevos: number; total: number } | null>(null);

  const mapeoCompleto = mapeo.descripcion != null && mapeo.unidad != null && mapeo.precio != null;

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

  async function previsualizar() {
    if (!proveedor.trim() || !mapeoCompleto) return;
    setCargandoPreview(true);
    setError(null);
    try {
      const res = await fetch(`/api/precios-mtop?proveedorExacto=${encodeURIComponent(proveedor.trim())}`);
      const candidatos: CandidatoImportacion[] = res.ok ? await res.json() : [];

      const filas: FilaVistaPrevia[] = filasCrudas.map((f, i) => {
        const descripcion = String(f[mapeo.descripcion!] ?? "").trim();
        const unidad = String(f[mapeo.unidad!] ?? "").trim();
        const precioUnitario = parsearPrecio(f[mapeo.precio!]);
        const codigo = mapeo.codigo != null ? String(f[mapeo.codigo] ?? "").trim() : "";
        const valida = descripcion.length > 0 && unidad.length > 0 && precioUnitario != null && precioUnitario > 0;
        const coincidencia = valida ? mejorCoincidencia(descripcion, candidatos) : null;
        return { fila: i + 2, codigo, descripcion, unidad, precioUnitario, coincidencia, valida };
      });
      setVistaPrevia(filas);
    } catch (err) {
      console.error("[importar precios] error en preview", err);
      setError("No se pudo generar la vista previa. Probá de nuevo.");
    } finally {
      setCargandoPreview(false);
    }
  }

  async function confirmarImportacion() {
    if (!vistaPrevia) return;
    setConfirmando(true);
    setError(null);
    try {
      const filas = vistaPrevia
        .filter((f) => f.valida)
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
    };
  }, [vistaPrevia]);

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
            <div className="text-center py-8">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
              <p className="text-sm font-semibold text-[#1A3A5C] mb-1">Importación aplicada</p>
              <p className="text-sm text-slate-500">
                {resumen.actualizados} material{resumen.actualizados !== 1 ? "es" : ""} actualizado
                {resumen.actualizados !== 1 ? "s" : ""}, {resumen.nuevos} nuevo{resumen.nuevos !== 1 ? "s" : ""} — de{" "}
                {resumen.total} fila{resumen.total !== 1 ? "s" : ""} válida{resumen.total !== 1 ? "s" : ""}.
              </p>
            </div>
          ) : (
            <>
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
                  Elegí uno ya usado o escribí uno nuevo — todos los proveedores conviven en el mismo catálogo.
                </p>
              </div>

              {/* Archivo */}
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

              {/* Botón previsualizar */}
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

              {/* Vista previa */}
              {vistaPrevia && conteo && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-xs">
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
                  </div>
                  <div className="rounded-[10px] border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto max-h-64 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 sticky top-0">
                          <tr>
                            <th className="text-left px-3 py-2 font-semibold text-slate-500">Descripción (archivo)</th>
                            <th className="text-left px-3 py-2 font-semibold text-slate-500">Estado</th>
                            <th className="text-right px-3 py-2 font-semibold text-slate-500">Precio actual</th>
                            <th className="text-right px-3 py-2 font-semibold text-slate-500">Precio nuevo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {vistaPrevia.map((f) => (
                            <tr key={f.fila} className={cn("border-t border-slate-100", !f.valida && "opacity-40")}>
                              <td className="px-3 py-2 text-slate-700">
                                {f.descripcion || <span className="italic text-slate-400">(sin descripción)</span>}
                              </td>
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
                                {f.precioUnitario != null ? `$ ${Math.round(f.precioUnitario).toLocaleString("es-UY")}` : "—"}
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
                  disabled={confirmando || conteo?.actualiza === 0 && conteo?.nuevo === 0}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-2 rounded-[8px] text-sm font-semibold text-white transition-colors",
                    confirmando ? "bg-slate-300 cursor-not-allowed" : "bg-[#2563EB] hover:bg-[#1D4ED8]"
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
