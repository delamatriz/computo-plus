// Mensaje para mostrar cuando falla la subida de un archivo. Si el servidor lo
// rechazó con 400 (tipo no permitido, supera el tamaño — ver
// lib/archivosSubidos.ts), se muestra su motivo; si no, uno genérico.
export const MENSAJE_SUBIDA_GENERICO = "No se pudo subir el archivo. Probá de nuevo.";

export async function motivoRechazoSubida(res: Response): Promise<string> {
  const data = await res.json().catch(() => null);
  return res.status === 400 && typeof data?.error === "string" && data.error ? data.error : MENSAJE_SUBIDA_GENERICO;
}

/** Para el catch: el motivo si vino en el Error, si no el genérico. */
export function mensajeDeErrorSubida(err: unknown): string {
  return err instanceof Error && err.message ? err.message : MENSAJE_SUBIDA_GENERICO;
}
