import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
    await db.rubro.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[DELETE /api/rubros/[id]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
