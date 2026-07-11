// Reglas de cálculo compartidas entre el drawer de APU (cliente) y las rutas
// de API que clonan/guardan un APU (servidor) — para no duplicar la lógica
// de modo de costeo de equipos en los dos lugares.

export interface EquipoCalc {
  id?: string;
  rendimiento: number;
  costoUnit: number;
  costoUnitPropio?: number | null;
  modoCosteo?: string | null;
}

export interface ManoObraCalc {
  rendimiento: number;
  jornalRef: number;
  equipoRelacionadoId?: string | null;
}

// Costo unitario efectivo de una línea de equipo según su modo de costeo.
// ALQUILADO (default) usa el precio de mercado (costoUnit) sin cambios;
// PROPIO_CON_COSTO usa el costo cargado a mano; PROPIO_SIN_COSTO no suma.
export function costoUnitEfectivo(eq: EquipoCalc): number {
  if (eq.modoCosteo === "PROPIO_SIN_COSTO") return 0;
  if (eq.modoCosteo === "PROPIO_CON_COSTO") return eq.costoUnitPropio ?? 0;
  return eq.costoUnit;
}

// Una línea de mano de obra vinculada a un equipo (armado/desarme) se suma al
// Costo Directo solo cuando el equipo es Propio — si es Alquilado, el
// armado viene incluido en el servicio de alquiler.
export function manoObraIncluida(mo: ManoObraCalc, equipos: EquipoCalc[]): boolean {
  if (!mo.equipoRelacionadoId) return true;
  const eq = equipos.find((e) => e.id === mo.equipoRelacionadoId);
  if (!eq) return true;
  return eq.modoCosteo === "PROPIO_CON_COSTO" || eq.modoCosteo === "PROPIO_SIN_COSTO";
}

export function sumEquipos(equipos: EquipoCalc[]): number {
  return equipos.reduce((s, e) => s + e.rendimiento * costoUnitEfectivo(e), 0);
}

export function sumManoObra(manoObra: ManoObraCalc[], equipos: EquipoCalc[]): number {
  return manoObra.reduce((s, mo) => {
    if (!manoObraIncluida(mo, equipos)) return s;
    const aporte = mo.jornalRef / mo.rendimiento;
    return s + (Number.isFinite(aporte) ? aporte : 0);
  }, 0);
}
