import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { obtenerStreamDeBlob } from "@/lib/blob";

// Proxy del archivo de una foto complementaria — mismo motivo que
// .../planos/[planoId]/archivo/route.ts: el store de Blob es privado.
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string; planoId: string; fotoId: string }> }
) {
  try {
    const { fotoId } = await context.params;

    const foto = await db.fotoComplementaria.findUnique({
      where: { id: fotoId },
      select: { archivo: true },
    });
    if (!foto) {
      return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });
    }

    const resultado = await obtenerStreamDeBlob(foto.archivo);
    if (resultado.statusCode !== 200) {
      return NextResponse.json({ error: "Archivo no disponible" }, { status: 404 });
    }
    // OJO: no declarar Content-Length a mano acá — ver comentario en
    // .../planos/[planoId]/archivo/route.ts.
    return new NextResponse(resultado.stream, {
      headers: {
        "Content-Type": resultado.blob.contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[GET /api/proyectos/[id]/planos/[planoId]/fotos/[fotoId]/archivo]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
