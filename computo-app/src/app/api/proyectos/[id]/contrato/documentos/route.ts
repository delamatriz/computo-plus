import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { subirArchivoValidadoABlob } from "@/lib/blob";
import { ArchivoInvalidoError } from "@/lib/archivosSubidos";
import { requerirProyecto } from "@/lib/sesion";

const TIPOS_DOCUMENTO = ["Contrato", "Anexo", "Presupuesto aprobado", "Otro"];

// POST — sube un documento/anexo nuevo al contrato del proyecto.
// Mismo patrón exacto que DocumentoMetraje: el cliente manda el
// archivo como data URL base64, se sube a Vercel Blob (privado) y se
// guarda la URL resultante — el contenido se sirve después por la
// ruta proxy .../[docId]/archivo, nunca directo desde Blob.
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const acceso = await requerirProyecto(id);
    if (acceso instanceof NextResponse) return acceso;
    const body = await req.json().catch(() => ({}));
    const { nombre, tipo, archivo, nombreArchivoOriginal } = body as {
      nombre?: string;
      tipo?: string;
      archivo?: string;
      nombreArchivoOriginal?: string;
    };

    if (tipo != null && !TIPOS_DOCUMENTO.includes(tipo)) {
      return NextResponse.json({ error: "Tipo de documento inválido" }, { status: 400 });
    }
    // El nombre es opcional si viene el tipo: "Contrato", "Anexo"…
    const nombreFinal = nombre?.trim() || tipo;
    if (!nombreFinal) {
      return NextResponse.json({ error: "Falta el tipo del documento" }, { status: 400 });
    }
    if (!archivo || !nombreArchivoOriginal) {
      return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
    }

    const contrato = await db.contratoObra.findUnique({ where: { proyectoId: id } });
    if (!contrato) {
      return NextResponse.json({ error: "Este proyecto todavía no tiene contrato" }, { status: 404 });
    }

    // Tipo real por sus primeros bytes y tope de tamaño (lib/archivosSubidos.ts).
    let urlBlob: string;
    let contentType: string;
    let tamano: number;
    try {
      ({ url: urlBlob, contentType, tamano } = await subirArchivoValidadoABlob(`contrato-obra/${id}/${nombreArchivoOriginal}`, archivo, "documento"));
    } catch (err) {
      if (err instanceof ArchivoInvalidoError) return NextResponse.json({ error: err.message }, { status: 400 });
      console.error("[POST /api/proyectos/[id]/contrato/documentos] subida a blob", err);
      return NextResponse.json({ error: "No se pudo subir el archivo" }, { status: 400 });
    }

    const documento = await db.documentoContrato.create({
      data: {
        contratoObraId: contrato.id,
        nombre: nombreFinal,
        tipo: tipo ?? null,
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
