import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Incluye todas las relaciones necesarias para la página del proyecto
const PROYECTO_INCLUDE = {
  capitulos: {
    orderBy: { orden: "asc" as const },
    include: {
      rubros: {
        orderBy: { createdAt: "asc" as const },
        include: {
          _count: { select: { cotizaciones: true } },
          apu: {
            include: {
              materiales: {
                orderBy: { orden: "asc" as const },
                include: {
                  componentes: { orderBy: { orden: "asc" as const } },
                },
              },
              manoObra: { orderBy: { orden: "asc" as const } },
              equipos:  { orderBy: { orden: "asc" as const } },
            },
          },
        },
      },
    },
  },
} as const;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Poll liviano: solo el estado de generación de rubros, sin capítulos/rubros/APUs
    if (req.nextUrl.searchParams.get("light") === "1") {
      const proyecto = await db.proyecto.findUnique({
        where: { id },
        select: { generandoRubros: true },
      });
      if (!proyecto) {
        return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
      }
      return NextResponse.json(proyecto);
    }

    const proyecto = await db.proyecto.findUnique({
      where: { id },
      include: PROYECTO_INCLUDE,
    });
    if (!proyecto) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }
    return NextResponse.json(proyecto);
  } catch (err) {
    console.error("[GET /api/proyectos/[id]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.proyecto.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/proyectos/[id]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const proyecto = await db.proyecto.update({
      where: { id },
      data: {
        ...(body.nombre     !== undefined && { nombre:     body.nombre }),
        ...(body.cliente    !== undefined && { cliente:    body.cliente }),
        ...(body.tipo       !== undefined && { tipo:       body.tipo }),
        ...(body.estado     !== undefined && { estado:     body.estado }),
        ...(body.moneda     !== undefined && { moneda:     body.moneda }),
        ...(body.area       !== undefined && { area:       body.area }),
        ...(body.direccion  !== undefined && { direccion:  body.direccion }),
        ...(body.descripcion !== undefined && { descripcion: body.descripcion }),
        ...(body.fechaInicio !== undefined && { fechaInicio: body.fechaInicio ? new Date(body.fechaInicio) : null }),
        ...(body.plazoObra   !== undefined && { plazoObra:   body.plazoObra }),
        ...(body.generandoRubros !== undefined && { generandoRubros: body.generandoRubros }),
        ...(body.requierePlanSeguridad !== undefined && { requierePlanSeguridad: !!body.requierePlanSeguridad }),
        ...(body.modalidadAltura !== undefined && { modalidadAltura: body.modalidadAltura || null }),
      },
    });
    return NextResponse.json(proyecto);
  } catch (err) {
    console.error("[PATCH /api/proyectos/[id]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
