// Obra pública con contrato en Unidades Reajustables (Proyecto.monedaContrato
// = "UR"): equivalente en UR de un monto en pesos, con el valor de la UR que
// se carga en /editar (lo publica el BCU mensualmente). Lo usan el PDF y el
// Excel del presupuesto; la tarjeta Precio Final hace la misma cuenta.

/** Monto en pesos ÷ valor de la UR; null si no hay valor de UR válido. */
export function montoEnUR(montoPesos: number, valorUR: number | null | undefined): number | null {
  if (!valorUR || !(valorUR > 0)) return null;
  return montoPesos / valorUR;
}

/** "18.460,53" — 2 decimales, formato uruguayo. */
export function fmtUR(v: number): string {
  return v.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
