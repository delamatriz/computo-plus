// Aporte Unificado de la Construcción (AUC) — "Propietario paga". Porcentajes
// legales por defecto, fuente única para la tarjeta Leyes Sociales / BPS, el
// PDF y el respaldo de page.tsx (antes cada uno tenía su copia).
//
// Fuente: Decreto 341/018 (BPS / MTSS) — AUC 71,8% sobre el monto imponible
// de mano de obra, vigente desde noviembre de 2018. Verificado oct-2026.
// Antes de ese decreto el AUC era 71,4% (cargas salariales 29,5%): ese era el
// valor que había quedado en el modelo. Si el BPS vuelve a cambiar el
// porcentaje, actualizar acá Y el @default de LeyesSociales.aucPct en
// schema.prisma (que no puede importar esta constante) — y revisar la guía
// /leyes-sociales.
//
// El AUC es solo informativo: no entra al precio de ningún rubro (se muestra
// aparte, después del Precio Final).

// Partes patronal y personal por separado: la guía /leyes-sociales las lista
// una por una; la tarjeta Leyes Sociales/BPS usa las sumas de abajo.
export const AUC_PCT_JUBILATORIO_PATRONAL = 0.09;
export const AUC_PCT_JUBILATORIO_PERSONAL = 0.179;
export const AUC_PCT_FONASA_PATRONAL = 0.055;
export const AUC_PCT_FONASA_PERSONAL = 0.035;

export const AUC_PCT_JUBILATORIOS = AUC_PCT_JUBILATORIO_PATRONAL + AUC_PCT_JUBILATORIO_PERSONAL; // 26,9%
export const AUC_PCT_CARGAS_SALARIALES = 0.299; // licencia, aguinaldo, salario vacacional
export const AUC_PCT_FONASA = AUC_PCT_FONASA_PATRONAL + AUC_PCT_FONASA_PERSONAL; // SNIS: 9%
export const AUC_PCT_BSE = 0.06; // accidentes de trabajo

// Total legal (71,8%). Escrito como literal: es el valor que se guarda en
// LeyesSociales.aucPct para proyectos nuevos.
export const AUC_PCT_DEFAULT = 0.718;
