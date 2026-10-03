// Reduce en el navegador las fotos del paso 1 del asistente antes de mandarlas
// a "Sugerir capítulos": lado mayor a ~1024 px y JPEG con calidad 0,7. Una foto
// de celular pesa varios MB; así viajan unas decenas de KB y la llamada no
// revienta el límite de cuerpo del servidor. Solo se reduce la copia que se
// manda — el archivo original es el que se guarda en Documentación para metrar.

export const SUGERIR_MAX_FOTOS = 5;
const LADO_MAX = 1024;
const CALIDAD_JPEG = 0.7;

export interface FotoOrigen {
  file?: File;
  base64?: string; // sin el prefijo "data:..."
  mediaType: string;
}

export interface FotoReducida {
  data: string; // base64 sin prefijo
  mediaType: "image/jpeg";
}

function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo leer la foto"));
    img.src = src;
  });
}

async function reducir(foto: FotoOrigen): Promise<FotoReducida> {
  const url = foto.file ? URL.createObjectURL(foto.file) : `data:${foto.mediaType};base64,${foto.base64 ?? ""}`;
  try {
    const img = await cargarImagen(url);
    const escala = Math.min(1, LADO_MAX / Math.max(img.naturalWidth, img.naturalHeight));
    const ancho = Math.max(1, Math.round(img.naturalWidth * escala));
    const alto = Math.max(1, Math.round(img.naturalHeight * escala));
    const canvas = document.createElement("canvas");
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo preparar la foto");
    // Fondo blanco: un PNG con transparencia pasaría a negro al pasar a JPEG.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, ancho, alto);
    ctx.drawImage(img, 0, 0, ancho, alto);
    const data = canvas.toDataURL("image/jpeg", CALIDAD_JPEG).split(",")[1] ?? "";
    return { data, mediaType: "image/jpeg" };
  } finally {
    if (foto.file) URL.revokeObjectURL(url);
  }
}

// Reduce hasta SUGERIR_MAX_FOTOS fotos. Una foto que no se pueda leer se
// omite (no frena la sugerencia): el pedido sigue con las demás.
export async function reducirFotosParaIA(fotos: FotoOrigen[]): Promise<FotoReducida[]> {
  const resultado: FotoReducida[] = [];
  for (const f of fotos.slice(0, SUGERIR_MAX_FOTOS)) {
    try {
      const r = await reducir(f);
      if (r.data) resultado.push(r);
    } catch (err) {
      console.error("[reducirFotosParaIA]", err);
    }
  }
  return resultado;
}
