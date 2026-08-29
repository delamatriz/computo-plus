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

// Fórmula canónica única de precioUnit — antes triplicada de forma
// independiente en DrawerAPU (cliente), resolverPreciosVigentes.ts y
// clonar-apu/route.ts (servidor). utilidadPct va en puntos porcentuales
// (10 = 10%, no 0.10), igual que se guarda en APU.
// Nota: Aportes Patronales NO es un parámetro acá — es un componente más
// del costoDirecto que recibe esta función (ver montoAportesPatronales),
// no una pirámide extra sobre el resultado. Gastos Generales (Costos
// Indirectos) ya NO participa de esta fórmula — dejó de prorratearse por
// rubro, pasó a ser un monto agregado a nivel proyecto (ver
// costoAgregado.ts). precioUnit de cada rubro es, desde este cambio,
// exclusivamente Costo Directo × (1 + Utilidad%).
export function calcularPrecioUnitario(
  costoDirecto: number,
  utilidadPct: number
): number {
  return costoDirecto * (1 + utilidadPct / 100);
}

// ── Aportes Patronales BPS (Empresa paga) ───────────────────────────────
// % legal por default (Uruguay 2025) — FOCER patronal 7,5% + FSC/FOCAP 1% +
// FOSVOC 0,5% + FRL 0,2% + Fondo Garantía 0,5% + SNIS adicional 0,5% =
// 10,2%. Mismo valor que el @default() de LeyesSociales en schema.prisma,
// usado acá como fallback cuando el proyecto todavía no tiene un registro
// LeyesSociales — se crea de forma perezosa (ver
// GET /api/proyectos/[id]/leyes-sociales), así que un rubro puede necesitar
// este % antes de que exista esa fila.
export const APORTES_PATRONALES_PCT_LEGAL_DEFAULT = 10.2;

export interface AportesPatronalesPcts {
  focerPatronalPct: number;
  fscFocapPct: number;
  fosvocPct: number;
  frlPct: number;
  fondoGarantiaPct: number;
  snisAdicionalPct: number;
}

// Suma los 6 sub-componentes de "Empresa paga" en LeyesSociales (guardados
// como fracción, 0.075 = 7,5%) y los convierte a puntos porcentuales (7.5),
// mismo formato en que se guarda APU.aportesPatronalesPct. null/undefined
// (proyecto sin LeyesSociales todavía) usa el default legal.
export function sumarAportesPatronalesPct(pcts: AportesPatronalesPcts | null | undefined): number {
  if (!pcts) return APORTES_PATRONALES_PCT_LEGAL_DEFAULT;
  return (
    pcts.focerPatronalPct +
    pcts.fscFocapPct +
    pcts.fosvocPct +
    pcts.frlPct +
    pcts.fondoGarantiaPct +
    pcts.snisAdicionalPct
  ) * 100;
}

// Monto de Aportes Patronales a sumar dentro de Costo Directo — aplica el %
// SOLO sobre el subtotal de Mano de Obra (sumManoObra), nunca sobre
// materiales ni equipos.
export function montoAportesPatronales(sumManoObraValor: number, aportesPatronalesPct: number): number {
  return sumManoObraValor * (aportesPatronalesPct / 100);
}

// ── % Piedra en hormigón ciclópeo ───────────────────────────────────────
// La piedra desplaza volumen de hormigón simple completo (cemento + arena
// gruesa + balasto, escalando parejo) — no volumen de un agregado en
// particular. Piedra bruta (m3) = %piedra × 1 m3; los demás insumos del
// hormigón simple se reescalan por (1 − %nuevo) / (1 − %viejo), donde
// %viejo es el porcentajePiedra actualmente guardado en el APU (siempre
// mutuamente consistente con las cantidades guardadas, porque ambos se
// actualizan juntos cada vez que cambia el selector).
const RE_PIEDRA_BRUTA = /piedra bruta/i;
const RE_HORMIGON_SIMPLE = /cemento|arena gruesa|balasto/i;

export function tieneMaterialPiedra(materiales: { descripcion: string }[]): boolean {
  return materiales.some((m) => RE_PIEDRA_BRUTA.test(m.descripcion));
}

export function recalcularMaterialesPorPiedra<T extends { descripcion: string; rendimiento: number }>(
  materiales: T[],
  pctViejo: number,
  pctNuevo: number
): T[] {
  const factor = (1 - pctNuevo) / (1 - pctViejo);
  return materiales.map((m) => {
    if (RE_PIEDRA_BRUTA.test(m.descripcion)) {
      return { ...m, rendimiento: pctNuevo };
    }
    if (RE_HORMIGON_SIMPLE.test(m.descripcion) && Number.isFinite(factor)) {
      return { ...m, rendimiento: m.rendimiento * factor };
    }
    return m;
  });
}
