import { db } from "@/lib/db";

// Vínculo opcional de un MovimientoCaja con la entidad que lo origina: un
// egreso con su orden de compra o su subcontratista, un ingreso con su
// certificación. Valida que la entidad sea del mismo proyecto y que el tipo
// de vínculo corresponda al tipo de movimiento.

export const INCLUDE_VINCULO_CAJA = {
  ordenCompra: { select: { id: true, proveedor: true } },
  subcontratista: { select: { id: true, empresa: true } },
  certificacion: { select: { id: true, numero: true, nombre: true } },
} as const;

export interface VinculoCaja {
  ordenCompraId: string | null;
  subcontratistaId: string | null;
  certificacionId: string | null;
}

// body.vinculo = { tipo: "ordenCompra" | "subcontratista" | "certificacion", id } o null.
// Devuelve los tres ids (a lo sumo uno cargado) o un mensaje de error.
export async function leerVinculoCaja(
  proyectoId: string,
  tipoMovimiento: string,
  vinculo: unknown
): Promise<VinculoCaja | string> {
  const vacio: VinculoCaja = { ordenCompraId: null, subcontratistaId: null, certificacionId: null };
  if (vinculo == null) return vacio;
  if (typeof vinculo !== "object") return "Vínculo inválido";
  const { tipo, id } = vinculo as { tipo?: unknown; id?: unknown };
  if (typeof id !== "string" || !id) return vacio;

  if (tipo === "certificacion") {
    if (tipoMovimiento !== "Ingreso") return "Una certificación solo se vincula a un ingreso";
    const ok = await db.certificacion.findFirst({ where: { id, proyectoId }, select: { id: true } });
    return ok ? { ...vacio, certificacionId: id } : "Certificación no encontrada";
  }
  if (tipo === "ordenCompra" || tipo === "subcontratista") {
    if (tipoMovimiento !== "Egreso") return "Una orden de compra o un subcontratista solo se vincula a un egreso";
    const ok =
      tipo === "ordenCompra"
        ? await db.ordenCompra.findFirst({ where: { id, proyectoId }, select: { id: true } })
        : await db.subcontratista.findFirst({ where: { id, proyectoId }, select: { id: true } });
    if (!ok) return "Entidad vinculada no encontrada";
    return tipo === "ordenCompra" ? { ...vacio, ordenCompraId: id } : { ...vacio, subcontratistaId: id };
  }
  return "Vínculo inválido";
}
