// Tipos y utilidades de archivo de plano/foto — separados de VisorPlano.tsx
// a propósito: ese componente (y SeccionPlanos.tsx) importan react-pdf
// (pdf.js), que al evaluarse revienta con "DOMMatrix is not defined" si se
// ejecuta en el servidor (pdf.js usa esa API de navegador a nivel de
// módulo, no dentro de una función). La página de metrajes es "use client"
// pero de todos modos se renderiza una vez en el servidor (SSR normal de
// Next para el HTML inicial), así que un import estático de esos
// componentes ahí rompía la página con 500 siempre — se cargan con
// next/dynamic({ ssr: false }) en su lugar. Este archivo no importa nada
// de react-pdf, así que se puede importar tranquilo desde cualquier lado
// (server o client) sin arrastrar ese problema.

// Sin esto, page.render() se queda colgado para siempre en PDFs con fuentes
// estándar (no embebidas) — pdf.js espera indefinidamente los datos de la
// fuente. Servidos como estáticos desde public/ (copiados de
// node_modules/pdfjs-dist), mismo criterio que el worker: self-hosted, sin
// depender de un CDN externo.
export const PDF_OPTIONS = { standardFontDataUrl: "/standard_fonts/", cMapUrl: "/cmaps/", cMapPacked: true };

// Límite de tamaño — el archivo se sube a Vercel Blob (ya no base64 en
// Postgres, ver commit de migración a Blob), así que el techo real es
// mucho más alto que el viejo límite de 15MB atado a la conexión de la
// base. Se deja un límite razonable como sanity check, no porque Blob lo
// requiera.
export const MAX_ARCHIVO_MB = 200;
export const MAX_ARCHIVO_BYTES = MAX_ARCHIVO_MB * 1024 * 1024;

export interface FotoComplementaria {
  id: string;
  archivo: string;
  nombreArchivoOriginal: string;
  descripcion: string | null;
  createdAt: string;
}

export interface PlanoDetalle {
  id: string;
  nombre: string;
  tipoArchivo: "PDF" | "IMAGEN";
  archivo: string;
  nombreArchivoOriginal: string;
  paginaPDF: number | null;
  notas: string | null;
  fotos: FotoComplementaria[];
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
