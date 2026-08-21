import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const MENSAJE_PROYECTO_FINALIZADO =
  "Este presupuesto fue entregado y los precios están congelados. Habilitá la edición desde el proyecto para poder modificarlo.";

// Borrar un título nunca borra sus capítulos — onDelete: SetNull en
// Capitulo.tituloId (ver schema.prisma) los desagrupa automáticamente a
// nivel de base de datos, sin tocar rubros/precios.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const titulo = await db.titulo.findUnique({
      where: { id },
      select: { proyecto: { select: { estado: true } } },
    });

    if (!titulo) {
      return NextResponse.json({ error: "Título no encontrado" }, { status: 404 });
    }

    if (titulo.proyecto.estado === "FINALIZADO") {
      return NextResponse.json({ error: "proyecto_finalizado", mensaje: MENSAJE_PROYECTO_FINALIZADO }, { status: 403 });
    }

    await db.titulo.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[DELETE /api/titulos/[id]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
