import { db } from "@/lib/db";

// Recalcula OrdenCompra.monto como suma de cantidad × precioUnit de
// sus ítems. Si la orden no tiene ítems (compatibilidad con el flujo
// viejo de monto a mano), no toca el campo — sigue siendo editable
// manualmente vía PATCH de la orden.
export async function recalcularMontoOrden(ordenCompraId: string) {
  const items = await db.itemOrdenCompra.findMany({ where: { ordenCompraId } });
  if (items.length === 0) return;

  const monto = items.reduce(
    (acc, it) => (it.precioUnit == null ? acc : acc + it.cantidad * it.precioUnit),
    0
  );

  await db.ordenCompra.update({ where: { id: ordenCompraId }, data: { monto } });
}
