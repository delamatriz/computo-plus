// Recompone precioUnit de UN rubro contra las fuentes de precio vivas —
// PrecioMTOP para materiales, CategoriaLaboral para mano de obra — con la
// misma fórmula de siempre (Costo Directo × (1+GG%) × (1+Utilidad%)).
//
// Es la versión "un solo rubro, on-demand" de la lógica que ya usamos en
// la clonación de APU desde la Biblioteca (clonar-apu/route.ts, matching
// exacto por nombre) y en los scripts de migración masiva
// (recalcular-jornales-sunca-2026.ts, matching por bucket para variantes
// sueltas de datos reales) — pensada para el flujo de "actualizar al
// precio vigente" de un rubro con precio pactado/congelado (ver
// Rubro.precioCongelado en schema.prisma).
//
// No hardcodea ningún jornal: el jornal vigente siempre sale de
// CategoriaLaboral en el momento del cálculo, así que sigue funcionando
// sin tocar este archivo cuando cambie el convenio el año que viene.

import { db } from "@/lib/db";
import { sumEquipos, sumManoObra, calcularPrecioUnitario, montoAportesPatronales } from "@/lib/apu-calc";
import type { MaterialAPU, ManoObraAPU, EquipoAPU, APU } from "@/generated/prisma/client";

type RubroConAPU = {
  id: string;
  precioUnit: number;
  apu:
    | (APU & { materiales: MaterialAPU[]; manoObra: ManoObraAPU[]; equipos: EquipoAPU[] })
    | null;
};

// Mapea texto suelto de ManoObraAPU.categoria a la clave real de
// CategoriaLaboral.categoria, para variantes que no matchean exacto contra
// CategoriaLaboral.nombre — mismo relevamiento de datos reales que
// recalcular-jornales-sunca-2026.ts, extendido acá para cubrir también los
// oficios que ese script excluía a propósito (electricista/gasista/
// escalerista/capataz general), porque este recálculo es general y no debe
// dejar ninguna línea real sin resolver.
function bucketCategoriaLaboral(nombreMO: string): string | null {
  const n = nombreMO.trim().toLowerCase();

  if (n.includes("altura")) {
    if (n.includes("medio oficial")) return "medio_oficial_altura";
    if (n.includes("oficial")) return "oficial_altura";
    return null;
  }
  if (n.includes("plomero")) return "plomero_oficial";
  if (n.includes("pintor")) return "pintor_oficial";
  if (n.includes("maquinista")) return "oficial_maquinista";
  if (n.includes("escalerista")) return "oficial_escalerista";
  if (n.includes("electricista")) return "electricista_oficial";
  if (n.includes("gasista")) return "oficial_gasista";
  if (n.includes("capataz")) {
    if (n.includes("general")) return "sunca_cat_x";
    return "capataz";
  }
  if (n.includes("especializado")) return "oficial_especializado";
  if (n.includes("ayudante")) return "sunca_cat_iii";
  if (n.includes("peón") || n.includes("peon")) return "peon";
  if (n.includes("medio oficial")) return "medio_oficial";
  if (n.includes("oficial")) return "oficial";
  return null;
}

interface ResolucionRubro {
  precioUnitVigente: number;
  materialesAActualizar: { id: string; precioUnit: number }[];
  manoObraAActualizar: { id: string; jornalRef: number }[];
}

// Sin match en la fuente viva → se mantiene el valor actual de esa línea
// (no se pisa con 0; puede ser un precio cargado a mano, de un proveedor
// sin lista MTOP, o un oficio sin categoría laboral cargada).
async function resolverPreciosVigentes(rubro: RubroConAPU): Promise<ResolucionRubro> {
  const apu = rubro.apu!;

  const categoriasLaborales = await db.categoriaLaboral.findMany();
  const porNombreExacto = new Map(categoriasLaborales.map((c) => [c.nombre.trim().toLowerCase(), c]));
  const porCategoriaKey = new Map(categoriasLaborales.map((c) => [c.categoria, c]));

  const materialesAActualizar: { id: string; precioUnit: number }[] = [];
  const materialesEfectivos = await Promise.all(
    apu.materiales.map(async (m) => {
      const precioMTOP = await db.precioMTOP.findFirst({
        where: { descripcion: { contains: m.descripcion, mode: "insensitive" } },
        orderBy: { id: "asc" },
      });
      if (!precioMTOP || precioMTOP.precioUnitario === m.precioUnit) {
        return { rendimiento: m.rendimiento, precioUnit: m.precioUnit };
      }
      materialesAActualizar.push({ id: m.id, precioUnit: precioMTOP.precioUnitario });
      return { rendimiento: m.rendimiento, precioUnit: precioMTOP.precioUnitario };
    })
  );

  const manoObraAActualizar: { id: string; jornalRef: number }[] = [];
  const manoObraEfectiva = apu.manoObra.map((mo) => {
    const exacto = porNombreExacto.get(mo.categoria.trim().toLowerCase());
    const bucketKey = exacto ? null : bucketCategoriaLaboral(mo.categoria);
    const resuelta = exacto ?? (bucketKey ? porCategoriaKey.get(bucketKey) : undefined);
    if (!resuelta || resuelta.jornal === mo.jornalRef) {
      return { rendimiento: mo.rendimiento, jornalRef: mo.jornalRef, equipoRelacionadoId: mo.equipoRelacionadoId };
    }
    manoObraAActualizar.push({ id: mo.id, jornalRef: resuelta.jornal });
    return { rendimiento: mo.rendimiento, jornalRef: resuelta.jornal, equipoRelacionadoId: mo.equipoRelacionadoId };
  });

  const sumMat = materialesEfectivos.reduce((s, m) => s + m.rendimiento * m.precioUnit, 0);
  const sumMO = sumManoObra(manoObraEfectiva, apu.equipos);
  const sumEq = sumEquipos(apu.equipos);
  // Aportes Patronales: apu.aportesPatronalesPct queda congelado — este flujo
  // ("actualizar al precio vigente") refresca materiales/jornales, no los %
  // guardados en el APU (mismo criterio ya aplicado a gastosGeneralesPct/utilidadPct).
  const costoDirecto = sumMat + sumMO + sumEq + montoAportesPatronales(sumMO, apu.aportesPatronalesPct);
  const precioUnitVigente =
    Math.round(calcularPrecioUnitario(costoDirecto, apu.gastosGeneralesPct, apu.utilidadPct) * 100) / 100;

  return { precioUnitVigente, materialesAActualizar, manoObraAActualizar };
}

async function fetchRubroConAPU(rubroId: string): Promise<RubroConAPU | null> {
  return db.rubro.findUnique({
    where: { id: rubroId },
    include: { apu: { include: { materiales: true, manoObra: true, equipos: true } } },
  });
}

export interface PrecioVigenteRubro {
  precioUnitAnterior: number;
  precioUnitVigente: number;
  diffPct: number;
  lineasMaterialActualizadas: number;
  lineasManoObraActualizadas: number;
}

// Solo lectura — no escribe nada. Para mostrar "pactado vs. vigente" antes
// de que el usuario elija (modal de actualizar/mantener).
export async function calcularPrecioVigenteRubro(rubroId: string): Promise<PrecioVigenteRubro | null> {
  const rubro = await fetchRubroConAPU(rubroId);
  if (!rubro || !rubro.apu) return null;

  const resolucion = await resolverPreciosVigentes(rubro);
  const precioUnitAnterior = rubro.precioUnit;
  const diffPct =
    precioUnitAnterior !== 0 ? ((resolucion.precioUnitVigente - precioUnitAnterior) / precioUnitAnterior) * 100 : 0;

  return {
    precioUnitAnterior,
    precioUnitVigente: resolucion.precioUnitVigente,
    diffPct,
    lineasMaterialActualizadas: resolucion.materialesAActualizar.length,
    lineasManoObraActualizadas: resolucion.manoObraAActualizar.length,
  };
}

// Escribe el precio vigente: actualiza cada línea de materiales/mano de
// obra que cambió, precioUnit del Rubro, y precioCongelado (pasa a ser la
// nueva referencia "pactada" de acá en más, ver diseño del modal).
export async function aplicarPrecioVigenteRubro(rubroId: string): Promise<PrecioVigenteRubro | null> {
  const rubro = await fetchRubroConAPU(rubroId);
  if (!rubro || !rubro.apu) return null;

  const resolucion = await resolverPreciosVigentes(rubro);
  const precioUnitAnterior = rubro.precioUnit;
  const diffPct =
    precioUnitAnterior !== 0 ? ((resolucion.precioUnitVigente - precioUnitAnterior) / precioUnitAnterior) * 100 : 0;

  for (const m of resolucion.materialesAActualizar) {
    await db.materialAPU.update({ where: { id: m.id }, data: { precioUnit: m.precioUnit } });
  }
  for (const mo of resolucion.manoObraAActualizar) {
    await db.manoObraAPU.update({ where: { id: mo.id }, data: { jornalRef: mo.jornalRef } });
  }
  await db.rubro.update({
    where: { id: rubroId },
    data: { precioUnit: resolucion.precioUnitVigente, precioCongelado: resolucion.precioUnitVigente },
  });

  return {
    precioUnitAnterior,
    precioUnitVigente: resolucion.precioUnitVigente,
    diffPct,
    lineasMaterialActualizadas: resolucion.materialesAActualizar.length,
    lineasManoObraActualizadas: resolucion.manoObraAActualizar.length,
  };
}
