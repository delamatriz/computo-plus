import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
    }

    const cotizacion = await db.cotizacionProveedor.update({
      where: { id },
      data: {
        ...(body.proveedor !== undefined && { proveedor: body.proveedor }),
        ...(body.montoNeto !== undefined && { montoNeto: body.montoNeto }),
        ...(body.ivaPorcentaje !== undefined && { ivaPorcentaje: body.ivaPorcentaje }),
        ...(body.leyesSociales !== undefined && { leyesSociales: body.leyesSociales }),
        ...(body.financiacion !== undefined && { financiacion: body.financiacion }),
        ...(body.observaciones !== undefined && { observaciones: body.observaciones }),
      },
    });

    return NextResponse.json(cotizacion);
  } catch (err) {
    console.error("[PUT /api/cotizaciones/[id]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    await db.cotizacionProveedor.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/cotizaciones/[id]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
