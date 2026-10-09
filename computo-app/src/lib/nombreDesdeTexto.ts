// Nombre de un anteproyecto / proyecto a partir del texto libre que el
// usuario escribió en Cálculo Rápido ("Describí la obra…"): el texto tal
// cual, en una sola línea, truncado a 60 caracteres con "…". null si no hay
// texto — el caller decide el fallback ("Anteproyecto — {tipo} en {zona}"
// en Cálculo Rápido).
export const LARGO_MAX_NOMBRE = 60;

export function nombreDesdeTexto(texto: string | null | undefined): string | null {
  const limpio = (texto ?? "").replace(/\s+/g, " ").trim();
  if (!limpio) return null;
  return limpio.length > LARGO_MAX_NOMBRE ? `${limpio.slice(0, LARGO_MAX_NOMBRE).trimEnd()}…` : limpio;
}

// Prefijo del nombre armado por fórmula ("Anteproyecto — {tipo} en {zona}"),
// el que se usaba siempre antes y sigue siendo el fallback sin texto. Sirve
// para reconocer un nombre que nadie eligió a mano (y que se puede
// reemplazar por el del texto al convertir el anteproyecto).
export const PREFIJO_NOMBRE_FORMULA = "Anteproyecto — ";
