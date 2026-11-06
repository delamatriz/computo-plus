// Archivos que suben los usuarios (documentos de contrato, cierre, trámites,
// comprobantes, remitos, fotos de bitácora, documentación para metrar y del
// llamado). Antes se aceptaba cualquier tipo que declarara el navegador y se
// servía en línea con ese mismo tipo: un HTML o SVG con un script corría
// dentro de la app (auditoría de seguridad nov-2026, hallazgos #1 y #4).
//
// Ahora el tipo se decide leyendo los primeros bytes del archivo (nunca el
// Content-Type del data URL), contra una lista blanca por perfil, con tope
// de tamaño. Lo que se guarda y se sirve es el tipo detectado.

const MB = 1024 * 1024;

type TipoDetectado = "application/pdf" | "image/jpeg" | "image/png" | "image/webp" | "image/gif";

const empiezaCon = (b: Buffer, bytes: number[], desde = 0) => bytes.every((x, i) => b[desde + i] === x);
const ascii = (b: Buffer, desde: number, largo: number) => b.subarray(desde, desde + largo).toString("latin1");

/** Tipo real según los primeros bytes; null si no es ninguno de los conocidos. */
export function detectarTipoArchivo(b: Buffer): TipoDetectado | null {
  if (ascii(b, 0, 5) === "%PDF-") return "application/pdf";
  if (empiezaCon(b, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (empiezaCon(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return "image/webp";
  if (ascii(b, 0, 6) === "GIF87a" || ascii(b, 0, 6) === "GIF89a") return "image/gif";
  return null;
}

/**
 * Qué se acepta en cada lugar, y hasta cuánto:
 * - documento: PDF (10 MB) e imágenes (5 MB). Contrato, cierre, post-obra,
 *   trámites, comprobantes, remitos, documentación del llamado.
 * - foto: solo imágenes (5 MB). Bitácora y certificaciones (el navegador
 *   las achica antes de subirlas).
 * - plano: PDF e imágenes hasta 25 MB. Documentación para metrar, planos y
 *   detalles: un plano exportado en alta resolución pasa fácil de 10 MB.
 * - relevamiento: solo imágenes, hasta 25 MB. Fotos de relevamiento de la
 *   documentación para metrar (se suben sin achicar).
 * DWG y Word no se aceptan en ningún lado (decisión nov-2026: no se usan).
 */
export type PerfilArchivo = "documento" | "foto" | "plano" | "relevamiento";

const IMAGENES: TipoDetectado[] = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const LIMITES: Record<PerfilArchivo, Partial<Record<TipoDetectado, number>>> = {
  documento: { "application/pdf": 10 * MB, ...Object.fromEntries(IMAGENES.map((t) => [t, 5 * MB])) },
  foto: Object.fromEntries(IMAGENES.map((t) => [t, 5 * MB])),
  plano: { "application/pdf": 25 * MB, ...Object.fromEntries(IMAGENES.map((t) => [t, 25 * MB])) },
  relevamiento: Object.fromEntries(IMAGENES.map((t) => [t, 25 * MB])),
};

const DESCRIPCION_PERFIL: Record<PerfilArchivo, string> = {
  documento: "PDF, JPG, PNG, WebP o GIF",
  foto: "JPG, PNG, WebP o GIF",
  plano: "PDF, JPG, PNG, WebP o GIF",
  relevamiento: "JPG, PNG, WebP o GIF",
};

export class ArchivoInvalidoError extends Error {}

export type ArchivoValidado = { buffer: Buffer; contentType: TipoDetectado; tamano: number };

/**
 * Valida un archivo recibido como data URL base64. Tira ArchivoInvalidoError
 * (con un mensaje para mostrar al usuario) si el formato, el tipo real o el
 * tamaño no corresponden al perfil.
 */
export function validarArchivoSubido(dataUrl: unknown, perfil: PerfilArchivo): ArchivoValidado {
  const match = typeof dataUrl === "string" ? dataUrl.match(/^data:[^;,]*;base64,([\s\S]+)$/) : null;
  if (!match) throw new ArchivoInvalidoError("Formato de archivo inválido.");
  const buffer = Buffer.from(match[1], "base64");
  const contentType = detectarTipoArchivo(buffer);
  const limite = contentType ? LIMITES[perfil][contentType] : undefined;
  if (!contentType || limite === undefined) {
    throw new ArchivoInvalidoError(`Tipo de archivo no permitido. Se aceptan: ${DESCRIPCION_PERFIL[perfil]}.`);
  }
  if (buffer.length > limite) {
    throw new ArchivoInvalidoError(`El archivo supera el tamaño máximo permitido (${limite / MB} MB).`);
  }
  return { buffer, contentType, tamano: buffer.length };
}

/**
 * Content-Disposition con el nombre que puso el usuario, sin romper el
 * header (auditoría nov-2026, hallazgo #12): un nombre con comillas o saltos
 * de línea, metido crudo en filename="…", rompía la respuesta (500). Va una
 * versión ASCII sin comillas ni barras para navegadores viejos, y el nombre
 * real codificado en filename* (mismo criterio que la Biblioteca).
 */
export function contentDispositionArchivo(nombre: string, modo: "inline" | "attachment" = "inline"): string {
  const ascii =
    nombre
      .normalize("NFD")
      .replace(/[^\x20-\x7e]/g, "")
      .replace(/["\\]/g, "_")
      .trim() || "archivo";
  return `${modo}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nombre)}`;
}

/**
 * Headers para servir un archivo subido. nosniff: el navegador respeta el
 * tipo detectado y no lo "adivina". CSP sandbox: aunque el archivo traiga
 * código, no se ejecuta con los permisos de la app. Va solo para imágenes:
 * con sandbox, Chrome no abre los PDF en su visor (y un PDF validado por
 * sus bytes se muestra en el visor del navegador, aislado de la app).
 */
export function headersSeguridadArchivo(contentType: string | null | undefined): Record<string, string> {
  const headers: Record<string, string> = { "X-Content-Type-Options": "nosniff" };
  if (contentType !== "application/pdf") headers["Content-Security-Policy"] = "sandbox";
  return headers;
}
