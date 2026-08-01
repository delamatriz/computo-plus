import { put, del, get, type GetBlobResult } from "@vercel/blob";

// El store de Vercel Blob de esta cuenta está configurado como privado
// (put() con access: "public" tira "Cannot use public access on a private
// store"), así que la URL que devuelve put() NO es servible directo en un
// <img src>/<Document file> del browser — hace falta pasar por un proxy en
// nuestro propio servidor que la baje con el token y la reenvíe (ver rutas
// .../archivo). Ver también obtenerStreamDeBlob más abajo.
const ACCESS = "private" as const;

// Sube un archivo recibido como data URL base64 (formato que ya usa el
// cliente para Planos/Fotos complementarias, ver fileToBase64 en
// VisorPlano.tsx) a Vercel Blob, y devuelve la URL (privada) resultante —
// se guarda tal cual en la base, para subirla/bajarla/borrarla después.
export async function subirArchivoABlob(pathname: string, dataUrl: string): Promise<string> {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Formato de archivo inválido — se esperaba un data URL en base64.");
  }
  const [, contentType, base64] = match;
  const buffer = Buffer.from(base64, "base64");

  const blob = await put(pathname, buffer, {
    access: ACCESS,
    contentType,
    addRandomSuffix: true,
  });
  return blob.url;
}

// Elimina uno o más archivos de Vercel Blob por su URL. No lanza si alguna
// URL ya no existe — evita que un archivo huérfano bloquee el borrado del
// registro en la base.
export async function eliminarArchivosDeBlob(urls: string[]): Promise<void> {
  if (urls.length === 0) return;
  try {
    await del(urls);
  } catch (err) {
    console.error("[blob] error al eliminar archivos", err);
  }
}

// Baja el contenido de un archivo privado de Blob (autenticado con
// BLOB_READ_WRITE_TOKEN) para que una ruta proxy lo reenvíe al browser.
export async function obtenerStreamDeBlob(url: string): Promise<GetBlobResult> {
  const resultado = await get(url, { access: ACCESS });
  if (!resultado) {
    throw new Error("Archivo no encontrado en Blob");
  }
  return resultado;
}

// URL que el cliente puede usar directo en <img src>/<Document file> — no
// la URL real de Blob (privada, requiere el token), sino la ruta proxy de
// nuestro propio servidor que la reenvía (ver .../archivo/route.ts).
export function urlProxyDocumentoMetraje(proyectoId: string, docId: string): string {
  return `/api/proyectos/${proyectoId}/documentos-metraje/${docId}/archivo`;
}
