import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { obtenerStreamDeBlob } from "@/lib/blob";
import { requerirSesion } from "@/lib/sesion";

// Proxy de descarga de un documento de la Biblioteca — el store de Blob es
// privado (ver lib/blob.ts), así que el navegador no puede abrir la URL
// directa. Cualquier usuario logueado. Mismo patrón que convenio-pdf.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await requerirSesion();
  if (sesion instanceof NextResponse) return sesion;
  try {
    const { id } = await params;
    const documento = await db.documentoBiblioteca.findUnique({
      where: { id },
      select: { archivo: true, nombreArchivo: true },
    });
    if (!documento) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });

    const resultado = await obtenerStreamDeBlob(documento.archivo);
    if (resultado.statusCode !== 200) {
      return NextResponse.json({ error: "Archivo no disponible" }, { status: 404 });
    }
    // Nombre original con tildes/espacios: filename ASCII de respaldo + filename* (RFC 5987).
    const ascii = documento.nombreArchivo.normalize("NFD").replace(/[^\x20-\x7e]/g, "").replace(/["\\]/g, "_");
    return new NextResponse(resultado.stream, {
      headers: {
        "Content-Type": resultado.blob.contentType,
        "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(documento.nombreArchivo)}`,
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (err) {
    console.error("[GET /api/biblioteca/[id]/archivo]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
