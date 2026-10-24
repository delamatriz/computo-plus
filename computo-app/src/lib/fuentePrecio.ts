// Fuente del precio de un material del catálogo (PrecioMTOP), tal como se le
// muestra al usuario: la columna FUENTE de /materiales y la línea gris debajo
// de cada material del APU del presupuesto. Solo visualización: la base no se
// toca. Un único criterio para las dos pantallas, así dicen lo mismo.

// Precios de plaza: mampostería y básicos que no están en la lista oficial
// MTOP. Lista fija de códigos (no hay un campo en la base que los marque).
export const CODIGOS_MATERIALES_REFERENCIA = new Set([
  "TICH-0800",
  "TICH-1200",
  "TICH-1700",
  "LAD-COMUN",
  "LAD-PRIMERA",
  "LAD-CHORIZO",
  "BLOQUE-1219",
  "BLOQUE-1919",
  "CAL-HID",
  "PIEDRA-BRUTA",
  "MAD-ENCOFRADO",
  "TEJA-COLONIAL",
]);

/** Lo mínimo de una fila del catálogo para decidir su fuente. */
export interface DatosFuente {
  codigo: string;
  numeroLista: number;
  proveedor: string | null;
  notaProcedencia: string | null;
}

// Las notas internas de carga no se muestran tal cual:
//  - "Estimado por IA (Claude)…" (seeds oct-2026), "Backfill FEATURE <especialidad>…",
//    "Derivado — modelo de regresión…", "Retro-derivado SAU 2022…", "Estimación
//    general de mercado / sin cotización", "ESTIMACIÓN…" y "Kit mensual de
//    consumibles…" → estimación propia.
//  - "Corregido oct-2026: el precio de la lista era por 1.000 unidades…" y
//    "Lista Oficial MTOP (código …)" → precio de la lista MTOP.
//  - "Precio de referencia de mercado…" y "Pendiente de verificar. Precio de
//    tienda publicado…" → fuente de mercado.
// Se evalúan en ese orden (estimación antes que MTOP: un derivado calculado a
// partir de la lista sigue siendo una estimación). Sin proveedor ni nota,
// numeroLista > 0 es una fila de la lista oficial MTOP y 0 un material de
// mercado sin lista.
const NOTA_ESTIMACION_PROPIA =
  /Estimado por IA|Backfill|FEATURE|Derivado|modelo de regresión|Kit mensual de consumibles/;
// Sin distinguir mayúsculas: "Retro-derivado"/"retro-derivado", y "estimación" cubre
// "Estimación general de mercado", "Estimación sin cotización" y "ESTIMACIÓN".
const NOTA_ESTIMACION_PROPIA_I = /retro-derivado|estimación/i;
const NOTA_FUENTE_MTOP = /Corregido\s+\S+-\d{4}|Lista Oficial MTOP/;
const NOTA_FUENTE_MERCADO = /Precio de referencia de mercado|Pendiente de verificar/;

// Precio estimado por CÓMPUTO+ (no es cotización directa): lo que se muestra
// como "Estimado por CÓMPUTO+" y lo que filtra "Estimados — verificar".
export function esEstimado(m: DatosFuente): boolean {
  if (m.proveedor || !m.notaProcedencia || CODIGOS_MATERIALES_REFERENCIA.has(m.codigo)) return false;
  return NOTA_ESTIMACION_PROPIA.test(m.notaProcedencia) || NOTA_ESTIMACION_PROPIA_I.test(m.notaProcedencia);
}

export function textoFuente(m: DatosFuente): string {
  if (m.proveedor) return m.proveedor;
  // Los precios de plaza traen numeroLista = 599, el default del schema, no un
  // número de lista real.
  if (CODIGOS_MATERIALES_REFERENCIA.has(m.codigo)) return "Fuente de mercado";
  if (esEstimado(m)) return "Estimado por CÓMPUTO+";
  if (m.notaProcedencia) {
    if (NOTA_FUENTE_MTOP.test(m.notaProcedencia)) return "Fuente MTOP";
    if (NOTA_FUENTE_MERCADO.test(m.notaProcedencia)) return "Fuente de mercado";
    return m.notaProcedencia;
  }
  return m.numeroLista > 0 ? "Fuente MTOP" : "Fuente de mercado";
}
