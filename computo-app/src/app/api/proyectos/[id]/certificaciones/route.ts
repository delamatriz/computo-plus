import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const certificaciones = await db.certificacion.findMany({
      where: { proyectoId: id },
      include: { items: true },
      orderBy: { numero: "asc" },
    });
    return NextResponse.json(certificaciones);
  } catch (err) {
    console.error("[GET /api/proyectos/[id]/certificaciones]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const { nombre, fecha, observaciones } = body as {
      nombre?: string;
      fecha?: string;
      observaciones?: string;
    };

    const proyecto = await db.proyecto.findUnique({
      where: { id },
      include: { capitulos: { include: { rubros: true } } },
    });
    if (!proyecto) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const ultima = await db.certificacion.findFirst({
      where: { proyectoId: id },
      orderBy: { numero: "desc" },
    });
    const numero = (ultima?.numero ?? 0) + 1;

    const rubros = proyecto.capitulos.flatMap((c) => c.rubros);

    const certificacion = await db.certificacion.create({
      data: {
        proyectoId: id,
        numero,
        nombre: nombre ?? `Certificado Nº${numero}`,
        fecha: fecha ? new Date(fecha) : new Date(),
        observaciones: observaciones ?? "",
        items: {
          create: rubros.map((r) => ({
            rubroId: r.id,
            porcentajeAvance: 0,
          })),
        },
      },
      include: { items: true },
    });

    return NextResponse.json(certificacion, { status: 201 });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/certificaciones]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
