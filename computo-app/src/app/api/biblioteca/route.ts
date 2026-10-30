import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { subirFileABlob } from "@/lib/blob";
import { requerirSesion, requerirSuperadmin } from "@/lib/sesion";
import {
  TAMANIO_MAXIMO_BIBLIOTECA,
  TIPOS_BIBLIOTECA,
  esArchivoBibliotecaValido,
  esCategoriaBiblioteca,
  extensionArchivo,
  type DocumentoBibliotecaListado,
} from "@/lib/biblioteca";

// Biblioteca de documentos técnicos — global, curada por el SUPERADMIN.
// GET: cualquier usuario logueado. POST: solo SUPERADMIN.

const SELECT_LISTADO = {
  id: true,
  titulo: true,
  descripcion: true,
  categoria: true,
  nombreArchivo: true,
  tamanio: true,
  creadoEn: true,
} as const;

function paraListado(d: { creadoEn: Date } & Omit<DocumentoBibliotecaListado, "creadoEn">): DocumentoBibliotecaListado {
  return { ...d, creadoEn: d.creadoEn.toISOString() };
}

export async function GET() {
  const sesion = await requerirSesion();
  if (sesion instanceof NextResponse) return sesion;
  try {
    const documentos = await db.documentoBiblioteca.findMany({
      orderBy: { creadoEn: "desc" },
      select: SELECT_LISTADO,
    });
    return NextResponse.json(documentos.map(paraListado));
  } catch (err) {
    console.error("[GET /api/biblioteca]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const sesion = await requerirSuperadmin();
  if (sesion instanceof NextResponse) return sesion;
  try {
    let form: FormData;
    try {
      form = await req.formData();
    } catch (err) {
      console.error("[POST /api/biblioteca] no se pudo leer el formulario (¿excede el tamaño permitido?)", {
        content_length: req.headers.get("content-length"),
        error: err instanceof Error ? err.message : err,
      });
      return NextResponse.json({ error: "No se pudo leer el archivo. Probá de nuevo." }, { status: 400 });
    }

    const archivo = form.get("archivo");
    const titulo = String(form.get("titulo") ?? "").trim();
    const descripcion = String(form.get("descripcion") ?? "").trim();
    const categoria = form.get("categoria");

    if (!titulo) return NextResponse.json({ error: "Falta el título." }, { status: 400 });
    if (!esCategoriaBiblioteca(categoria)) return NextResponse.json({ error: "Categoría inválida." }, { status: 400 });
    if (!(archivo instanceof File) || archivo.size === 0) {
      return NextResponse.json({ error: "Falta el archivo." }, { status: 400 });
    }
    if (!esArchivoBibliotecaValido(archivo.name)) {
      return NextResponse.json({ error: "Solo se aceptan archivos PDF, DOC o DOCX." }, { status: 400 });
    }
    if (archivo.size > TAMANIO_MAXIMO_BIBLIOTECA) {
      return NextResponse.json({ error: "El archivo supera los 20 MB." }, { status: 400 });
    }

    let url: string;
    try {
      url = await subirFileABlob(
        `biblioteca/${archivo.name.replace(/[^\w.\-]+/g, "_")}`,
        archivo,
        TIPOS_BIBLIOTECA[extensionArchivo(archivo.name)]
      );
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error("[POST /api/biblioteca] subida a blob falló", {
        name: e.name,
        message: e.message,
        bytes: archivo.size,
        token_configurado: !!process.env.BLOB_READ_WRITE_TOKEN,
      });
      return NextResponse.json({ error: "No se pudo guardar el archivo. Probá de nuevo." }, { status: 502 });
    }

    const creado = await db.documentoBiblioteca.create({
      data: {
        titulo,
        descripcion: descripcion || null,
        categoria,
        archivo: url,
        nombreArchivo: archivo.name,
        tamanio: archivo.size,
      },
      select: SELECT_LISTADO,
    });
    return NextResponse.json(paraListado(creado), { status: 201 });
  } catch (err) {
    console.error("[POST /api/biblioteca]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
