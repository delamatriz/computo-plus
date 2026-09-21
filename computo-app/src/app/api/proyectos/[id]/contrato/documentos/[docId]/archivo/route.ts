import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { obtenerStreamDeBlob } from "@/lib/blob";

// Proxy del archivo del documento de contrato — mismo patrón exacto
// que .../documentos-metraje/[docId]/archivo: el store de Vercel Blob
// es privado, así que esta ruta lo baja server-side (autenticado) y lo
// reenvía, para que el link "ver/descargar" del browser funcione como
// un archivo normal.
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { docId } = await context.params;

    const documento = await db.documentoContrato.findUnique({
      where: { id: docId },
      select: { urlBlob: true, tipoArchivo: true, nombreArchivoOriginal: true },
    });
    if (!documento) {
      return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    }

    const etag = `"${createHash("sha1").update(documento.urlBlob).digest("hex")}"`;
    const ifNoneMatch = req.headers.get("if-none-match");
    if (ifNoneMatch && ifNoneMatch.split(",").map((v) => v.trim()).includes(etag)) {
      return new NextResponse(null, {
        status: 304,
        headers: { "Cache-Control": "private, max-age=31536000, immutable", ETag: etag },
      });
    }

    const resultado = await obtenerStreamDeBlob(documento.urlBlob);
    if (resultado.statusCode !== 200) {
      return NextResponse.json({ error: "Archivo no disponible" }, { status: 404 });
    }
    return new NextResponse(resultado.stream, {
      headers: {
        "Content-Type": documento.tipoArchivo || resultado.blob.contentType,
        "Content-Disposition": `inline; filename="${documento.nombreArchivoOriginal}"`,
        "Cache-Control": "private, max-age=31536000, immutable",
        ETag: etag,
      },
    });
  } catch (err) {
    console.error("[GET /api/proyectos/[id]/contrato/documentos/[docId]/archivo]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
