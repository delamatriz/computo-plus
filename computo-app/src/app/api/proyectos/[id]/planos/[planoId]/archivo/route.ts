import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { obtenerStreamDeBlob } from "@/lib/blob";

// Proxy del archivo del plano — el store de Vercel Blob es privado, así que
// el browser no puede pedirlo directo por su URL (necesita el token). Esta
// ruta baja el contenido server-side (autenticado) y lo reenvía, para que
// VisorPlano pueda usar `archivo` como <img src>/<Document file> normal.
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; planoId: string }> }
) {
  try {
    const { planoId } = await context.params;

    const plano = await db.planoProyecto.findUnique({
      where: { id: planoId },
      select: { archivo: true },
    });
    if (!plano) {
      return NextResponse.json({ error: "Plano no encontrado" }, { status: 404 });
    }

    // El contenido de un plano ya guardado es inmutable (se sube con
    // addRandomSuffix, así que la URL en `plano.archivo` cambia si alguna
    // vez se reemplaza el archivo) — el ETag sale de esa URL, sin necesidad
    // de bajar el blob para calcularlo. Permite además devolver 304 sin
    // pegarle a Vercel Blob.
    const etag = `"${createHash("sha1").update(plano.archivo).digest("hex")}"`;
    const ifNoneMatch = req.headers.get("if-none-match");
    if (ifNoneMatch && ifNoneMatch.split(",").map((v) => v.trim()).includes(etag)) {
      return new NextResponse(null, {
        status: 304,
        headers: { "Cache-Control": "private, max-age=31536000, immutable", ETag: etag },
      });
    }

    const resultado = await obtenerStreamDeBlob(plano.archivo);
    if (resultado.statusCode !== 200) {
      return NextResponse.json({ error: "Archivo no disponible" }, { status: 404 });
    }
    // OJO: no declarar Content-Length a mano acá — con un body en streaming,
    // el dev server de Next lo manda vacío (probado: con el header puesto,
    // llegan 0 bytes al cliente; sacándolo, llega el archivo completo). Se
    // deja que la respuesta vaya con chunked transfer encoding.
    return new NextResponse(resultado.stream, {
      headers: {
        "Content-Type": resultado.blob.contentType,
        "Cache-Control": "private, max-age=31536000, immutable",
        ETag: etag,
      },
    });
  } catch (err) {
    console.error("[GET /api/proyectos/[id]/planos/[planoId]/archivo]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
