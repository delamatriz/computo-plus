// Los convenios SUNCA (Grupo 9, Subgrupo 01) históricamente se ajustan una
// vez al año, en abril. No hace falta lógica de fechas de convenio exactas —
// alcanza con avisar cuando pasaron más de ~12-13 meses desde la última vez
// que se cargaron jornales, ya sea a mano o por extracción con IA.
const MESES_PARA_AVISO = 12.5;
const DIAS_POR_MES = 30.44;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

export function mesesTranscurridosDesde(fechaVigenciaDesde: string | Date): number {
  const fecha = new Date(fechaVigenciaDesde);
  const hoy = new Date();
  return (hoy.getTime() - fecha.getTime()) / (DIAS_POR_MES * MS_POR_DIA);
}

export function convenioPosiblementeDesactualizado(
  fechaVigenciaDesde: string | Date | null
): boolean {
  if (!fechaVigenciaDesde) return false;
  return mesesTranscurridosDesde(fechaVigenciaDesde) >= MESES_PARA_AVISO;
}

// Formatea en UTC — tanto "YYYY-MM-DD" (input de fecha) como el ISO completo
// que devuelve la API representan la misma fecha calendario en UTC. Si se
// formateara en huso horario local (Uruguay UTC-3), esa fecha calendario se
// corre un día para atrás.
export function formatearFechaUTC(fecha: Date): string {
  return new Intl.DateTimeFormat("es-UY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(fecha);
}

// El convenio SUNCA se ajusta una vez al año — la vigencia mostrada abarca
// los 12 meses desde fechaVigenciaDesde hasta el día previo a su aniversario.
function fechaFinVigencia(fechaVigenciaDesde: string | Date): Date {
  const inicio = new Date(fechaVigenciaDesde);
  return new Date(Date.UTC(inicio.getUTCFullYear() + 1, inicio.getUTCMonth(), inicio.getUTCDate() - 1));
}

/** "Convenio 01/04/2026 al 31/03/2027" (o "Convenio SUNCA <número> · …" si hay número). */
export function periodoConvenio(fechaVigenciaDesde: string | Date, numeroConvenio?: string | null): string {
  const desde = formatearFechaUTC(new Date(fechaVigenciaDesde));
  const hasta = formatearFechaUTC(fechaFinVigencia(fechaVigenciaDesde));
  const numero = numeroConvenio?.trim();
  return numero ? `Convenio SUNCA ${numero} · vigente ${desde} al ${hasta}` : `Convenio ${desde} al ${hasta}`;
}

// Con número de convenio cargado (ej. "2026-2027") se muestra junto a la fecha:
// "Convenio SUNCA 2026-2027 · vigente 01/04/2026 al 31/03/2027 — …". Sin número,
// el mensaje es el de siempre.
export function mensajeAvisoConvenio(fechaVigenciaDesde: string | Date, numeroConvenio?: string | null): string {
  const desde = formatearFechaUTC(new Date(fechaVigenciaDesde));
  const hasta = formatearFechaUTC(fechaFinVigencia(fechaVigenciaDesde));
  const numero = numeroConvenio?.trim();
  const cola = "verificá si hay convenio más reciente antes de usar en presupuestos definitivos.";
  return numero
    ? `Convenio SUNCA ${numero} · vigente ${desde} al ${hasta} — ${cola}`
    : `Convenio ${desde} al ${hasta} — ${cola}`;
}
