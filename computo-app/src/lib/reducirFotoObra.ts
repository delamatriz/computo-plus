// Reduce en el navegador una foto de obra antes de subirla (Bitácora, y en
// adelante cualquier adjunto fotográfico de Gestión de Obra): lado mayor a
// 1920 px y JPEG con calidad 0,82. Una foto de celular pesa 3-8 MB; así queda
// en unos cientos de KB, se sube rápido con señal de obra y sigue siendo
// legible al ampliarla. Mismo procedimiento que reducirFotosParaIA.ts, con
// más resolución porque esta foto es el registro que se guarda.

const LADO_MAX = 1920;
const CALIDAD_JPEG = 0.82;

function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo leer la foto"));
    img.src = src;
  });
}

// Devuelve la foto como data URL JPEG (formato que esperan las rutas que
// suben a Vercel Blob, ver subirArchivoABlob en lib/blob.ts).
export async function reducirFotoObra(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
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
    return canvas.toDataURL("image/jpeg", CALIDAD_JPEG);
  } finally {
    URL.revokeObjectURL(url);
  }
}
