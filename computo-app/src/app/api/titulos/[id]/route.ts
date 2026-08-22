import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const MENSAJE_PROYECTO_FINALIZADO =
  "Este presupuesto fue entregado y los precios están congelados. Habilitá la edición desde el proyecto para poder modificarlo.";

// Hoy solo edita requierePlanSeguridad/modalidadAltura (ver pantalla
// "Editar" de un proyecto existente) — nombre/color de un título todavía
// no son editables desde ningún lado, no se agregan acá sin necesidad.
export async function PATCH(
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

    const body = await req.json();

    const actualizado = await db.titulo.update({
      where: { id },
      data: {
        ...("requierePlanSeguridad" in body && { requierePlanSeguridad: !!body.requierePlanSeguridad }),
        ...("modalidadAltura" in body && { modalidadAltura: body.modalidadAltura || null }),
      },
    });

    return NextResponse.json(actualizado);
  } catch (err) {
    console.error("[PATCH /api/titulos/[id]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

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
