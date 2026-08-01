import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { subirArchivoABlob } from "@/lib/blob";

const CATEGORIAS_VALIDAS = ["PLANO", "FOTO", "DETALLE"];
const TIPOS_VALIDOS = ["PDF", "IMAGEN", "DWG"];

// Documentación para metrar — Etapa 1 (UI_UX_REDESIGN.md 2quinquies). El
// listado NO trae el campo `archivo` (URL de Vercel Blob) para que la
// pantalla cargue rápido; el contenido completo se pide recién al abrir un
// documento puntual en /api/proyectos/[id]/documentos-metraje/[docId].
async function listarDocumentos(proyectoId: string, categoria: string | null) {
  const documentos = await db.documentoMetraje.findMany({
    where: { proyectoId, ...(categoria ? { categoria } : {}) },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      categoria: true,
      nombre: true,
      tipoArchivo: true,
      nombreArchivoOriginal: true,
      paginaPDF: true,
      tamano: true,
      createdAt: true,
    },
  });
  return documentos;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proyectoId } = await context.params;
    const categoria = req.nextUrl.searchParams.get("categoria");
    if (categoria && !CATEGORIAS_VALIDAS.includes(categoria)) {
      return NextResponse.json({ error: "categoria debe ser PLANO, FOTO o DETALLE" }, { status: 400 });
    }
    const documentos = await listarDocumentos(proyectoId, categoria);
    return NextResponse.json({ documentos });
  } catch (err) {
    console.error("[GET /api/proyectos/[id]/documentos-metraje]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proyectoId } = await context.params;
    const body = await req.json().catch(() => null);

    if (!body?.categoria || !body?.nombre?.trim() || !body?.tipoArchivo || !body?.archivo || !body?.nombreArchivoOriginal) {
      return NextResponse.json(
        { error: "Se esperaba { categoria, nombre, tipoArchivo, archivo, nombreArchivoOriginal, paginaPDF?, tamano? }" },
        { status: 400 }
      );
    }
    if (!CATEGORIAS_VALIDAS.includes(body.categoria)) {
      return NextResponse.json({ error: "categoria debe ser PLANO, FOTO o DETALLE" }, { status: 400 });
    }
    if (!TIPOS_VALIDOS.includes(body.tipoArchivo)) {
      return NextResponse.json({ error: "tipoArchivo debe ser PDF, IMAGEN o DWG" }, { status: 400 });
    }

    let url: string;
    try {
      url = await subirArchivoABlob(`documentos-metraje/${proyectoId}/${body.nombreArchivoOriginal}`, body.archivo);
    } catch (err) {
      console.error("[POST /api/proyectos/[id]/documentos-metraje] subida a blob", err);
      return NextResponse.json({ error: "No se pudo subir el archivo" }, { status: 400 });
    }

    await db.documentoMetraje.create({
      data: {
        proyectoId,
        categoria: body.categoria,
        nombre: body.nombre.trim(),
        tipoArchivo: body.tipoArchivo,
        archivo: url,
        nombreArchivoOriginal: body.nombreArchivoOriginal,
        paginaPDF: typeof body.paginaPDF === "number" ? body.paginaPDF : null,
        tamano: typeof body.tamano === "number" ? body.tamano : null,
      },
    });

    const documentos = await listarDocumentos(proyectoId, body.categoria);
    return NextResponse.json({ documentos });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/documentos-metraje]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
