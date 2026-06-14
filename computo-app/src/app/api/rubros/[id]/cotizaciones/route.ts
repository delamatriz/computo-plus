import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const cotizaciones = await db.cotizacionProveedor.findMany({
      where: { rubroId: id },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ cotizaciones });
  } catch (err) {
    console.error("[GET /api/rubros/[id]/cotizaciones]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
    }

    const cotizacion = await db.cotizacionProveedor.create({
      data: {
        rubroId: id,
        proveedor: body.proveedor ?? "",
        montoNeto: body.montoNeto ?? 0,
        ivaPorcentaje: body.ivaPorcentaje ?? 22,
        leyesSociales: body.leyesSociales ?? 0,
        financiacion: body.financiacion ?? "",
        observaciones: body.observaciones ?? "",
      },
    });

    return NextResponse.json(cotizacion, { status: 201 });
  } catch (err) {
    console.error("[POST /api/rubros/[id]/cotizaciones]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
