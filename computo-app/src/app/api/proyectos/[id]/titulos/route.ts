import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const MENSAJE_PROYECTO_FINALIZADO =
  "Este presupuesto fue entregado y los precios están congelados. Habilitá la edición desde el proyecto para poder modificarlo.";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proyectoId } = await params;

    const proyecto = await db.proyecto.findUnique({ where: { id: proyectoId }, select: { estado: true } });
    if (proyecto?.estado === "FINALIZADO") {
      return NextResponse.json({ error: "proyecto_finalizado", mensaje: MENSAJE_PROYECTO_FINALIZADO }, { status: 403 });
    }

    const body = await req.json();
    const nombre = body.nombre ?? "Nuevo título";

    const ultimo = await db.titulo.findFirst({
      where: { proyectoId },
      orderBy: { orden: "desc" },
      select: { orden: true },
    });

    const titulo = await db.titulo.create({
      data: {
        proyectoId,
        nombre,
        color: body.color ?? "#2563EB",
        orden: (ultimo?.orden ?? -1) + 1,
      },
    });

    return NextResponse.json(titulo, { status: 201 });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/titulos]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
