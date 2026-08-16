import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// "Entregar" — congela precioCongelado = precioUnit en TODOS los rubros del
// proyecto y pasa estado a FINALIZADO (solo lectura hasta "Habilitar
// edición", ver guards en rubros/[id] y capitulos/[id]). updateMany no
// puede copiar el valor de una columna a otra en una sola pasada, así que
// se hace con SQL directo — atómico junto con el cambio de estado.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const proyecto = await db.proyecto.findUnique({ where: { id }, select: { id: true } });
    if (!proyecto) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const [, actualizado] = await db.$transaction([
      db.$executeRaw`
        UPDATE "Rubro" AS r
        SET "precioCongelado" = r."precioUnit"
        FROM "Capitulo" AS c
        WHERE r."capituloId" = c."id" AND c."proyectoId" = ${id}
      `,
      db.proyecto.update({
        where: { id },
        data: { estado: "FINALIZADO", fechaUltimaEntrega: new Date() },
      }),
    ]);

    return NextResponse.json(actualizado);
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/entregar]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
