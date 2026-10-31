import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { subirArchivoABlob, eliminarArchivosDeBlob, obtenerStreamDeBlob } from "@/lib/blob";
import { requerirProyecto, hijoNoEncontrado } from "@/lib/sesion";

// Remito de la recepción de una orden de compra (un archivo por orden),
// en Vercel Blob privado — mismo patrón que los documentos de contrato.
// GET lo sirve (proxy), POST lo sube o reemplaza, DELETE lo quita.

type Ctx = { params: Promise<{ id: string; ordenId: string }> };

async function ordenDelProyecto(id: string, ordenId: string) {
  return db.ordenCompra.findFirst({
    where: { id: ordenId, proyectoId: id },
    select: { id: true, remitoUrlBlob: true, remitoNombreArchivo: true, remitoTipoArchivo: true },
  });
}

export async function GET(req: NextRequest, context: Ctx) {
  try {
    const { id, ordenId } = await context.params;
    const acceso = await requerirProyecto(id);
    if (acceso instanceof NextResponse) return acceso;
    const orden = await ordenDelProyecto(id, ordenId);
    if (!orden?.remitoUrlBlob) return hijoNoEncontrado("Remito no encontrado");

    const etag = `"${createHash("sha1").update(orden.remitoUrlBlob).digest("hex")}"`;
    const ifNoneMatch = req.headers.get("if-none-match");
    if (ifNoneMatch && ifNoneMatch.split(",").map((v) => v.trim()).includes(etag)) {
      return new NextResponse(null, { status: 304, headers: { "Cache-Control": "private, max-age=31536000, immutable", ETag: etag } });
    }
    const resultado = await obtenerStreamDeBlob(orden.remitoUrlBlob);
    if (resultado.statusCode !== 200) return hijoNoEncontrado("Remito no disponible");
    return new NextResponse(resultado.stream, {
      headers: {
        "Content-Type": orden.remitoTipoArchivo || resultado.blob.contentType,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(orden.remitoNombreArchivo ?? "remito")}`,
        "Cache-Control": "private, max-age=31536000, immutable",
        ETag: etag,
      },
    });
  } catch (err) {
    console.error("[GET /api/proyectos/[id]/ordenes-compra/[ordenId]/remito]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST { archivo (data URL), nombreArchivoOriginal } — sube o reemplaza.
export async function POST(req: NextRequest, context: Ctx) {
  try {
    const { id, ordenId } = await context.params;
    const acceso = await requerirProyecto(id);
    if (acceso instanceof NextResponse) return acceso;
    const orden = await ordenDelProyecto(id, ordenId);
    if (!orden) return hijoNoEncontrado("Orden no encontrada");

    const body = await req.json().catch(() => ({}));
    const { archivo, nombreArchivoOriginal } = body as { archivo?: string; nombreArchivoOriginal?: string };
    const match = archivo?.match(/^data:([^;]+);base64,(.+)$/);
    if (!archivo || !match || !nombreArchivoOriginal) {
      return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
    }

    let urlBlob: string;
    try {
      urlBlob = await subirArchivoABlob(`ordenes-compra/${id}/${ordenId}/${nombreArchivoOriginal}`, archivo);
    } catch (err) {
      console.error("[POST .../remito] subida a blob", err);
      return NextResponse.json({ error: "No se pudo subir el archivo" }, { status: 400 });
    }

    await db.ordenCompra.update({
      where: { id: ordenId },
      data: { remitoUrlBlob: urlBlob, remitoNombreArchivo: nombreArchivoOriginal, remitoTipoArchivo: match[1] },
    });
    if (orden.remitoUrlBlob) await eliminarArchivosDeBlob([orden.remitoUrlBlob]);

    return NextResponse.json({ remitoNombreArchivo: nombreArchivoOriginal }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/ordenes-compra/[ordenId]/remito]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: Ctx) {
  try {
    const { id, ordenId } = await context.params;
    const acceso = await requerirProyecto(id);
    if (acceso instanceof NextResponse) return acceso;
    const orden = await ordenDelProyecto(id, ordenId);
    if (!orden) return hijoNoEncontrado("Orden no encontrada");

    await db.ordenCompra.update({
      where: { id: ordenId },
      data: { remitoUrlBlob: null, remitoNombreArchivo: null, remitoTipoArchivo: null },
    });
    if (orden.remitoUrlBlob) await eliminarArchivosDeBlob([orden.remitoUrlBlob]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/proyectos/[id]/ordenes-compra/[ordenId]/remito]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
