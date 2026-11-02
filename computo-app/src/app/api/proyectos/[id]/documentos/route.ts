import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requerirProyecto } from "@/lib/sesion";
import { ArchivoInvalidoError, validarArchivoSubido } from "@/lib/archivosSubidos";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proyectoId } = await context.params;
    const acceso = await requerirProyecto(proyectoId);
    if (acceso instanceof NextResponse) return acceso;

    const documentos = await db.documentoLlamado.findMany({
      where: { proyectoId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ documentos });
  } catch (err) {
    console.error("[GET /api/proyectos/[id]/documentos]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proyectoId } = await context.params;
    const acceso = await requerirProyecto(proyectoId);
    if (acceso instanceof NextResponse) return acceso;
    const body = await req.json().catch(() => null);

    if (!body?.nombreArchivo || !body?.url || !body?.etiqueta) {
      return NextResponse.json(
        { error: "Se esperaba { nombreArchivo, url, etiqueta, tamano? }" },
        { status: 400 }
      );
    }

    // El archivo viaja y se guarda como data URL. Se valida el tipo real por
    // sus primeros bytes y el tamaño (lib/archivosSubidos.ts), y se guarda
    // rotulado con ese tipo: la pantalla lo abre como blob del mismo origen,
    // así que un HTML o SVG con un script no puede entrar.
    let archivo;
    try {
      archivo = validarArchivoSubido(body.url, "documento");
    } catch (err) {
      if (err instanceof ArchivoInvalidoError) return NextResponse.json({ error: err.message }, { status: 400 });
      throw err;
    }

    await db.documentoLlamado.create({
      data: {
        proyectoId,
        nombreArchivo: body.nombreArchivo,
        url: `data:${archivo.contentType};base64,${archivo.buffer.toString("base64")}`,
        etiqueta: body.etiqueta,
        tamano: archivo.tamano,
      },
    });

    const documentos = await db.documentoLlamado.findMany({
      where: { proyectoId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ documentos });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/documentos]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
