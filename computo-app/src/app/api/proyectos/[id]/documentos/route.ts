import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requerirProyecto } from "@/lib/sesion";

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

    await db.documentoLlamado.create({
      data: {
        proyectoId,
        nombreArchivo: body.nombreArchivo,
        url: body.url,
        etiqueta: body.etiqueta,
        tamano: typeof body.tamano === "number" ? body.tamano : null,
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
