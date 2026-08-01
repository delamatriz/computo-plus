// POST de un JSON body con progreso real de subida — fetch no expone el
// evento de progreso del lado de la request (solo XHR lo tiene, vía
// xhr.upload.onprogress). Se usa para la subida de planos/fotos, que van
// como data URL base64 en el body y pueden pesar varias decenas de MB.
export function postJSONConProgreso<T>(
  url: string,
  body: unknown,
  onProgress?: (pct: number) => void
): Promise<{ ok: boolean; status: number; json: () => Promise<T> }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        json: async () => JSON.parse(xhr.responseText || "null") as T,
      });
    };
    xhr.onerror = () => reject(new Error("Error de red durante la subida."));
    xhr.send(JSON.stringify(body));
  });
}
