import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { subirArchivoABlob } from "@/lib/blob";

// POST — sube un documento/anexo nuevo al contrato del proyecto.
// Mismo patrón exacto que DocumentoMetraje: el cliente manda el
// archivo como data URL base64, se sube a Vercel Blob (privado) y se
// guarda la URL resultante — el contenido se sirve después por la
// ruta proxy .../[docId]/archivo, nunca directo desde Blob.
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const { nombre, archivo, nombreArchivoOriginal } = body as {
      nombre?: string;
      archivo?: string;
      nombreArchivoOriginal?: string;
    };

    if (!nombre?.trim()) {
      return NextResponse.json({ error: "Falta nombre/tipo del documento" }, { status: 400 });
    }
    if (!archivo || !nombreArchivoOriginal) {
      return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
    }

    const contrato = await db.contratoObra.findUnique({ where: { proyectoId: id } });
    if (!contrato) {
      return NextResponse.json({ error: "Este proyecto todavía no tiene contrato" }, { status: 404 });
    }

    const match = archivo.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      return NextResponse.json({ error: "Formato de archivo inválido" }, { status: 400 });
    }
    const [, contentType, base64] = match;
    const tamano = Math.ceil((base64.length * 3) / 4);

    let urlBlob: string;
    try {
      urlBlob = await subirArchivoABlob(`contrato-obra/${id}/${nombreArchivoOriginal}`, archivo);
    } catch (err) {
      console.error("[POST /api/proyectos/[id]/contrato/documentos] subida a blob", err);
      return NextResponse.json({ error: "No se pudo subir el archivo" }, { status: 400 });
    }

    const documento = await db.documentoContrato.create({
      data: {
        contratoObraId: contrato.id,
        nombre: nombre.trim(),
        urlBlob,
        nombreArchivoOriginal,
        tipoArchivo: contentType,
        tamano,
      },
    });

    return NextResponse.json(documento, { status: 201 });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/contrato/documentos]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
