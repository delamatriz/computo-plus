import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { eliminarArchivosDeBlob, obtenerStreamDeBlob, subirArchivoABlob } from "@/lib/blob";
import { requerirSuperadmin } from "@/lib/sesion";

async function getOrCreateConfiguracion() {
  const existente = await db.configuracion.findFirst();
  if (existente) return existente;
  return db.configuracion.create({ data: {} });
}

// Sube el PDF del convenio SUNCA firmado (Acta de Acuerdo completa) —
// a diferencia de convenio-imagen (que se sube recién al confirmar los
// jornales extraídos), acá no hay ningún paso de revisión: es un
// documento de consulta/descarga, se guarda de una sola vez al elegir
// el archivo.
export async function POST(req: NextRequest) {
  const sesionOrError = await requerirSuperadmin();
  if (sesionOrError instanceof NextResponse) return sesionOrError;

  try {
    // Cuerpo ilegible: lo más común es que exceda el tope de tamaño de la petición y llegue
    // truncado (ver proxyClientMaxBodySize en next.config.ts). Se distingue del resto para no
    // confundirlo con un fallo del storage.
    let archivo: unknown;
    try {
      ({ archivo } = await req.json());
    } catch (err) {
      console.error(
        "[POST /api/configuracion/convenio-pdf] no se pudo leer el cuerpo (¿excede el tamaño permitido?)",
        { content_length: req.headers.get("content-length"), error: err instanceof Error ? err.message : err }
      );
      return NextResponse.json({ error: "cuerpo_invalido" }, { status: 400 });
    }
    if (!archivo || typeof archivo !== "string") {
      return NextResponse.json({ error: "sin_archivo" }, { status: 400 });
    }
    if (!archivo.startsWith("data:application/pdf;base64,")) {
      return NextResponse.json({ error: "no_es_pdf" }, { status: 400 });
    }

    const config = await getOrCreateConfiguracion();

    let url: string;
    try {
      url = await subirArchivoABlob("configuracion/convenio-sunca-pdf", archivo);
    } catch (err) {
      // El error real de Vercel Blob (token ausente o inválido, tamaño, red, store…) queda en el
      // log del servidor; al cliente va solo un código, nunca el mensaje crudo.
      const e = err instanceof Error ? err : new Error(String(err));
      console.error("[POST /api/configuracion/convenio-pdf] subida a blob falló", {
        name: e.name,
        message: e.message,
        base64_chars: archivo.length,
        token_configurado: !!process.env.BLOB_READ_WRITE_TOKEN,
      });
      const sinToken = !process.env.BLOB_READ_WRITE_TOKEN || /token/i.test(e.message);
      return NextResponse.json({ error: sinToken ? "blob_sin_token" : "blob_error" }, { status: 502 });
    }

    if (config.convenioPdfUrl) {
      await eliminarArchivosDeBlob([config.convenioPdfUrl]);
    }

    const actualizada = await db.configuracion.update({
      where: { id: config.id },
      data: { convenioPdfUrl: url },
    });

    return NextResponse.json({ url: actualizada.convenioPdfUrl });
  } catch (err) {
    console.error("[POST /api/configuracion/convenio-pdf]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// Proxy de descarga — mismo patrón que .../convenio-imagen, pero con
// Content-Disposition: attachment porque este es un documento para
// descargar, no una imagen para mostrar inline.
export async function GET() {
  try {
    const config = await db.configuracion.findFirst({ select: { convenioPdfUrl: true } });
    if (!config?.convenioPdfUrl) {
      return NextResponse.json({ error: "Sin PDF del convenio" }, { status: 404 });
    }

    const resultado = await obtenerStreamDeBlob(config.convenioPdfUrl);
    if (resultado.statusCode !== 200) {
      return NextResponse.json({ error: "Archivo no disponible" }, { status: 404 });
    }
    return new NextResponse(resultado.stream, {
      headers: {
        "Content-Type": resultado.blob.contentType,
        "Content-Disposition": 'attachment; filename="Convenio-SUNCA-Grupo9-SubGrupo01.pdf"',
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (err) {
    console.error("[GET /api/configuracion/convenio-pdf]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
