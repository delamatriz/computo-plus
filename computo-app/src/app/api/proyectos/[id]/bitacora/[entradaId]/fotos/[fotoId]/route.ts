import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { obtenerStreamDeBlob } from "@/lib/blob";
import { requerirProyecto } from "@/lib/sesion";

// Proxy de una foto de bitácora — mismo patrón que
// .../contrato/documentos/[docId]/archivo: el store de Blob es privado, así
// que se baja server-side y se reenvía. Las fotos viejas guardadas como data
// URL base64 se decodifican y se sirven igual, para que el cliente use una
// sola URL sin importar el formato.
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; entradaId: string; fotoId: string }> }
) {
  try {
    const { id, entradaId, fotoId } = await context.params;
    const acceso = await requerirProyecto(id);
    if (acceso instanceof NextResponse) return acceso;

    const foto = await db.fotoEntradaBitacora.findFirst({
      where: { id: fotoId, entradaBitacoraId: entradaId, entradaBitacora: { proyectoId: id } },
      select: { url: true },
    });
    if (!foto) {
      return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });
    }

    const cache = "private, max-age=31536000, immutable";
    const etag = `"${createHash("sha1").update(foto.url).digest("hex")}"`;
    const ifNoneMatch = req.headers.get("if-none-match");
    if (ifNoneMatch && ifNoneMatch.split(",").map((v) => v.trim()).includes(etag)) {
      return new NextResponse(null, { status: 304, headers: { "Cache-Control": cache, ETag: etag } });
    }

    const base64 = foto.url.match(/^data:([^;]+);base64,(.+)$/);
    if (base64) {
      return new NextResponse(Buffer.from(base64[2], "base64"), {
        headers: { "Content-Type": base64[1], "Cache-Control": cache, ETag: etag },
      });
    }

    const resultado = await obtenerStreamDeBlob(foto.url);
    if (resultado.statusCode !== 200) {
      return NextResponse.json({ error: "Foto no disponible" }, { status: 404 });
    }
    return new NextResponse(resultado.stream, {
      headers: {
        "Content-Type": resultado.blob.contentType || "image/jpeg",
        "Content-Disposition": "inline",
        "Cache-Control": cache,
        ETag: etag,
      },
    });
  } catch (err) {
    console.error("[GET /api/proyectos/[id]/bitacora/[entradaId]/fotos/[fotoId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
