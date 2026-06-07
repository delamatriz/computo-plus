import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; certId: string }> }
) {
  try {
    const { certId } = await context.params;
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
    return NextResponse.json(certificacion);
  } catch (err) {
    console.error("[GET /api/proyectos/[id]/certificaciones/[certId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string; certId: string }> }
) {
  try {
    const { certId } = await context.params;
    const body = await req.json().catch(() => ({}));
    const { nombre, fecha, observaciones } = body as {
      nombre?: string;
      fecha?: string;
      observaciones?: string;
    };

    const data: { nombre?: string; fecha?: Date; observaciones?: string } = {};
    if (typeof nombre === "string") data.nombre = nombre;
    if (typeof fecha === "string") data.fecha = new Date(fecha);
    if (typeof observaciones === "string") data.observaciones = observaciones;

    const certificacion = await db.certificacion.update({
      where: { id: certId },
      data,
      include: { items: true },
    });
    return NextResponse.json(certificacion);
  } catch (err) {
    console.error("[PUT /api/proyectos/[id]/certificaciones/[certId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; certId: string }> }
) {
  try {
    const { certId } = await context.params;
    await db.certificacion.delete({ where: { id: certId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/proyectos/[id]/certificaciones/[certId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
