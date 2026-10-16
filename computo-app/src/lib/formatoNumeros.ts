// Formato numérico uruguayo compartido: punto de miles, coma decimal.

/**
 * Decimal uruguayo con tope de decimales y sin ceros de más: punto de miles, coma decimal.
 * El agrupado se arma a mano porque toLocaleString("es-UY") no agrupa los números de
 * 4 cifras ("1234,5") y así no cambia con la versión de ICU del navegador.
 */
export function fmtDecimalUY(v: number, maxDecimales: number): string {
  if (!Number.isFinite(v)) return "";
  const r = parseFloat(v.toFixed(maxDecimales));
  const [entero, decimales] = String(Math.abs(r)).split(".");
  const agrupado = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${r < 0 ? "-" : ""}${agrupado}${decimales ? "," + decimales : ""}`;
}

/** Rendimiento: hasta 4 decimales (no 15 de ruido de punto flotante), sin ceros innecesarios */
export function fmtRendimiento(v: number): string {
  return fmtDecimalUY(v, 4);
}
