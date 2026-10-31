import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { subirArchivoABlob, eliminarArchivosDeBlob, obtenerStreamDeBlob } from "@/lib/blob";
import { requerirProyecto, hijoNoEncontrado } from "@/lib/sesion";

// Comprobante (factura, recibo) de un movimiento de caja — un archivo por
// movimiento, en Vercel Blob privado — mismo patrón que el remito de OC.
// GET lo sirve (proxy), POST lo sube o reemplaza, DELETE lo quita.

type Ctx = { params: Promise<{ id: string; movId: string }> };

async function movimientoDelProyecto(id: string, movId: string) {
  return db.movimientoCaja.findFirst({
    where: { id: movId, proyectoId: id },
    select: { id: true, comprobanteUrlBlob: true, comprobanteNombreArchivo: true, comprobanteTipoArchivo: true },
  });
}

export async function GET(req: NextRequest, context: Ctx) {
  try {
    const { id, movId } = await context.params;
    const acceso = await requerirProyecto(id);
    if (acceso instanceof NextResponse) return acceso;
    const mov = await movimientoDelProyecto(id, movId);
    if (!mov?.comprobanteUrlBlob) return hijoNoEncontrado("Comprobante no encontrado");

    const etag = `"${createHash("sha1").update(mov.comprobanteUrlBlob).digest("hex")}"`;
    const ifNoneMatch = req.headers.get("if-none-match");
    if (ifNoneMatch && ifNoneMatch.split(",").map((v) => v.trim()).includes(etag)) {
      return new NextResponse(null, { status: 304, headers: { "Cache-Control": "private, max-age=31536000, immutable", ETag: etag } });
    }
    const resultado = await obtenerStreamDeBlob(mov.comprobanteUrlBlob);
    if (resultado.statusCode !== 200) return hijoNoEncontrado("Comprobante no disponible");
    return new NextResponse(resultado.stream, {
      headers: {
        "Content-Type": mov.comprobanteTipoArchivo || resultado.blob.contentType,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(mov.comprobanteNombreArchivo ?? "comprobante")}`,
        "Cache-Control": "private, max-age=31536000, immutable",
        ETag: etag,
      },
    });
  } catch (err) {
    console.error("[GET /api/proyectos/[id]/flujo-caja/[movId]/comprobante]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST { archivo (data URL), nombreArchivoOriginal } — sube o reemplaza.
export async function POST(req: NextRequest, context: Ctx) {
  try {
    const { id, movId } = await context.params;
    const acceso = await requerirProyecto(id);
    if (acceso instanceof NextResponse) return acceso;
    const mov = await movimientoDelProyecto(id, movId);
    if (!mov) return hijoNoEncontrado("Movimiento no encontrado");

    const body = await req.json().catch(() => ({}));
    const { archivo, nombreArchivoOriginal } = body as { archivo?: string; nombreArchivoOriginal?: string };
    const match = archivo?.match(/^data:([^;]+);base64,(.+)$/);
    if (!archivo || !match || !nombreArchivoOriginal) {
      return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
    }

    let urlBlob: string;
    try {
      urlBlob = await subirArchivoABlob(`flujo-caja/${id}/${movId}/${nombreArchivoOriginal}`, archivo);
    } catch (err) {
      console.error("[POST .../comprobante] subida a blob", err);
      return NextResponse.json({ error: "No se pudo subir el archivo" }, { status: 400 });
    }

    await db.movimientoCaja.update({
      where: { id: movId },
      data: { comprobanteUrlBlob: urlBlob, comprobanteNombreArchivo: nombreArchivoOriginal, comprobanteTipoArchivo: match[1] },
    });
    if (mov.comprobanteUrlBlob) await eliminarArchivosDeBlob([mov.comprobanteUrlBlob]);

    return NextResponse.json({ comprobanteNombreArchivo: nombreArchivoOriginal }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/flujo-caja/[movId]/comprobante]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: Ctx) {
  try {
    const { id, movId } = await context.params;
    const acceso = await requerirProyecto(id);
    if (acceso instanceof NextResponse) return acceso;
    const mov = await movimientoDelProyecto(id, movId);
    if (!mov) return hijoNoEncontrado("Movimiento no encontrado");

    await db.movimientoCaja.update({
      where: { id: movId },
      data: { comprobanteUrlBlob: null, comprobanteNombreArchivo: null, comprobanteTipoArchivo: null },
    });
    if (mov.comprobanteUrlBlob) await eliminarArchivosDeBlob([mov.comprobanteUrlBlob]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/proyectos/[id]/flujo-caja/[movId]/comprobante]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
