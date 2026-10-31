import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { subirArchivoABlob } from "@/lib/blob";
import { requerirProyecto } from "@/lib/sesion";
import { SELECT_DOCUMENTOS, TAMANO_MAX_DOCUMENTO_TRAMITE } from "@/lib/documentosTramite";

// POST — adjunta una constancia/comprobante a un trámite. Mismo patrón
// exacto que .../contrato/documentos: el cliente manda el archivo como data
// URL base64, se sube a Vercel Blob (privado) y se guarda la URL resultante.
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; tramiteId: string }> }
) {
  try {
    const { id, tramiteId } = await context.params;
    const acceso = await requerirProyecto(id);
    if (acceso instanceof NextResponse) return acceso;
    const body = await req.json().catch(() => ({}));
    const { nombre, archivo, nombreArchivoOriginal } = body as {
      nombre?: string;
      archivo?: string;
      nombreArchivoOriginal?: string;
    };

    if (!archivo || !nombreArchivoOriginal) {
      return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
    }

    const tramite = await db.tramiteLegal.findFirst({ where: { id: tramiteId, proyectoId: id }, select: { id: true } });
    if (!tramite) {
      return NextResponse.json({ error: "Trámite no encontrado" }, { status: 404 });
    }

    const match = archivo.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      return NextResponse.json({ error: "Formato de archivo inválido" }, { status: 400 });
    }
    const [, contentType, base64] = match;
    const tamano = Math.ceil((base64.length * 3) / 4);
    if (tamano > TAMANO_MAX_DOCUMENTO_TRAMITE) {
      return NextResponse.json({ error: "El archivo supera los 15 MB" }, { status: 400 });
    }

    let urlBlob: string;
    try {
      urlBlob = await subirArchivoABlob(`tramites/${id}/${tramiteId}/${nombreArchivoOriginal}`, archivo);
    } catch (err) {
      console.error("[POST /api/proyectos/[id]/tramites/[tramiteId]/documentos] subida a blob", err);
      return NextResponse.json({ error: "No se pudo subir el archivo" }, { status: 400 });
    }

    const documento = await db.documentoTramite.create({
      data: {
        tramiteLegalId: tramiteId,
        nombre: nombre?.trim() || nombreArchivoOriginal.replace(/\.[^.]+$/, ""),
        urlBlob,
        nombreArchivoOriginal,
        tipoArchivo: contentType,
        tamano,
      },
      select: SELECT_DOCUMENTOS.select,
    });

    return NextResponse.json(documento, { status: 201 });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/tramites/[tramiteId]/documentos]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
