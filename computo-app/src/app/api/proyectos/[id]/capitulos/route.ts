import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolverCapituloCatalogoId } from "@/lib/capituloCatalogoResolver";
import { requerirProyecto } from "@/lib/sesion";

const MENSAJE_PROYECTO_FINALIZADO =
  "Este presupuesto fue entregado y los precios están congelados. Habilitá la edición desde el proyecto para poder modificarlo.";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proyectoId } = await params;
    const acceso = await requerirProyecto(proyectoId);
    if (acceso instanceof NextResponse) return acceso;

    const proyecto = await db.proyecto.findUnique({ where: { id: proyectoId }, select: { estado: true } });
    if (proyecto?.estado === "FINALIZADO") {
      return NextResponse.json({ error: "proyecto_finalizado", mensaje: MENSAJE_PROYECTO_FINALIZADO }, { status: 403 });
    }

    const body = await req.json();
    const nombre = body.nombre ?? "Nuevo capítulo";

    // tituloId es obligatorio (todo capítulo pertenece siempre a un
    // título, ver schema.prisma). Si no viene explícito en el body
    // (vista plana: "+ Agregar capítulo" del final de la lista, con ≤1
    // título), se usa el título de menor orden del proyecto — mismo
    // criterio de "título por defecto" que ya usa DELETE /api/titulos/[id]
    // al reasignar.
    const [ultimo, tituloDefault, capituloCatalogoId] = await Promise.all([
      db.capitulo.findFirst({
        where: { proyectoId },
        orderBy: { orden: "desc" },
        select: { orden: true },
      }),
      db.titulo.findFirst({
        where: { proyectoId },
        orderBy: { orden: "asc" },
        select: { id: true },
      }),
      resolverCapituloCatalogoId(db, nombre),
    ]);

    const tituloId = body.tituloId ?? tituloDefault?.id;
    if (!tituloId) {
      return NextResponse.json({ error: "El proyecto no tiene ningún título" }, { status: 500 });
    }
    if (body.tituloId) {
      const titulo = await db.titulo.findFirst({ where: { id: body.tituloId, proyectoId }, select: { id: true } });
      if (!titulo) return NextResponse.json({ error: "El título no es de este proyecto" }, { status: 400 });
    }

    const capitulo = await db.capitulo.create({
      data: {
        proyectoId,
        nombre,
        codigo:  body.codigo  ?? `C${Date.now()}`,
        color:   body.color   ?? "#2563EB",
        orden:   (ultimo?.orden ?? -1) + 1,
        capituloCatalogoId,
        tituloId,
      },
      include: { rubros: true },
    });

    return NextResponse.json(capitulo, { status: 201 });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/capitulos]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
