import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { obtenerStreamDeBlob } from "@/lib/blob";

// Proxy del archivo del plano — el store de Vercel Blob es privado, así que
// el browser no puede pedirlo directo por su URL (necesita el token). Esta
// ruta baja el contenido server-side (autenticado) y lo reenvía, para que
// VisorPlano pueda usar `archivo` como <img src>/<Document file> normal.
export async function GET(
  _req: NextRequest,
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
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[GET /api/proyectos/[id]/planos/[planoId]/archivo]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
