import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { obtenerStreamDeBlob } from "@/lib/blob";
import { requerirProyecto } from "@/lib/sesion";
import { headersSeguridadArchivo } from "@/lib/archivosSubidos";

// Proxy del archivo de un documento de trámite — mismo patrón exacto que
// .../contrato/documentos/[docId]/archivo (el store de Blob es privado).
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; tramiteId: string; docId: string }> }
) {
  try {
    const { id, tramiteId, docId } = await context.params;
    const acceso = await requerirProyecto(id);
    if (acceso instanceof NextResponse) return acceso;

    const documento = await db.documentoTramite.findFirst({
      where: { id: docId, tramiteLegalId: tramiteId, tramiteLegal: { proyectoId: id } },
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
        ...headersSeguridadArchivo(documento.tipoArchivo || resultado.blob.contentType),
        // filename* (RFC 5987): un nombre con tildes ("inscripción.pdf")
        // no puede ir crudo en un header HTTP.
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(documento.nombreArchivoOriginal)}`,
        "Cache-Control": "private, max-age=31536000, immutable",
        ETag: etag,
      },
    });
  } catch (err) {
    console.error("[GET /api/proyectos/[id]/tramites/[tramiteId]/documentos/[docId]/archivo]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
