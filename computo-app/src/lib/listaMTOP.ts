// Lista oficial MTOP (proveedor = null) — lectura del Excel y matching contra el
// catálogo. Isomorfo (sin imports de servidor): lo usan tanto la vista previa del
// modal de importación como POST /api/precios-mtop/importar, que recalcula la
// clasificación por su cuenta y nunca confía en la del cliente.
//
// Estructura del Excel oficial (pestaña principal, p. ej. "JUNIO 2026", y la pestaña
// "NUEVOS MATERIALES", que se trata igual):
//   col 1: n.º de orden · col 2: vacía · col 3: código MTOP (4001, SA001…)
//   col 4: descripción · col 5: unidad con presentación ("1 l", "100 Kg", "1 m²")
//   col 6: precio con IVA (0 = sin precio) · col 7: observación ("IVA Exonerado")
// El número y el mes de la lista vienen en un encabezado tipo "N° 606 - Junio 2026".

import { mejorCoincidencia, type CandidatoImportacion, type CoincidenciaImportacion } from "@/lib/similitudDescripcion";
import { mesUruguayISO } from "@/lib/fechaUruguay";

// Índices (base 0) de las columnas de la lista oficial.
const COL_CODIGO = 2;
const COL_DESCRIPCION = 3;
const COL_UNIDAD = 4;
const COL_PRECIO = 5;

export interface FilaListaOficial {
  /** Número de fila en la hoja (base 1), para mostrar en la vista previa */
  fila: number;
  hoja: string;
  codigo: string;
  descripcion: string;
  /** Unidad tal como viene, con su presentación: "100 Kg" */
  unidad: string;
  /** Precio de lista con IVA, por la presentación (no por unidad). 0 = sin precio */
  precioLista: number;
}

export interface EncabezadoLista {
  numeroLista: number | null;
  /** "YYYY-MM" */
  fechaLista: string | null;
}

const MESES: Record<string, string> = {
  enero: "01",
  febrero: "02",
  marzo: "03",
  abril: "04",
  mayo: "05",
  junio: "06",
  julio: "07",
  agosto: "08",
  septiembre: "09",
  setiembre: "09",
  octubre: "10",
  noviembre: "11",
  diciembre: "12",
};

function sinTildes(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** "N° 606 - Junio 2026" → 606. Null si no hay un número de lista reconocible. */
export function parsearNumeroLista(texto: string): number | null {
  const m = texto.match(/\bN\s*[°º˚o.]*\s*(\d{3,4})\b/i) ?? texto.match(/\blista\s*(?:n\s*[°º˚o.]*\s*)?(\d{3,4})\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** "Junio 2026" → "2026-06". Null si no hay mes y año reconocibles. */
export function parsearFechaLista(texto: string): string | null {
  const t = sinTildes(texto).toLowerCase();
  const m = t.match(/\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b\W*(?:de\W*)?(20\d{2})\b/);
  return m ? `${m[2]}-${MESES[m[1]]}` : null;
}

/**
 * Número y fecha de la lista a partir de los textos del encabezado (celdas de las
 * primeras filas de cada hoja) y, como respaldo para la fecha, los nombres de hoja
 * ("JUNIO 2026").
 */
export function leerEncabezadoLista(textosEncabezado: string[], nombresHoja: string[]): EncabezadoLista {
  let numeroLista: number | null = null;
  let fechaLista: string | null = null;
  for (const t of textosEncabezado) {
    numeroLista ??= parsearNumeroLista(t);
    fechaLista ??= parsearFechaLista(t);
  }
  for (const nombre of nombresHoja) fechaLista ??= parsearFechaLista(nombre);
  return { numeroLista, fechaLista };
}

function aNumeroFlexible(valor: unknown): number | null {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  const texto = String(valor ?? "").trim();
  if (!texto || !/^[\d.,\s$-]+$/.test(texto)) return null;
  let t = texto.replace(/[^\d.,-]/g, "");
  if (t.includes(",") && t.includes(".")) {
    t = t.lastIndexOf(",") > t.lastIndexOf(".") ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  } else if (t.includes(",")) {
    t = t.replace(",", ".");
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Filas de datos de una hoja de la lista oficial. Una fila cuenta si tiene código y
 * descripción y su precio es numérico (0 incluido: "sin precio", que después se marca
 * como no válida). Títulos, encabezados de columna y filas en blanco quedan afuera.
 */
export function filasDeHojaMTOP(filas: unknown[][], hoja: string): FilaListaOficial[] {
  const out: FilaListaOficial[] = [];
  filas.forEach((r, i) => {
    const codigo = String(r[COL_CODIGO] ?? "").trim();
    const descripcion = String(r[COL_DESCRIPCION] ?? "").trim();
    const precio = aNumeroFlexible(r[COL_PRECIO]);
    if (!codigo || !descripcion || precio == null) return;
    out.push({ fila: i + 1, hoja, codigo, descripcion, unidad: String(r[COL_UNIDAD] ?? "").trim(), precioLista: precio });
  });
  return out;
}

/**
 * "100 Kg" → { cantidad: 100, unidad: "kg" }. Mismo criterio que la carga original de
 * la lista: unidad en minúsculas, y la cantidad con "." de miles y "," decimal
 * ("1.000 u" = 1000, "42,5 Kg" = 42,5). Sin cantidad adelante ("m²", "Kg.") = 1.
 * Null si no hay unidad.
 */
export function parsearUnidadMTOP(texto: string): { cantidad: number; unidad: string; cantidadUnidad: string } | null {
  const original = texto.trim().replace(/\s+/g, " ");
  const m = original.match(/^(\d[\d.,]*)?\s*(.*)$/);
  if (!m) return null;
  const unidad = m[2].trim().replace(/\.+$/, "").toLowerCase();
  if (!unidad) return null;
  let cantidad = 1;
  if (m[1]) {
    const crudo = m[1].replace(/[.,]$/, "");
    const n = /^\d{1,3}(\.\d{3})+$/.test(crudo) ? Number(crudo.replace(/\./g, "")) : Number(crudo.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) return null;
    cantidad = n;
  }
  return { cantidad, unidad, cantidadUnidad: original };
}

/** Precio por unidad: precio de lista (por la presentación) / cantidad, a 2 decimales. */
export function precioUnitarioDeLista(precioLista: number, cantidad: number): number {
  return Math.round((precioLista / cantidad) * 100) / 100;
}

export interface CoincidenciaOficial extends CoincidenciaImportacion {
  via: "codigo" | "descripcion";
}

/**
 * Clasificación de la lista oficial contra el catálogo (filas con proveedor null):
 * 1) código exacto; 2) para las que no encontraron código, similitud de descripción;
 * 3) sin match = fila nueva. Los códigos se asignan en una pasada previa a la de
 * descripción para que una fila sin código en el catálogo no se "robe" por similitud
 * un material que otra fila del archivo corresponde exactamente por código. Un
 * candidato se usa una sola vez. Devuelve una coincidencia (o null) por cada fila,
 * en el mismo orden.
 */
export function clasificarListaOficial(
  filas: { codigo?: string; descripcion: string }[],
  candidatos: CandidatoImportacion[]
): (CoincidenciaOficial | null)[] {
  const resultado: (CoincidenciaOficial | null)[] = filas.map(() => null);
  const porCodigo = new Map<string, CandidatoImportacion>();
  for (const c of candidatos) if (!porCodigo.has(c.codigo.trim())) porCodigo.set(c.codigo.trim(), c);
  const usados = new Set<string>();

  filas.forEach((f, i) => {
    const codigo = f.codigo?.trim();
    if (!codigo) return;
    const c = porCodigo.get(codigo);
    if (c && !usados.has(c.id)) {
      usados.add(c.id);
      resultado[i] = { candidato: c, score: 1, via: "codigo" };
    }
  });

  let restantes = candidatos.filter((c) => !usados.has(c.id));
  filas.forEach((f, i) => {
    if (resultado[i]) return;
    const m = mejorCoincidencia(f.descripcion, restantes);
    if (!m) return;
    restantes = restantes.filter((c) => c.id !== m.candidato.id);
    resultado[i] = { ...m, via: "descripcion" };
  });

  return resultado;
}

/** "YYYY-MM" válido, o el mes actual. */
export function fechaListaONormalizada(fecha: unknown): string {
  if (typeof fecha === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(fecha)) return fecha;
  return mesUruguayISO();
}

/** Número de lista entero y positivo, o 0. */
export function numeroListaONormalizado(n: unknown): number {
  return typeof n === "number" && Number.isInteger(n) && n > 0 && n < 100000 ? n : 0;
}

// ── Lista vigente: textos para mostrarla (pantalla y prompts de IA) ─────────────────────
const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Set", "Oct", "Nov", "Dic"];

/** Lista oficial MTOP más reciente cargada en el catálogo global (ver lib/listaMTOPVigente.ts). */
export interface ListaMTOPVigente {
  numero: number;
  /** "YYYY-MM" o null si no se conoce. */
  fecha: string | null;
}

/** "2026-06" → "Jun 2026"; null si el formato no es válido. */
export function etiquetaFechaLista(fecha: string | null | undefined): string | null {
  const m = typeof fecha === "string" ? /^(\d{4})-(0[1-9]|1[0-2])$/.exec(fecha) : null;
  return m ? `${MESES_CORTOS[Number(m[2]) - 1]} ${m[1]}` : null;
}

/** "N°606" o "" si no hay lista: para "Lista Oficial MTOP N°606" sin dejar un número inventado. */
export function sufijoNumeroLista(lista: ListaMTOPVigente | null): string {
  return lista ? ` N°${lista.numero}` : "";
}

/** "N°606, Jun 2026" / "N°606" / "" — entre paréntesis en los prompts, al lado del título en pantalla. */
export function detalleListaMTOP(lista: ListaMTOPVigente | null): string {
  if (!lista) return "";
  const fecha = etiquetaFechaLista(lista.fecha);
  return fecha ? `N°${lista.numero}, ${fecha}` : `N°${lista.numero}`;
}
