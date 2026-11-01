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

// Obra pública — coeficiente BPS por defecto del módulo alternativo de Leyes
// Sociales (SeccionLeyesSocialesPublica): Leyes sociales = monto imponible
// (jornales reales que declara el contratista) × coeficiente. Es el mismo
// porcentaje unificado de la construcción: el art. 1 del Decreto 241/007
// (redacción del Decreto 341/018) lo fija para los arts. 1 y 5 del
// Decreto-Ley 14.411 sin distinguir obra pública de privada; lo que cambia es
// quién lo paga (el organismo público, como propietario, deposita al BPS —
// art. 13) y la base (art. 7: fórmulas paramétricas del contrato).
// Fuentes: IMPO, Decreto 241/007 art. 1 vigente (impo.com.uy/bases/decretos/
// 241-2007) y BPS, Régimen construcción (bps.gub.uy/837, actualizada
// 01/10/2026). Verificado 2026-11-01. El adicional transitorio de 0,96% del
// Decreto 108/020 (72,76%) rigió 26 meses desde 1/6/2020 y ya venció.
// No se encontró una tasa BPS específica de obra pública distinta de ésta.
export const COEFICIENTE_BPS_OBRA_PUBLICA_DEFAULT = AUC_PCT_DEFAULT;
