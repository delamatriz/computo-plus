// Campos de DocumentoTramite que viajan al cliente — todo menos urlBlob (la
// URL privada de Vercel Blob; el archivo se pide por la ruta proxy
// .../tramites/[tramiteId]/documentos/[docId]/archivo).
export const SELECT_DOCUMENTOS = {
  select: {
    id: true,
    nombre: true,
    nombreArchivoOriginal: true,
    tipoArchivo: true,
    tamano: true,
    createdAt: true,
  },
  orderBy: { createdAt: "asc" as const },
};

// Tope por archivo (constancias escaneadas en PDF, fotos de formularios).
// El archivo viaja como base64 en JSON, mismo patrón que DocumentoContrato.
export const TAMANO_MAX_DOCUMENTO_TRAMITE = 15 * 1024 * 1024;
