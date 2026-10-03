// Caja de Profesionales (Ley 17.738) — aporte del propietario que se recauda
// junto con el AUC, sobre el MISMO monto imponible: 4% en obras de
// arquitectura, 2% en obras de ingeniería. Verificado oct-2026 (BPS / Ley
// 17.738).
//
// Es SOLO INFORMATIVA en CÓMPUTO+: se muestra en la tarjeta Leyes Sociales/BPS
// y en el PDF junto al AUC, y no entra al precio de ningún rubro ni a Costo
// Total / Precio Final (igual que el AUC). El selector se guarda en
// LeyesSociales.cajaProfesionalesTipo (String, no enum; default
// "ARQUITECTURA" — mantener sincronizado con el @default de schema.prisma).

export type TipoCajaProfesionales = "ARQUITECTURA" | "INGENIERIA" | "NO_APLICA";

export const CAJA_PROFESIONALES_TIPO_DEFAULT: TipoCajaProfesionales = "ARQUITECTURA";

/** Puntos porcentuales sobre el monto imponible (4 = 4%). */
export const CAJA_PROFESIONALES_PCT: Record<TipoCajaProfesionales, number> = {
  ARQUITECTURA: 4,
  INGENIERIA: 2,
  NO_APLICA: 0,
};

export const CAJA_PROFESIONALES_ETIQUETA: Record<TipoCajaProfesionales, string> = {
  ARQUITECTURA: "Arquitectura (4%)",
  INGENIERIA: "Ingeniería (2%)",
  NO_APLICA: "No aplica",
};

/** Normaliza un valor guardado (o null/desconocido) a un tipo válido. */
export function normalizarTipoCaja(v: string | null | undefined): TipoCajaProfesionales {
  return v === "INGENIERIA" || v === "NO_APLICA" || v === "ARQUITECTURA" ? v : CAJA_PROFESIONALES_TIPO_DEFAULT;
}

/** Monto informativo de la Caja de Profesionales sobre el monto imponible. */
export function montoCajaProfesionales(montoImponibleMO: number, tipo: string | null | undefined): number {
  return montoImponibleMO * (CAJA_PROFESIONALES_PCT[normalizarTipoCaja(tipo)] / 100);
}
