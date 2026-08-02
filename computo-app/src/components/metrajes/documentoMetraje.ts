// Tipos y utilidades de "Documentación para metrar" — separados de
// Visor.tsx/SeccionDocumentoMetraje.tsx a propósito: esos componentes
// importan react-pdf (pdf.js), que al evaluarse revienta con "DOMMatrix is
// not defined" si se ejecuta en el servidor (pdf.js usa esa API de
// navegador a nivel de módulo, no dentro de una función). La página
// contenedora es "use client" pero de todos modos se renderiza una vez en
// el servidor (SSR normal de Next para el HTML inicial), así que un
// import estático de esos componentes ahí rompía la página con 500
// siempre — se cargan con next/dynamic({ ssr: false }) en su lugar. Este
// archivo no importa nada de react-pdf, así que se puede importar
// tranquilo desde cualquier lado (server o client) sin arrastrar ese
// problema.

// Sin esto, page.render() se queda colgado para siempre en PDFs con fuentes
// estándar (no embebidas) — pdf.js espera indefinidamente los datos de la
// fuente. Servidos como estáticos desde public/ (copiados de
// node_modules/pdfjs-dist), mismo criterio que el worker: self-hosted, sin
// depender de un CDN externo.
export const PDF_OPTIONS = { standardFontDataUrl: "/standard_fonts/", cMapUrl: "/cmaps/", cMapPacked: true };

// Límite de tamaño — el archivo se sube a Vercel Blob, así que el techo
// real es alto. Se deja un límite razonable como sanity check, no porque
// Blob lo requiera.
export const MAX_ARCHIVO_MB = 200;
export const MAX_ARCHIVO_BYTES = MAX_ARCHIVO_MB * 1024 * 1024;

// Las 3 categorías de "Documentación para metrar" (UI_UX_REDESIGN.md
// 2quinquies) — cada una con su propio listado + subida, comparten el
// mismo modelo (DocumentoMetraje.categoria). DWG se acepta solo como
// metadata/tipo de archivo, sin parseo de capas — soporte real fuera de
// alcance (ver sección 6 "Fuera de alcance — fase futura").
export type CategoriaDocumento = "PLANO" | "FOTO" | "DETALLE";
export type TipoArchivoDocumento = "PDF" | "IMAGEN" | "DWG";

export const CATEGORIAS: {
  value: CategoriaDocumento;
  label: string;
  accept: string;
  tiposPermitidos: TipoArchivoDocumento[];
  ayuda: string;
}[] = [
  {
    value: "PLANO",
    label: "Planos y documentos",
    accept: "application/pdf,image/*,.dwg",
    tiposPermitidos: ["PDF", "IMAGEN", "DWG"],
    ayuda: "PDF, imagen o DWG (sin vista previa para DWG).",
  },
  {
    value: "FOTO",
    label: "Fotos de relevamiento",
    accept: "image/jpeg,image/png",
    tiposPermitidos: ["IMAGEN"],
    ayuda: "JPG o PNG.",
  },
  {
    value: "DETALLE",
    label: "Detalles",
    accept: "image/*,application/pdf",
    tiposPermitidos: ["PDF", "IMAGEN"],
    ayuda: "JPG o PDF.",
  },
];

export function labelCategoria(categoria: CategoriaDocumento): string {
  return CATEGORIAS.find((c) => c.value === categoria)?.label ?? categoria;
}

// Detección de tipo — el navegador no siempre reporta un `file.type` útil
// para DWG (formato CAD propietario, sin MIME estándar reconocido), así
// que cae a la extensión del nombre de archivo en ese caso.
export function detectarTipoArchivo(file: File): TipoArchivoDocumento | null {
  if (file.type === "application/pdf") return "PDF";
  if (file.type.startsWith("image/")) return "IMAGEN";
  if (file.name.toLowerCase().endsWith(".dwg")) return "DWG";
  return null;
}

export interface DocumentoResumen {
  id: string;
  categoria: CategoriaDocumento;
  nombre: string;
  tipoArchivo: TipoArchivoDocumento;
  nombreArchivoOriginal: string;
  paginaPDF: number | null;
  tamano: number | null;
  createdAt: string;
}

export type MetodoCalibracion = "DECLARADA" | "COTA";

export interface DocumentoDetalle extends DocumentoResumen {
  archivo: string; // URL proxy (ver urlProxyDocumentoMetraje en @/lib/blob)
  // Calibración de escala — Etapa 2 de "Metrajes con plano" (UI_UX_REDESIGN.md
  // sección 6), solo relevante para categoria=PLANO. Sin calibrar
  // (factorEscala null) no se puede medir — principio no negociable del
  // diseño. Método B (escala declarada, ej. "1:100") es el implementado
  // por ahora; Método A ("COTA" — trazar una cota conocida) queda para
  // una ronda futura.
  escalaDeclarada: string | null;
  factorEscala: number | null;
  metodoCalibracion: MetodoCalibracion | null;
}

// Parsea una escala en formato "N:M" (ej. "1:100") y devuelve el factor
// numérico M/N — cuántas unidades reales representa una unidad del
// plano. Devuelve null si el formato no es válido (N o M no numéricos,
// o alguno <= 0).
export function parsearEscala(texto: string): { factor: number; normalizada: string } | null {
  const match = texto.trim().match(/^(\d+(?:[.,]\d+)?)\s*:\s*(\d+(?:[.,]\d+)?)$/);
  if (!match) return null;
  const n = parseFloat(match[1].replace(",", "."));
  const m = parseFloat(match[2].replace(",", "."));
  if (!isFinite(n) || !isFinite(m) || n <= 0 || m <= 0) return null;
  return { factor: m / n, normalizada: `${match[1]}:${match[2]}` };
}

// Marcas de medición trazadas sobre un plano — Etapa 3 de "Metrajes con
// plano" (UI_UX_REDESIGN.md sección 6, Modo A manual). Dos tipos hoy:
// "LINEA" (dos puntos fijos, xInicio/yInicio/xFin/yFin) y "AREA"
// (polígono de N vértices, campo puntos). Todos los puntos son
// porcentajes (0-100) del ancho/alto del documento, no píxeles. Cada
// tipo deja null los campos que no le corresponden (ver
// prisma/schema.prisma — sin constraint a nivel de base, se valida en
// la API).
export type TipoMedicion = "LINEA" | "AREA" | "PUNTO";

export interface PuntoMedicion {
  x: number;
  y: number;
}

export interface MedicionDocumento {
  id: string;
  documentoId: string;
  tipo: TipoMedicion;
  xInicio: number | null;
  yInicio: number | null;
  xFin: number | null;
  yFin: number | null;
  longitudReal: number | null;
  puntos: PuntoMedicion[] | null;
  areaReal: number | null;
  repeticiones: number;
  descripcion: string;
  rubroId: string | null;
  createdAt: string;
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
