import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const MENSAJE_PROYECTO_FINALIZADO =
  "Este presupuesto fue entregado y los precios están congelados. Habilitá la edición desde el proyecto para poder modificarlo.";

// Presupuesto entregado ("Entregar" → estado FINALIZADO) es de solo
// lectura hasta que se aprieta "Habilitar edición" — bloqueo real acá, no
// solo cosmético en el cliente (ver diseño de precio congelado).
async function proyectoFinalizado(rubroId: string): Promise<boolean> {
  const rubro = await db.rubro.findUnique({
    where: { id: rubroId },
    select: { capitulo: { select: { proyecto: { select: { estado: true } } } } },
  });
  return rubro?.capitulo.proyecto.estado === "FINALIZADO";
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (await proyectoFinalizado(id)) {
      return NextResponse.json({ error: "proyecto_finalizado", mensaje: MENSAJE_PROYECTO_FINALIZADO }, { status: 403 });
    }

    const body = await req.json();

    const rubro = await db.rubro.update({
      where: { id },
      data: {
        ...(body.descripcion !== undefined && { descripcion: body.descripcion }),
        ...(body.unidad      !== undefined && { unidad:      body.unidad }),
        // Editar cantidad a mano siempre vuelve a marcar el origen como
        // "MANUAL" — así "Aplicar al presupuesto" sabe que este valor ya
        // no es el que dejó el último cómputo y tiene que avisar antes
        // de pisarlo (ver POST /api/proyectos/[id]/aplicar-computo).
        ...(body.cantidad    !== undefined && { cantidad: body.cantidad ?? 0, cantidadOrigen: "MANUAL" }),
        ...(body.precioUnit  !== undefined && { precioUnit:  body.precioUnit ?? 0 }),
        ...(body.trabajoEnAltura !== undefined && { trabajoEnAltura: !!body.trabajoEnAltura }),
      },
    });

    return NextResponse.json(rubro);
  } catch (err) {
    console.error("[PATCH /api/rubros/[id]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (await proyectoFinalizado(id)) {
      return NextResponse.json({ error: "proyecto_finalizado", mensaje: MENSAJE_PROYECTO_FINALIZADO }, { status: 403 });
    }

    await db.rubro.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[DELETE /api/rubros/[id]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
