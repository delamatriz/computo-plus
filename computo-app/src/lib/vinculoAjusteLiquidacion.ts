import { db } from "@/lib/db";

export const INCLUDE_VINCULO_AJUSTE = {
  ordenCompra: { select: { id: true, proveedor: true } },
  subcontratista: { select: { id: true, empresa: true } },
};

// Vínculo opcional y mutuamente excluyente de un AjusteLiquidacion a
// una OrdenCompra o un Subcontratista del MISMO proyecto — puramente
// informativo/trazabilidad, no toca el cálculo del Total Liquidado
// (ver comentario en schema.prisma sobre AjusteLiquidacion).
export async function resolverVinculoAjuste(
  proyectoId: string,
  ordenCompraId?: string | null,
  subcontratistaId?: string | null
): Promise<{ ordenCompraId: string | null; subcontratistaId: string | null } | { error: string }> {
  if (ordenCompraId && subcontratistaId) {
    return { error: "Un ajuste no puede vincularse a una orden de compra y a un subcontratista a la vez" };
  }
  if (ordenCompraId) {
    const orden = await db.ordenCompra.findUnique({ where: { id: ordenCompraId }, select: { proyectoId: true } });
    if (!orden || orden.proyectoId !== proyectoId) {
      return { error: "Orden de compra inválida" };
    }
    return { ordenCompraId, subcontratistaId: null };
  }
  if (subcontratistaId) {
    const sub = await db.subcontratista.findUnique({ where: { id: subcontratistaId }, select: { proyectoId: true } });
    if (!sub || sub.proyectoId !== proyectoId) {
      return { error: "Subcontratista inválido" };
    }
    return { ordenCompraId: null, subcontratistaId };
  }
  return { ordenCompraId: null, subcontratistaId: null };
}
