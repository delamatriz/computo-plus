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
        ...(body.cantidad    !== undefined && { cantidad:    body.cantidad ?? 0 }),
        ...(body.precioUnit  !== undefined && { precioUnit:  body.precioUnit ?? 0 }),
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
