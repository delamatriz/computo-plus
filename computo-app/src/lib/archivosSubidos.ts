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

type TipoDetectado =
  | "application/pdf"
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/gif"
  | "image/vnd.dwg"
  | "application/msword"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const empiezaCon = (b: Buffer, bytes: number[], desde = 0) => bytes.every((x, i) => b[desde + i] === x);
const ascii = (b: Buffer, desde: number, largo: number) => b.subarray(desde, desde + largo).toString("latin1");

/** Tipo real según los primeros bytes; null si no es ninguno de los conocidos. */
export function detectarTipoArchivo(b: Buffer): TipoDetectado | null {
  if (ascii(b, 0, 5) === "%PDF-") return "application/pdf";
  if (empiezaCon(b, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (empiezaCon(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return "image/webp";
  if (ascii(b, 0, 6) === "GIF87a" || ascii(b, 0, 6) === "GIF89a") return "image/gif";
  // DWG de AutoCAD: "AC10xx" (AC1012 … AC1032).
  if (/^AC10\d\d$/.test(ascii(b, 0, 6))) return "image/vnd.dwg";
  // Word 97-2003 (contenedor OLE).
  if (empiezaCon(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "application/msword";
  // .docx: es un ZIP; se acepta solo si adentro está la carpeta "word/".
  if (empiezaCon(b, [0x50, 0x4b, 0x03, 0x04]) && b.subarray(0, Math.min(b.length, 64 * 1024)).includes("word/")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return null;
}

/**
 * Qué se acepta en cada lugar, y hasta cuánto:
 * - documento: PDF (10 MB) e imágenes (5 MB). Contrato, cierre, post-obra,
 *   trámites, comprobantes, remitos, documentación del llamado.
 * - foto: solo imágenes (5 MB). Bitácora, fotos de relevamiento.
 * - plano: además DWG y Word, hasta 200 MB — el mismo tope que ya muestra la
 *   pantalla de documentación para metrar (planos escaneados pesan mucho).
 */
export type PerfilArchivo = "documento" | "foto" | "plano";

const IMAGENES: TipoDetectado[] = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const LIMITES: Record<PerfilArchivo, Partial<Record<TipoDetectado, number>>> = {
  documento: { "application/pdf": 10 * MB, ...Object.fromEntries(IMAGENES.map((t) => [t, 5 * MB])) },
  foto: Object.fromEntries(IMAGENES.map((t) => [t, 5 * MB])),
  plano: {
    "application/pdf": 200 * MB,
    ...Object.fromEntries(IMAGENES.map((t) => [t, 200 * MB])),
    "image/vnd.dwg": 200 * MB,
    "application/msword": 200 * MB,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": 200 * MB,
  },
};

const DESCRIPCION_PERFIL: Record<PerfilArchivo, string> = {
  documento: "PDF, JPG, PNG, WebP o GIF",
  foto: "JPG, PNG, WebP o GIF",
  plano: "PDF, imagen, DWG o Word",
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
