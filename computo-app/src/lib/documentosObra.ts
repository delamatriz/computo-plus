// Archivos adjuntados en las secciones de Gestión de Obra, como los devuelve
// GET /api/proyectos/[id]/documentos-obra (tarjeta Documentos).

export type OrigenDocumentoObra =
  | "CONTRATO"
  | "TRAMITE"
  | "BITACORA"
  | "REMITO"
  | "COMPROBANTE"
  | "CIERRE"
  | "AS_BUILT";

export const ETIQUETA_ORIGEN: Record<OrigenDocumentoObra, string> = {
  CONTRATO: "Contrato",
  TRAMITE: "Trámites",
  BITACORA: "Fotos de bitácora",
  REMITO: "Remitos de compras",
  COMPROBANTE: "Comprobantes de caja",
  CIERRE: "Cierre de obra",
  AS_BUILT: "As-Built y post-obra",
};

export interface DocumentoObraAgregado {
  id: string;
  origen: OrigenDocumentoObra;
  titulo: string;
  detalle: string;
  href: string;
  tipo: "pdf" | "imagen" | "otro";
  tamano: number | null;
  fecha: string;
}
