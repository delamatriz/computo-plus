import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { subirArchivoABlob } from "@/lib/blob";

const CATEGORIAS_VALIDAS = ["Manual de uso", "Plano As-Built", "Certificado de garantía", "Otro"];

// GET — lista los documentos post-obra del proyecto. Sin registro
// padre (a diferencia de Contrato/Cierre) — es directo sobre
// proyectoId, sin necesidad de "crear primero".
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
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

    const match = archivo.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      return NextResponse.json({ error: "Formato de archivo inválido" }, { status: 400 });
    }
    const [, contentType, base64] = match;
    const tamano = Math.ceil((base64.length * 3) / 4);

    let urlBlob: string;
    try {
      urlBlob = await subirArchivoABlob(`documentos-post-obra/${id}/${nombreArchivoOriginal}`, archivo);
    } catch (err) {
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
