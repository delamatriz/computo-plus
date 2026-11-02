import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { subirArchivoValidadoABlob } from "@/lib/blob";
import { ArchivoInvalidoError } from "@/lib/archivosSubidos";
import { requerirProyecto } from "@/lib/sesion";
import { SELECT_DOCUMENTOS } from "@/lib/documentosTramite";

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

    // Tipo real por sus primeros bytes y tope de tamaño (lib/archivosSubidos.ts).
    let urlBlob: string;
    let contentType: string;
    let tamano: number;
    try {
      ({ url: urlBlob, contentType, tamano } = await subirArchivoValidadoABlob(`tramites/${id}/${tramiteId}/${nombreArchivoOriginal}`, archivo, "documento"));
    } catch (err) {
      if (err instanceof ArchivoInvalidoError) return NextResponse.json({ error: err.message }, { status: 400 });
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
