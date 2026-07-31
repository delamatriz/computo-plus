import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Metrajes con plano — Etapa 1 (solo subida + visor). El listado NO trae el
// campo `archivo` (base64) — puede pesar varios MB por plano — para que la
// pantalla cargue rápido; el contenido completo se pide recién al abrir un
// plano puntual en /api/proyectos/[id]/planos/[planoId].
async function listarPlanos(proyectoId: string) {
  const planos = await db.planoProyecto.findMany({
    where: { proyectoId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      nombre: true,
      tipoArchivo: true,
      nombreArchivoOriginal: true,
      paginaPDF: true,
      tamano: true,
      createdAt: true,
      _count: { select: { fotos: true } },
    },
  });
  return planos.map(({ _count, ...p }) => ({ ...p, cantidadFotos: _count.fotos }));
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proyectoId } = await context.params;
    const planos = await listarPlanos(proyectoId);
    return NextResponse.json({ planos });
  } catch (err) {
    console.error("[GET /api/proyectos/[id]/planos]", err);
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

    if (!body?.nombre?.trim() || !body?.tipoArchivo || !body?.archivo || !body?.nombreArchivoOriginal) {
      return NextResponse.json(
        { error: "Se esperaba { nombre, tipoArchivo, archivo, nombreArchivoOriginal, paginaPDF?, tamano? }" },
        { status: 400 }
      );
    }
    if (body.tipoArchivo !== "PDF" && body.tipoArchivo !== "IMAGEN") {
      return NextResponse.json({ error: "tipoArchivo debe ser PDF o IMAGEN" }, { status: 400 });
    }

    await db.planoProyecto.create({
      data: {
        proyectoId,
        nombre: body.nombre.trim(),
        tipoArchivo: body.tipoArchivo,
        archivo: body.archivo,
        nombreArchivoOriginal: body.nombreArchivoOriginal,
        paginaPDF: typeof body.paginaPDF === "number" ? body.paginaPDF : null,
        tamano: typeof body.tamano === "number" ? body.tamano : null,
      },
    });

    const planos = await listarPlanos(proyectoId);
    return NextResponse.json({ planos });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/planos]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
