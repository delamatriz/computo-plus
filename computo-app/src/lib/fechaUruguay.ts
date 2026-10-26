// Fecha actual en hora de Uruguay (America/Montevideo: UTC-3, sin horario de
// verano desde 2015). Sin dependencias: la usan el servidor y el navegador.
//
// Por qué: el servidor (Render) corre en UTC, así que new Date() con
// getMonth()/toLocaleDateString() sin zona, o toISOString(), dan la fecha de
// mañana entre las 21:00 y la medianoche de Uruguay. Para "hoy" o "este mes"
// se usa esto; para fechas guardadas en la base (que ya son un instante UTC)
// cada lugar sigue con su propio criterio.

export const ZONA_URUGUAY = "America/Montevideo";

/** Año, mes (1–12) y día de una fecha (por defecto, ahora) en hora de Uruguay. */
export function partesFechaUruguay(fecha: Date = new Date()): { anio: number; mes: number; dia: number } {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_URUGUAY, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(fecha)
    .reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  return { anio: Number(partes.year), mes: Number(partes.month), dia: Number(partes.day) };
}

/** "aaaa-mm-dd" de hoy en Uruguay (reemplaza a new Date().toISOString().slice(0, 10)). */
export function hoyUruguayISO(fecha: Date = new Date()): string {
  const { anio, mes, dia } = partesFechaUruguay(fecha);
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** "aaaa-mm" del mes actual en Uruguay (reemplaza a new Date().toISOString().slice(0, 7)). */
export function mesUruguayISO(fecha: Date = new Date()): string {
  return hoyUruguayISO(fecha).slice(0, 7);
}

/** toLocaleDateString("es-UY") en hora de Uruguay — por defecto "dd/mm/aaaa". */
export function fechaUruguay(
  fecha: Date = new Date(),
  opciones: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" }
): string {
  return fecha.toLocaleDateString("es-UY", { ...opciones, timeZone: ZONA_URUGUAY });
}
