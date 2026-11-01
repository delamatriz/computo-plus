// "Presupuesto contratado" — una sola definición para todo Gestión de Obra
// (Resumen, Certificaciones, Liquidación, Control de Costos):
//
//   - Es el monto del contrato firmado (ContratoObra.monto).
//   - Sin contrato (o con el contrato en otra moneda que el proyecto), la
//     suma de rubros (Σ cantidad × precioUnit).
//
// El % de avance se sigue calculando sobre la suma de rubros (la base
// granular de cada certificación); lo certificado en plata se expresa sobre
// el presupuesto contratado: % de avance × presupuesto contratado. Así el
// saldo a certificar de Certificaciones y el "falta certificar" de
// Liquidación salen de la misma base.

export interface ContratoParaPresupuesto {
  monto: number | null;
  moneda: string;
}

export interface PresupuestoContratado {
  monto: number;
  fuente: "contrato" | "rubros";
}

export function presupuestoContratado(
  contrato: ContratoParaPresupuesto | null | undefined,
  sumaRubros: number,
  monedaProyecto: string
): PresupuestoContratado {
  if (contrato?.monto != null && contrato.monto > 0 && contrato.moneda === monedaProyecto) {
    return { monto: contrato.monto, fuente: "contrato" };
  }
  return { monto: sumaRubros, fuente: "rubros" };
}

/** % de avance certificado (0-100), sobre la suma de rubros. */
export function pctAvance(certificadoRubros: number, sumaRubros: number): number {
  return sumaRubros > 0 ? Math.min(100, (certificadoRubros / sumaRubros) * 100) : 0;
}

/** Lo certificado expresado sobre el presupuesto contratado. */
export function certificadoSobreContratado(certificadoRubros: number, sumaRubros: number, contratado: number): number {
  return (pctAvance(certificadoRubros, sumaRubros) / 100) * contratado;
}

// Movimientos de caja que cuentan como cobro de certificados: los de
// categoría "Cobro de certificación" o vinculados a una certificación. Los
// anticipos del comitente se informan aparte (no son pago de un certificado).
export interface IngresoCaja {
  tipo: string;
  monto: number;
  moneda: string;
  categoria?: string | null;
  certificacionId?: string | null;
  certificacion?: { id: string } | null;
}

export function esCobroDeCertificacion(m: IngresoCaja): boolean {
  return (
    m.tipo === "Ingreso" &&
    (m.categoria === "Cobro de certificación" || !!m.certificacionId || !!m.certificacion)
  );
}

export function esAnticipo(m: IngresoCaja): boolean {
  return m.tipo === "Ingreso" && m.categoria === "Anticipo del comitente";
}

export function sumarMovimientos(movs: IngresoCaja[], moneda: string, filtro: (m: IngresoCaja) => boolean): number {
  return movs.filter((m) => m.moneda === moneda && filtro(m)).reduce((s, m) => s + m.monto, 0);
}
