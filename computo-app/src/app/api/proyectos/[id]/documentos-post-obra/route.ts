import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { subirArchivoValidadoABlob } from "@/lib/blob";
import { ArchivoInvalidoError } from "@/lib/archivosSubidos";
import { requerirProyecto } from "@/lib/sesion";

const CATEGORIAS_VALIDAS = ["Manual de uso", "Plano As-Built", "Certificado de garantía", "Otro"];

// GET — lista los documentos post-obra del proyecto. Sin registro
// padre (a diferencia de Contrato/Cierre) — es directo sobre
// proyectoId, sin necesidad de "crear primero".
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const acceso = await requerirProyecto(id);
    if (acceso instanceof NextResponse) return acceso;
    const documentos = await db.documentoPostObra.findMany({
      where: { proyectoId: id },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(documentos);
  } catch (err) {
    console.error("[GET /api/proyectos/[id]/documentos-post-obra]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST — sube un documento nuevo. Mismo patrón exacto que
// DocumentoContrato/DocumentoActaCierre: data URL base64 → Vercel
// Blob (privado) → URL guardada, servida después por la ruta proxy.
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const acceso = await requerirProyecto(id);
    if (acceso instanceof NextResponse) return acceso;
    const body = await req.json().catch(() => ({}));
    const { nombre, categoria, archivo, nombreArchivoOriginal } = body as {
      nombre?: string;
      categoria?: string;
      archivo?: string;
      nombreArchivoOriginal?: string;
    };

    if (!nombre?.trim()) {
      return NextResponse.json({ error: "Falta nombre" }, { status: 400 });
    }
    if (!categoria || !CATEGORIAS_VALIDAS.includes(categoria)) {
      return NextResponse.json({ error: "Categoría inválida" }, { status: 400 });
    }
    if (!archivo || !nombreArchivoOriginal) {
      return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
    }

    const proyecto = await db.proyecto.findUnique({ where: { id }, select: { id: true } });
    if (!proyecto) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    // Tipo real por sus primeros bytes y tope de tamaño (lib/archivosSubidos.ts).
    let urlBlob: string;
    let contentType: string;
    let tamano: number;
    try {
      ({ url: urlBlob, contentType, tamano } = await subirArchivoValidadoABlob(`documentos-post-obra/${id}/${nombreArchivoOriginal}`, archivo, "documento"));
    } catch (err) {
      if (err instanceof ArchivoInvalidoError) return NextResponse.json({ error: err.message }, { status: 400 });
      console.error("[POST /api/proyectos/[id]/documentos-post-obra] subida a blob", err);
      return NextResponse.json({ error: "No se pudo subir el archivo" }, { status: 400 });
    }

    const documento = await db.documentoPostObra.create({
      data: {
        proyectoId: id,
        nombre: nombre.trim(),
        categoria,
        urlBlob,
        nombreArchivoOriginal,
        tipoArchivo: contentType,
        tamano,
      },
    });

    return NextResponse.json(documento, { status: 201 });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/documentos-post-obra]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
