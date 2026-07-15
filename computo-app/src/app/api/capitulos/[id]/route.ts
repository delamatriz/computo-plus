import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const capitulo = await db.capitulo.update({
      where: { id },
      data: {
        ...("nombre" in body && { nombre: body.nombre }),
        ...("fechaInicio" in body && { fechaInicio: body.fechaInicio ? new Date(body.fechaInicio) : null }),
        ...("fechaFin" in body && { fechaFin: body.fechaFin ? new Date(body.fechaFin) : null }),
      },
    });

    return NextResponse.json(capitulo);
  } catch (err) {
    console.error("[PATCH /api/capitulos/[id]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// Borra un capítulo y (en cascada, ver schema.prisma) sus rubros, APUs y
// cotizaciones. Bloqueo estricto — a diferencia del borrado de proyecto
// completo (que avisa de la pérdida de certificaciones pero permite
// seguir igual), acá NO se ofrece la opción de "borrar igual": si algún
// rubro del capítulo tiene certificaciones de avance cargadas, se
// rechaza el borrado sin excepción. Inconsistencia conocida entre los
// dos niveles — no es objetivo unificarla en este cambio, solo dejarla
// visible para quien lea este código después.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const capitulo = await db.capitulo.findUnique({
      where: { id },
      include: { rubros: { include: { certificacionItems: true } } },
    });

    if (!capitulo) {
      return NextResponse.json({ error: "Capítulo no encontrado" }, { status: 404 });
    }

    const tieneCertificaciones = capitulo.rubros.some((r) => r.certificacionItems.length > 0);
    if (tieneCertificaciones) {
      return NextResponse.json(
        {
          error: "certificaciones",
          mensaje:
            "Este capítulo tiene rubros con certificaciones de avance cargadas. Movés o eliminás esos rubros individualmente antes de poder borrar el capítulo completo.",
        },
        { status: 409 }
      );
    }

    await db.capitulo.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[DELETE /api/capitulos/[id]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
