import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recalcularMontoOrden } from "@/lib/ordenCompra";

async function ordenConItems(ordenId: string) {
  return db.ordenCompra.findUnique({
    where: { id: ordenId },
    include: {
      capitulos: { include: { capitulo: { select: { id: true, nombre: true, codigo: true } } } },
      items: { orderBy: { createdAt: "asc" } },
    },
  });
}

// PATCH — edita un ítem de línea (descripción, unidad, cantidad,
// precio). Recalcula OrdenCompra.monto.
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; ordenId: string; itemId: string }> }
) {
  try {
    const { ordenId, itemId } = await context.params;
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

    const existente = await db.itemOrdenCompra.findUnique({ where: { id: itemId } });
    if (!existente || existente.ordenCompraId !== ordenId) {
      return NextResponse.json({ error: "Ítem no encontrado" }, { status: 404 });
    }

    await db.itemOrdenCompra.update({
      where: { id: itemId },
      data: {
        descripcion: descripcion.trim(),
        unidad: unidad.trim(),
        cantidad,
        precioUnit: precioUnit ?? null,
      },
    });

    await recalcularMontoOrden(ordenId);

    return NextResponse.json(await ordenConItems(ordenId));
  } catch (err) {
    console.error("[PATCH /api/proyectos/[id]/ordenes-compra/[ordenId]/items/[itemId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE — borra un ítem de línea. Recalcula OrdenCompra.monto (si
// era el último ítem, el monto queda en su último valor calculado,
// editable a mano desde ahí — no se resetea).
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; ordenId: string; itemId: string }> }
) {
  try {
    const { ordenId, itemId } = await context.params;

    const existente = await db.itemOrdenCompra.findUnique({ where: { id: itemId } });
    if (!existente || existente.ordenCompraId !== ordenId) {
      return NextResponse.json({ error: "Ítem no encontrado" }, { status: 404 });
    }

    await db.itemOrdenCompra.delete({ where: { id: itemId } });
    await recalcularMontoOrden(ordenId);

    return NextResponse.json(await ordenConItems(ordenId));
  } catch (err) {
    console.error("[DELETE /api/proyectos/[id]/ordenes-compra/[ordenId]/items/[itemId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
