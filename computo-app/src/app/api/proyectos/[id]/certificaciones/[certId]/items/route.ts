import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requerirProyecto, hijoNoEncontrado, rubrosSonDelProyecto } from "@/lib/sesion";

interface ItemInput {
  rubroId: string;
  porcentajeAvance: number;
  cantidadEjecutada?: number | null;
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string; certId: string }> }
) {
  try {
    const { id, certId } = await context.params;
    const acceso = await requerirProyecto(id);
    if (acceso instanceof NextResponse) return acceso;
    const certOk = await db.certificacion.findFirst({ where: { id: certId, proyectoId: id }, select: { id: true } });
    if (!certOk) return hijoNoEncontrado("Certificación no encontrada");
    const body = await req.json().catch(() => null);

    if (!Array.isArray(body)) {
      return NextResponse.json({ error: "Se esperaba un array de items" }, { status: 400 });
    }

    const items = body as ItemInput[];
    if (!(await rubrosSonDelProyecto(items.map((it) => it.rubroId), id))) {
      return NextResponse.json({ error: "Hay rubros que no son de este proyecto" }, { status: 400 });
    }

    await db.$transaction(
      items.map((it) =>
        db.certificacionItem.upsert({
          where: { certificacionId_rubroId: { certificacionId: certId, rubroId: it.rubroId } },
          create: {
            certificacionId: certId,
            rubroId: it.rubroId,
            porcentajeAvance: it.porcentajeAvance ?? 0,
            cantidadEjecutada: it.cantidadEjecutada ?? null,
          },
          update: {
            porcentajeAvance: it.porcentajeAvance ?? 0,
            cantidadEjecutada: it.cantidadEjecutada ?? null,
          },
        })
      )
    );

    const certificacion = await db.certificacion.findUnique({
      where: { id: certId },
      include: {
        items: {
          include: {
            rubro: {
              select: { id: true, descripcion: true, unidad: true, cantidad: true, precioUnit: true, codigo: true, capituloId: true },
            },
          },
        },
      },
    });

    if (!certificacion) {
      return NextResponse.json({ error: "Certificación no encontrada" }, { status: 404 });
    }

    const totalEstaCert = certificacion.items.reduce(
      (acc, it) => acc + (it.porcentajeAvance / 100) * it.rubro.cantidad * it.rubro.precioUnit,
      0
    );

    return NextResponse.json({ certificacion, totalEstaCert });
  } catch (err) {
    console.error("[PUT /api/proyectos/[id]/certificaciones/[certId]/items]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
