import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { eliminarArchivosDeBlob, obtenerStreamDeBlob, subirArchivoABlob } from "@/lib/blob";

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
  try {
    const { archivo } = await req.json();
    if (!archivo || typeof archivo !== "string") {
      return NextResponse.json({ error: "sin_archivo" }, { status: 400 });
    }

    const config = await getOrCreateConfiguracion();

    let url: string;
    try {
      url = await subirArchivoABlob("configuracion/convenio-sunca-pdf", archivo);
    } catch (err) {
      console.error("[POST /api/configuracion/convenio-pdf] subida a blob", err);
      return NextResponse.json({ error: "No se pudo subir el archivo" }, { status: 400 });
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
