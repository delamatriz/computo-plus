// Aportes Patronales BPS ("Empresa paga") — fuente única de los valores
// legales por defecto. Entran al precio de cada rubro SOLO sobre la mano de
// obra (ver montoAportesPatronales en apu-calc.ts), a diferencia del AUC
// (auc.ts), que paga el propietario al BPS y NO entra al precio.
//
// Cada fondo con su valor (en puntos porcentuales: 1,2691 = 1,2691%), su
// código BPS, su fuente y la fecha de verificación. Fuentes: BPS y Ley 18.236
// art. 16 (modificado), solo la parte que paga la empresa, verificadas por
// Luis oct-2026.
//
// Qué NO integra la suma patronal (verificado oct-2026, ver abajo):
//  - "SNIS adicional" (0,5%, código 108): es un aporte PERSONAL variable del
//    trabajador, no patronal. Se muestra como informativo en la retención
//    personal (LeyesSociales.snisAdicionalPct) y no entra al precio.
//  - El 7,5% que figuraba como "FOCER patronal" hasta oct-2026: es el aporte
//    jubilatorio patronal sobre partidas (alimentación, salud, seguros,
//    transporte); no integra el AUC y no es una carga fija sobre el jornal.
//  - Complemento de Cuota Mutual (CCM): depende de los beneficiarios de cada
//    trabajador. No se modela (se explica en la guía /leyes-sociales).
//
// Dónde se usa (todo sale de acá, nadie más escribe estos números):
//  - sumarAportesPatronalesPct / APORTES_PATRONALES_PCT_LEGAL_DEFAULT
//    (apu-calc.ts): % que se congela en APU.aportesPatronalesPct al crear o
//    clonar un rubro cuando el proyecto todavía no tiene LeyesSociales.
//  - Creación perezosa de LeyesSociales (GET/POST/PUT /api/proyectos/[id]/
//    leyes-sociales) y respaldo de la pantalla (proyectos/[id]/page.tsx):
//    LEYES_SOCIALES_DEFAULTS_FRACCION.
//  - La guía /leyes-sociales y scripts/actualizar-aportes-patronales-2026-10.ts.
// El @default de LeyesSociales y de APU.aportesPatronalesPct en schema.prisma
// no puede importar esta constante: si cambia algo acá, actualizar también
// ese schema (con `prisma db push`, nunca migrate) y la guía.
//
// Valores anteriores (2026-06-07 → oct-2026), los que tenían guardados los
// proyectos existentes: FOCER 7,5 / FSC-FOCAP 1,0 / FOSVOC 0,5 / FRL 0,2 /
// Fondo de Garantía 0,5 / SNIS adicional 0,5 = 10,2; FOCER personal 3,0. No
// tenían fuente documentada (ver APORTES_PATRONALES_VIEJOS más abajo).

export const APORTES_PATRONALES_VERIFICADO = "oct-2026";

export interface FondoPatronal {
  /** Campo de LeyesSociales donde se guarda (como fracción: 0.012691). */
  campo: "focerPatronalPct" | "fscFocapPct" | "fosvocPct" | "frlPct" | "fondoGarantiaPct";
  nombre: string;
  codigoBPS: string;
  /** Puntos porcentuales (5 = 5%). */
  pct: number;
  fuente: string;
  verificado: string;
}

const FUENTE_BPS = "BPS — Ley 18.236 art. 16 (modificado), parte patronal";

export const FONDOS_PATRONALES: readonly FondoPatronal[] = [
  {
    campo: "focerPatronalPct",
    nombre: "FOCER patronal",
    codigoBPS: "145",
    // 5% o 0,5% según el personal (Ley 18.236 art. 16). El default es 5; se
    // edita por proyecto en la tarjeta Leyes Sociales/BPS.
    pct: 5,
    fuente: `${FUENTE_BPS} — 5% o 0,5% según el personal; editable por proyecto`,
    verificado: APORTES_PATRONALES_VERIFICADO,
  },
  { campo: "fscFocapPct", nombre: "FSC + FOCAP", codigoBPS: "34", pct: 1.2691, fuente: FUENTE_BPS, verificado: APORTES_PATRONALES_VERIFICADO },
  { campo: "fosvocPct", nombre: "FOSVOC", codigoBPS: "43", pct: 0.025, fuente: FUENTE_BPS, verificado: APORTES_PATRONALES_VERIFICADO },
  { campo: "frlPct", nombre: "FRL (Fondo de Reconversión Laboral)", codigoBPS: "47", pct: 0.1, fuente: FUENTE_BPS, verificado: APORTES_PATRONALES_VERIFICADO },
  {
    campo: "fondoGarantiaPct",
    nombre: "Fondo de Garantía de Créditos Laborales",
    codigoBPS: "49",
    pct: 0.025,
    fuente: FUENTE_BPS,
    verificado: APORTES_PATRONALES_VERIFICADO,
  },
];

// Informativos, fuera de la suma patronal (no entran a ningún precio) ──────
/** SNIS adicional (código 108): aporte personal variable del trabajador. */
export const SNIS_ADICIONAL_PERSONAL_PCT = 0.5;
/** FOCER personal (código 146), retención al obrero. Antes 3,0 sin fuente. */
export const FOCER_PERSONAL_PCT = 0.5;

// Valores históricos (antes de oct-2026), en fracción — para que el script
// reconozca "exactamente los valores viejos" y no pise lo personalizado.
export const APORTES_PATRONALES_VIEJOS = {
  focerPatronalPct: 0.075,
  fscFocapPct: 0.01,
  fosvocPct: 0.005,
  frlPct: 0.002,
  fondoGarantiaPct: 0.005,
  snisAdicionalPct: 0.005,
} as const;
export const FOCER_PERSONAL_PCT_VIEJO = 0.03;
export const APORTES_PATRONALES_PCT_VIEJO = 10.2;

// Redondeo para que 1,2691/100 y las sumas no arrastren ruido de punto
// flotante (0.012691000000000002, 6.419100000000001). 8 decimales en
// fracción y 4 en puntos porcentuales alcanzan de sobra (el dato más fino
// es 1,2691%).
const redondear = (n: number, decimales: number) => {
  const f = 10 ** decimales;
  return Math.round(n * f) / f;
};

/** Los cinco fondos patronales como fracción (0.012691), para LeyesSociales. */
export const APORTES_PATRONALES_FRACCION = Object.fromEntries(
  FONDOS_PATRONALES.map((f) => [f.campo, redondear(f.pct / 100, 8)])
) as Record<FondoPatronal["campo"], number>;

/**
 * Todos los porcentajes por defecto de una LeyesSociales nueva, en fracción:
 * los cinco patronales + los dos personales informativos. Se pasa explícito
 * al crear la fila (no se depende del @default de la base).
 */
export const LEYES_SOCIALES_DEFAULTS_FRACCION = {
  ...APORTES_PATRONALES_FRACCION,
  snisAdicionalPct: redondear(SNIS_ADICIONAL_PERSONAL_PCT / 100, 8),
  focerPersonalPct: redondear(FOCER_PERSONAL_PCT / 100, 8),
};

/**
 * Suma de los cinco fondos patronales, en puntos porcentuales — el valor que
 * se copia a APU.aportesPatronalesPct cuando el proyecto no tiene
 * LeyesSociales todavía. 6,4191 con FOCER 5% (1,9191 con FOCER 0,5%).
 */
export const APORTES_PATRONALES_PCT_LEGAL_DEFAULT = redondear(
  FONDOS_PATRONALES.reduce((s, f) => s + f.pct, 0),
  4
);

/** Redondeo de una suma de fondos a 4 decimales de punto porcentual. */
export const redondearPctAportes = (pct: number) => redondear(pct, 4);
