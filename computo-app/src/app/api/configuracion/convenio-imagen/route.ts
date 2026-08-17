import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { eliminarArchivosDeBlob, obtenerStreamDeBlob, subirArchivoABlob } from "@/lib/blob";

async function getOrCreateConfiguracion() {
  const existente = await db.configuracion.findFirst();
  if (existente) return existente;
  return db.configuracion.create({ data: {} });
}

// Sube la foto del convenio SUNCA a Blob — se llama recién cuando el
// usuario confirma los jornales extraídos (guardarCambios en
// configuracion/page.tsx), nunca apenas se selecciona el archivo. Devuelve
// la URL; guardarla en Configuracion.convenioImagenUrl es responsabilidad
// del caller, vía el PATCH existente de /api/configuracion (no se escribe
// acá, para no duplicar el punto de escritura de Configuracion).
export async function POST(req: NextRequest) {
  try {
    const { imagen } = await req.json();
    if (!imagen || typeof imagen !== "string") {
      return NextResponse.json({ error: "sin_imagen" }, { status: 400 });
    }

    const config = await getOrCreateConfiguracion();

    let url: string;
    try {
      url = await subirArchivoABlob("configuracion/convenio-sunca", imagen);
    } catch (err) {
      console.error("[POST /api/configuracion/convenio-imagen] subida a blob", err);
      return NextResponse.json({ error: "No se pudo subir la imagen" }, { status: 400 });
    }

    // Reemplaza la foto anterior del convenio, si había una — evita blobs
    // huérfanos acumulándose (Configuracion es singleton, solo una vigente).
    if (config.convenioImagenUrl) {
      await eliminarArchivosDeBlob([config.convenioImagenUrl]);
    }

    return NextResponse.json({ url });
  } catch (err) {
    console.error("[POST /api/configuracion/convenio-imagen]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// Proxy — el store de Blob es privado, /mano-de-obra usa esta ruta como
// <img src>, igual patrón que .../documentos-metraje/[docId]/archivo.
export async function GET(req: NextRequest) {
  try {
    const config = await db.configuracion.findFirst({ select: { convenioImagenUrl: true } });
    if (!config?.convenioImagenUrl) {
      return NextResponse.json({ error: "Sin imagen del convenio" }, { status: 404 });
    }

    const etag = `"${createHash("sha1").update(config.convenioImagenUrl).digest("hex")}"`;
    const ifNoneMatch = req.headers.get("if-none-match");
    if (ifNoneMatch && ifNoneMatch.split(",").map((v) => v.trim()).includes(etag)) {
      return new NextResponse(null, {
        status: 304,
        headers: { "Cache-Control": "private, max-age=31536000, immutable", ETag: etag },
      });
    }

    const resultado = await obtenerStreamDeBlob(config.convenioImagenUrl);
    if (resultado.statusCode !== 200) {
      return NextResponse.json({ error: "Imagen no disponible" }, { status: 404 });
    }
    return new NextResponse(resultado.stream, {
      headers: {
        "Content-Type": resultado.blob.contentType,
        "Cache-Control": "private, max-age=31536000, immutable",
        ETag: etag,
      },
    });
  } catch (err) {
    console.error("[GET /api/configuracion/convenio-imagen]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
