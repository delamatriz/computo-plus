// Planilla de Jornales (ver model JornalPagado en schema.prisma) — cálculos
// compartidos entre la API y la pantalla, para que el total que ve el
// usuario y el que lea Control de Costos salgan de la misma fórmula.

export interface JornalParaCalculo {
  diasTrabajados: number;
  jornal: number;
  aportesPatronalesPct: number; // puntos porcentuales
}

export function brutoDe(j: JornalParaCalculo): number {
  return j.diasTrabajados * j.jornal;
}

export function aportesDe(j: JornalParaCalculo): number {
  return brutoDe(j) * (j.aportesPatronalesPct / 100);
}

export function totalesJornales(registros: JornalParaCalculo[]) {
  let jornales = 0;
  let bruto = 0;
  let aportes = 0;
  for (const r of registros) {
    jornales += r.diasTrabajados;
    bruto += brutoDe(r);
    aportes += aportesDe(r);
  }
  return { jornales, bruto, aportes, total: bruto + aportes };
}

// Lunes de la semana de una fecha "solo día" (YYYY-MM-DD), como YYYY-MM-DD.
// Todo en UTC: la fecha viene de un <input type="date"> y se guarda como
// medianoche UTC, mismo criterio que el resto de las fechas de Gestión de Obra.
export function lunesDeSemana(fechaISO: string): string {
  const d = new Date(`${fechaISO.slice(0, 10)}T00:00:00Z`);
  const desdeLunes = (d.getUTCDay() + 6) % 7; // domingo = 6
  d.setUTCDate(d.getUTCDate() - desdeLunes);
  return d.toISOString().slice(0, 10);
}

export function esFechaISO(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) && !Number.isNaN(Date.parse(v.slice(0, 10)));
}
