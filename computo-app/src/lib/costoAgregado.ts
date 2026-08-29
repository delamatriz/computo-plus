// Costo Directo, Costos Indirectos (Gastos Generales) y Utilidad, sumados a
// nivel PROYECTO — reemplaza a la vieja tarjeta fija Total/IVA/Total+IVA.
//
// Gastos Generales dejó de prorratearse dentro de cada precioUnit de rubro
// (era Costo Directo × (1+GG%) × (1+Utilidad%) hasta este cambio) — ahora
// precioUnit de cada rubro es solo Costo Directo × (1+Utilidad%), y Gastos
// Generales se suma UNA sola vez acá, a nivel proyecto. Utilidad sigue
// exactamente igual que siempre: por rubro, congelada, con override
// individual — acá solo se SUMA lo que cada rubro ya aporta, no se
// recalcula nada nuevo.
//
// Mismo patrón que computarMOTotalPorCapitulo/computarMaterialesGlobales:
// funciones puras sobre capitulos+apuData ya cargados en memoria en
// proyectos/[id]/page.tsx, sin consulta nueva a la base.

import { sumManoObra, sumEquipos, montoAportesPatronales } from "./apu-calc";
import { sumarGastosGeneralesDetallado } from "./gastosGenerales";

export interface RubroParaCosto {
  id: string;
  cantidad: number | null;
  precioUnit: number | null;
}

export interface CapituloParaCosto {
  rubros: RubroParaCosto[];
}

export interface ApuParaCosto {
  materiales: { rendimiento: number; precioUnit: number }[];
  manoObra: { rendimiento: number; jornalRef: number; equipoRelacionadoId?: string | null }[];
  equipos: {
    id?: string;
    rendimiento: number;
    costoUnit: number;
    costoUnitPropio?: number | null;
    modoCosteo?: string | null;
  }[];
  aportesPatronalesPct: number;
  utilidadPct: number;
}

// Costo Directo por unidad de UN rubro — Materiales + Mano de Obra (ya
// incluye Aportes Patronales) + Equipos. Mismo cálculo que calcAPU() en
// page.tsx, sin la pirámide de Utilidad (esa se aplica después, o ya está
// aplicada dentro de precioUnit — ver calcularUtilidadAgregada).
export function costoDirectoUnitario(apu: ApuParaCosto): number {
  const sumMat = apu.materiales.reduce((s, m) => s + m.rendimiento * m.precioUnit, 0);
  const sumMO = sumManoObra(apu.manoObra, apu.equipos);
  const sumEq = sumEquipos(apu.equipos);
  return sumMat + sumMO + sumEq + montoAportesPatronales(sumMO, apu.aportesPatronalesPct);
}

export interface CostoDirectoAgregadoResultado {
  total: number;
  // "estimado" si al menos un rubro no tiene APU propio — para esos casos
  // se usa cantidad × precioUnit directo (todo el precio cuenta como Costo
  // Directo, sin poder separar cuánto sería Utilidad) — mismo patrón que
  // calcularMOTotal() en lib/calculos.ts.
  metodo: "apu" | "estimado";
  rubrosSinApu: number;
}

// Costo Directo agregado del proyecto — recorre capítulos → rubros → APU,
// sumando cantidad × costoDirectoUnitario de cada uno. Rubros sin APU
// (precioUnit cargado a mano, sin desglose) aportan cantidad × precioUnit
// completo, marcando el resultado como "estimado".
export function calcularCostoDirectoAgregado(
  capitulos: CapituloParaCosto[],
  apuData: Record<string, ApuParaCosto>
): CostoDirectoAgregadoResultado {
  let total = 0;
  let rubrosSinApu = 0;

  for (const cap of capitulos) {
    for (const rubro of cap.rubros) {
      const cantidad = rubro.cantidad ?? 0;
      const apu = apuData[rubro.id];
      if (apu) {
        total += costoDirectoUnitario(apu) * cantidad;
      } else {
        total += (rubro.precioUnit ?? 0) * cantidad;
        rubrosSinApu++;
      }
    }
  }

  return { total, metodo: rubrosSinApu > 0 ? "estimado" : "apu", rubrosSinApu };
}

// Utilidad agregada del proyecto — la Utilidad de cada rubro es
// precioUnit - costoDirectoUnitario (exacto, sin ambigüedad, porque
// precioUnit ya no tiene GG% adentro: precioUnit = costoDirecto ×
// (1+Utilidad%)). Suma esto, cantidad incluida, para todos los rubros CON
// APU — los rubros sin APU no aportan acá, ya están contados enteros como
// Costo Directo (estimado) arriba, sin forma de separar cuánto sería
// Utilidad de ese precio cargado a mano.
export function calcularUtilidadAgregada(
  capitulos: CapituloParaCosto[],
  apuData: Record<string, ApuParaCosto>
): number {
  let total = 0;
  for (const cap of capitulos) {
    for (const rubro of cap.rubros) {
      const apu = apuData[rubro.id];
      if (!apu || rubro.cantidad == null || rubro.precioUnit == null) continue;
      const costoDirecto = costoDirectoUnitario(apu);
      total += (rubro.precioUnit - costoDirecto) * rubro.cantidad;
    }
  }
  return total;
}

// Costos Indirectos (Gastos Generales) agregados — modo Detallado usa el
// monto fijo de las 5 categorías (sin cambios, ya existía); modo Porcentaje
// es el cálculo NUEVO: Costo Directo agregado × gastosGeneralesPctDefault
// (15% si nunca se configuró, mismo default histórico que antes tenía cada
// rubro individual).
export function calcularCostosIndirectosAgregados(
  modoGastosGenerales: string | null | undefined,
  gastosGeneralesDetallado: unknown,
  gastosGeneralesPctDefault: number | null | undefined,
  costoDirectoAgregado: number
): number {
  if (modoGastosGenerales === "DETALLADO") {
    return sumarGastosGeneralesDetallado(gastosGeneralesDetallado);
  }
  const pct = gastosGeneralesPctDefault ?? 15;
  return costoDirectoAgregado * (pct / 100);
}
