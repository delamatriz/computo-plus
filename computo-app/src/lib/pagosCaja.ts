// Pagos de Flujo de Caja agrupados por la entidad a la que están vinculados
// (orden de compra, subcontratista o certificación) y por moneda. Lado
// cliente: recibe la lista que devuelve GET /api/proyectos/[id]/flujo-caja.

export interface MovimientoVinculado {
  tipo: string;
  monto: number;
  moneda: string;
  ordenCompraId?: string | null;
  subcontratistaId?: string | null;
  certificacionId?: string | null;
}

export type PagosPorEntidad = Record<string, Record<string, number>>;

export function pagosPorVinculo(
  movimientos: MovimientoVinculado[],
  campo: "ordenCompraId" | "subcontratistaId" | "certificacionId"
): PagosPorEntidad {
  const r: PagosPorEntidad = {};
  for (const m of movimientos) {
    const id = m[campo];
    if (!id) continue;
    r[id] ??= {};
    r[id][m.moneda] = (r[id][m.moneda] ?? 0) + m.monto;
  }
  return r;
}

export async function cargarPagosPorVinculo(
  proyectoId: string,
  campo: "ordenCompraId" | "subcontratistaId" | "certificacionId"
): Promise<PagosPorEntidad> {
  const res = await fetch(`/api/proyectos/${proyectoId}/flujo-caja`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return pagosPorVinculo(Array.isArray(data) ? data : [], campo);
}
