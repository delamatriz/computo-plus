// Sube a "Documentación para metrar" (DocumentoMetraje) los archivos que se
// cargaron en el paso 1 del asistente de Nuevo proyecto: las fotos de
// relevamiento (categoría FOTO) y los PDF/Word (categoría PLANO). Antes se
// capturaban pero se perdían al crear el proyecto.
//
// Usa EXACTAMENTE el mismo mecanismo que el cargador de la pantalla de
// Documentación para metrar (SeccionDocumentoMetraje.tsx): el archivo se lee
// como data URL base64 y se manda como JSON a
// POST /api/proyectos/[id]/documentos-metraje (con progreso real vía XHR),
// que lo sube a Vercel Blob (privado) y crea la fila. Mismo límite de tamaño
// (MAX_ARCHIVO_MB, 200 MB por archivo — el techo real es el de la memoria del
// servidor, porque el base64 pesa ~33% más; por eso se suben de a UNO, en
// secuencia, nunca en paralelo).
//
// Crear el proyecto NO puede fallar por un problema de subida: acá nunca se
// lanza una excepción por un archivo — cada falla se devuelve en `fallidos`
// para que el asistente avise con un mensaje claro. Sin blobs huérfanos del
// lado del servidor: la ruta borra de Blob lo que subió si después falla al
// crear la fila (ver documentos-metraje/route.ts).

import { postJSONConProgreso } from "@/lib/xhrJson";
import {
  MAX_ARCHIVO_BYTES,
  MAX_ARCHIVO_MB,
  detectarTipoArchivo,
  fileToBase64,
  type CategoriaDocumento,
  type TipoArchivoDocumento,
} from "@/components/metrajes/documentoMetraje";

export interface FotoDelAsistente {
  file?: File;
  // Fotos que vienen de Cálculo Rápido por sessionStorage: base64 puro (sin el
  // prefijo "data:...") + mediaType.
  base64?: string;
  mediaType: string;
}

export interface ArchivoParaSubir {
  categoria: CategoriaDocumento;
  tipoArchivo: TipoArchivoDocumento;
  nombre: string; // nombre visible en la lista (sin extensión)
  nombreOriginal: string;
  tamano: number;
  file?: File;
  dataUrl?: string;
}

export interface FallaSubida {
  nombre: string;
  motivo: string;
}

export interface ProgresoSubida {
  actual: number; // 1-based
  total: number;
  nombre: string;
  pct: number; // progreso del archivo en curso
}

const sinExtension = (n: string) => n.replace(/\.[^.]+$/, "");
const FORMATOS_FOTO = ["image/jpeg", "image/png"];

// Arma la lista de archivos a subir a partir de lo cargado en el paso 1.
// Devuelve además los que no se pueden subir (formato o tamaño) para
// informarlos junto con las fallas de red.
export function armarArchivosDelAsistente(
  fotos: FotoDelAsistente[],
  documentos: File[]
): { archivos: ArchivoParaSubir[]; descartados: FallaSubida[] } {
  const archivos: ArchivoParaSubir[] = [];
  const descartados: FallaSubida[] = [];

  fotos.forEach((f, i) => {
    const mime = f.file?.type ?? f.mediaType;
    const nombreOriginal = f.file?.name ?? `foto-${i + 1}.${mime === "image/png" ? "png" : "jpg"}`;
    if (!FORMATOS_FOTO.includes(mime)) {
      descartados.push({ nombre: nombreOriginal, motivo: "formato no admitido (JPG o PNG)" });
      return;
    }
    const tamano = f.file?.size ?? Math.floor(((f.base64?.length ?? 0) * 3) / 4);
    if (tamano > MAX_ARCHIVO_BYTES) {
      descartados.push({ nombre: nombreOriginal, motivo: `pesa más de ${MAX_ARCHIVO_MB} MB` });
      return;
    }
    archivos.push({
      categoria: "FOTO",
      tipoArchivo: "IMAGEN",
      nombre: sinExtension(nombreOriginal),
      nombreOriginal,
      tamano,
      file: f.file,
      dataUrl: f.file ? undefined : `data:${mime};base64,${f.base64 ?? ""}`,
    });
  });

  documentos.forEach((d) => {
    const tipo = detectarTipoArchivo(d);
    if (tipo !== "PDF" && tipo !== "WORD") {
      descartados.push({ nombre: d.name, motivo: "formato no admitido (PDF o Word)" });
      return;
    }
    if (d.size > MAX_ARCHIVO_BYTES) {
      descartados.push({ nombre: d.name, motivo: `pesa más de ${MAX_ARCHIVO_MB} MB` });
      return;
    }
    archivos.push({
      categoria: "PLANO",
      tipoArchivo: tipo,
      nombre: sinExtension(d.name),
      nombreOriginal: d.name,
      tamano: d.size,
      file: d,
    });
  });

  return { archivos, descartados };
}

// Sube los archivos de a uno. Nunca lanza: devuelve cuántos se subieron y la
// lista de los que fallaron (con el motivo).
export async function subirArchivosAlProyecto(
  proyectoId: string,
  archivos: ArchivoParaSubir[],
  onProgreso?: (p: ProgresoSubida) => void
): Promise<{ subidos: number; fallidos: FallaSubida[] }> {
  const fallidos: FallaSubida[] = [];
  let subidos = 0;

  for (let i = 0; i < archivos.length; i++) {
    const a = archivos[i];
    const avisar = (pct: number) => onProgreso?.({ actual: i + 1, total: archivos.length, nombre: a.nombreOriginal, pct });
    avisar(0);
    try {
      const archivo = a.dataUrl ?? (await fileToBase64(a.file as File));
      const res = await postJSONConProgreso<{ error?: string }>(
        `/api/proyectos/${proyectoId}/documentos-metraje`,
        {
          categoria: a.categoria,
          nombre: a.nombre,
          tipoArchivo: a.tipoArchivo,
          archivo,
          nombreArchivoOriginal: a.nombreOriginal,
          // Un PDF se guarda apuntando a su página 1 (el cargador de la
          // pantalla pide elegir página; acá no hay vista previa, y la
          // página se puede cambiar subiendo el plano de nuevo desde
          // Documentación para metrar).
          paginaPDF: a.tipoArchivo === "PDF" ? 1 : null,
          tamano: a.tamano,
        },
        avisar
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        fallidos.push({ nombre: a.nombreOriginal, motivo: data?.error || `error del servidor (${res.status})` });
        continue;
      }
      subidos++;
    } catch (err) {
      fallidos.push({ nombre: a.nombreOriginal, motivo: err instanceof Error && err.message ? err.message : "no se pudo subir" });
    }
  }

  return { subidos, fallidos };
}
