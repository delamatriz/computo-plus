// Biblioteca de documentos (/biblioteca, modelo DocumentoBiblioteca).
// Isomorfo: lo usan la página (cliente) y las rutas /api/biblioteca.

export const CATEGORIAS_BIBLIOTECA = [
  { id: "normas", nombre: "Normas y Reglamentos" },
  { id: "manuales", nombre: "Manuales técnicos" },
  { id: "articulos", nombre: "Artículos y publicaciones" },
  { id: "otros", nombre: "Otros" },
] as const;

export type CategoriaBiblioteca = (typeof CATEGORIAS_BIBLIOTECA)[number]["id"];

export function esCategoriaBiblioteca(valor: unknown): valor is CategoriaBiblioteca {
  return CATEGORIAS_BIBLIOTECA.some((c) => c.id === valor);
}

export const TAMANIO_MAXIMO_BIBLIOTECA = 20 * 1024 * 1024; // 20 MB

// Tipos aceptados. Se valida por extensión (el navegador no siempre manda el
// tipo MIME de un .doc/.docx) y el tipo se fija acá al subir a Blob.
export const TIPOS_BIBLIOTECA: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export const ACCEPT_BIBLIOTECA = ".pdf,.doc,.docx";

export function extensionArchivo(nombre: string): string {
  const i = nombre.lastIndexOf(".");
  return i >= 0 ? nombre.slice(i + 1).toLowerCase() : "";
}

export function esArchivoBibliotecaValido(nombre: string): boolean {
  return extensionArchivo(nombre) in TIPOS_BIBLIOTECA;
}

export interface DocumentoBibliotecaListado {
  id: string;
  titulo: string;
  descripcion: string | null;
  categoria: string;
  nombreArchivo: string;
  tamanio: number;
  creadoEn: string;
}

/** Ruta proxy de descarga: el store de Blob es privado (ver lib/blob.ts). */
export function urlDescargaBiblioteca(id: string): string {
  return `/api/biblioteca/${id}/archivo`;
}

/** "2,3 MB", "850 KB". */
export function formatearTamanio(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toLocaleString("es-UY", { maximumFractionDigits: 1 })} MB`;
  return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("es-UY")} KB`;
}
