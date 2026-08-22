import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const MENSAJE_PROYECTO_FINALIZADO =
  "Este presupuesto fue entregado y los precios están congelados. Habilitá la edición desde el proyecto para poder modificarlo.";

// Hoy solo edita requierePlanSeguridad (ver pantalla "Editar" de un
// proyecto existente) — nombre/color de un título todavía no son
// editables desde ningún lado, no se agregan acá sin necesidad.
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
      },
    });

    return NextResponse.json(actualizado);
  } catch (err) {
    console.error("[PATCH /api/titulos/[id]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// Todo proyecto tiene siempre al menos un Título (Capitulo.tituloId es
// obligatorio, sin onDelete — Postgres rechaza el delete mientras haya
// Capitulos apuntando al título). Por eso: se rechaza borrar el último
// título de un proyecto, y antes de borrar cualquier otro se reasignan
// sus capítulos al título de menor orden que quede, dentro de una
// transacción — la base nunca queda con un capítulo sin título.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const titulo = await db.titulo.findUnique({
      where: { id },
      select: {
        proyectoId: true,
        proyecto: { select: { estado: true } },
      },
    });

    if (!titulo) {
      return NextResponse.json({ error: "Título no encontrado" }, { status: 404 });
    }

    if (titulo.proyecto.estado === "FINALIZADO") {
      return NextResponse.json({ error: "proyecto_finalizado", mensaje: MENSAJE_PROYECTO_FINALIZADO }, { status: 403 });
    }

    const otrosTitulos = await db.titulo.findMany({
      where: { proyectoId: titulo.proyectoId, id: { not: id } },
      orderBy: { orden: "asc" },
      select: { id: true },
    });

    if (otrosTitulos.length === 0) {
      return NextResponse.json(
        { error: "ultimo_titulo", mensaje: "No podés eliminar el único título del proyecto — todo proyecto necesita al menos uno." },
        { status: 400 }
      );
    }

    const tituloDestino = otrosTitulos[0];

    await db.$transaction([
      db.capitulo.updateMany({
        where: { tituloId: id },
        data: { tituloId: tituloDestino.id },
      }),
      db.titulo.delete({ where: { id } }),
    ]);

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[DELETE /api/titulos/[id]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
