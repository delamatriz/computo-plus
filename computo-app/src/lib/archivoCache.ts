// Caché de archivos de plano/foto del lado del cliente — el proxy
// (.../archivo/route.ts) ya manda Cache-Control + ETag correctos, pero
// Next.js le agrega un header Vary (rsc, next-router-state-tree, etc.) a
// TODA respuesta de un Route Handler bajo app/api, sin forma de sacarlo
// desde la ruta — eso rompe el reuso del caché HTTP normal del navegador
// (confirmado a mano: reabrir el mismo plano de 68MB volvía a bajar el
// archivo entero). La Cache Storage API la maneja el código de acá, no el
// navegador solo, así que no le pega ese problema — nosotros controlamos
// tanto el guardado como la búsqueda, sin negociación de contenido de por
// medio.
const CACHE_NAME = "computo-plano-archivos-v1";

async function abrirCache(): Promise<Cache | null> {
  if (typeof caches === "undefined") return null;
  try {
    return await caches.open(CACHE_NAME);
  } catch {
    // Safari en modo privado (y algún otro caso raro) puede no tener Cache
    // Storage disponible — se sigue funcionando sin caché, no es fatal.
    return null;
  }
}

// Baja `url` (o la sirve del caché si ya está) y devuelve el Blob completo.
// Reporta progreso de descarga en bytes (loaded/total — total puede ser 0 si
// el proxy no manda Content-Length, ver comentario en archivo/route.ts).
export async function obtenerArchivoCacheado(
  url: string,
  opts: { signal?: AbortSignal; onProgress?: (loaded: number, total: number) => void } = {}
): Promise<Blob> {
  const cache = await abrirCache();

  if (cache) {
    const cacheado = await cache.match(url);
    if (cacheado) return cacheado.blob();
  }

  const res = await fetch(url, { signal: opts.signal });
  if (!res.ok) {
    throw new Error(`Error ${res.status} al descargar el archivo.`);
  }

  // Se guarda una copia intacta de la respuesta ANTES de leer el body con el
  // reader de abajo — un stream solo se puede consumir una vez, clone() da
  // una segunda copia independiente para el cache.put.
  if (cache) {
    cache.put(url, res.clone()).catch(() => {
      // Cuota de almacenamiento llena u otro error de guardado — no debe
      // impedir que el archivo se muestre igual.
    });
  }

  const total = Number(res.headers.get("content-length")) || 0;
  const reader = res.body?.getReader();
  if (!reader) return res.blob();

  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    opts.onProgress?.(loaded, total);
  }
  return new Blob(chunks as BlobPart[], { type: res.headers.get("content-type") || undefined });
}
