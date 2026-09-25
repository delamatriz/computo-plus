import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recalcularMontoOrden } from "@/lib/ordenCompra";

// POST — agrega un ítem de línea a una orden de compra (elegido del
// Cómputo Global de Materiales, o "ítem libre"). Recalcula
// OrdenCompra.monto como suma de ítems.
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; ordenId: string }> }
) {
  try {
    const { ordenId } = await context.params;
    const body = await req.json().catch(() => ({}));
    const { descripcion, unidad, cantidad, precioUnit } = body as {
      descripcion?: string;
      unidad?: string;
      cantidad?: number;
      precioUnit?: number | null;
    };

    if (!descripcion?.trim()) {
      return NextResponse.json({ error: "Falta descripción del ítem" }, { status: 400 });
    }
    if (!unidad?.trim()) {
      return NextResponse.json({ error: "Falta unidad del ítem" }, { status: 400 });
    }
    if (typeof cantidad !== "number" || !Number.isFinite(cantidad) || cantidad <= 0) {
      return NextResponse.json({ error: "Cantidad inválida" }, { status: 400 });
    }

    const orden = await db.ordenCompra.findUnique({ where: { id: ordenId } });
    if (!orden) {
      return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
    }

    await db.itemOrdenCompra.create({
      data: {
        ordenCompraId: ordenId,
        descripcion: descripcion.trim(),
        unidad: unidad.trim(),
        cantidad,
        precioUnit: precioUnit ?? null,
      },
    });

    await recalcularMontoOrden(ordenId);

    const ordenActualizada = await db.ordenCompra.findUnique({
      where: { id: ordenId },
      include: {
        capitulos: { include: { capitulo: { select: { id: true, nombre: true, codigo: true } } } },
        items: { orderBy: { createdAt: "asc" } },
      },
    });

    return NextResponse.json(ordenActualizada, { status: 201 });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/ordenes-compra/[ordenId]/items]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
