// Resolución del precio de un insumo (material contra PrecioMTOP, equipo
// contra PrecioEquipo) a partir de su descripción — usada donde un APU no
// tiene vínculo por id: APU estándar de la Biblioteca (descompuesto, clonar a
// un rubro, totales para la IA) y materiales de proyecto sin precioMTOPId.
//
// Antes cada lugar hacía findFirst({ descripcion contains }) — con o sin
// orderBy —, y con descripciones genéricas eso devolvía cualquiera de varias
// filas a precios muy distintos (ej. "Madera para encofrado": $450/m² la
// correcta, pero también $18.500/m³ y $32.000/m³). Orden único para todos:
//   1. descripción EXACTA (sin mayúsculas ni espacios de más);
//   2. si no hay, las que la contienen, la de descripción más corta primero
//      (la más parecida a lo buscado), desempatando por código.
// El orden no depende de cómo devuelva las filas la base.

import { db } from "@/lib/db";
import type { PrecioMTOP, PrecioEquipo } from "@/generated/prisma/client";

const normalizar = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

function ordenarCoincidencias<T extends { descripcion: string; codigo: string }>(buscada: string, filas: T[]): T[] {
  const objetivo = normalizar(buscada);
  return [...filas].sort((a, b) => {
    const exactaA = normalizar(a.descripcion) === objetivo ? 0 : 1;
    const exactaB = normalizar(b.descripcion) === objetivo ? 0 : 1;
    return exactaA - exactaB || a.descripcion.length - b.descripcion.length || a.codigo.localeCompare(b.codigo);
  });
}

// Todas las filas de PrecioMTOP que coinciden con la descripción, en el orden
// de arriba (la primera es la que se usa).
export async function coincidenciasPrecioMaterial(descripcion: string): Promise<PrecioMTOP[]> {
  const buscada = descripcion.trim();
  if (!buscada) return [];
  const filas = await db.precioMTOP.findMany({ where: { descripcion: { contains: buscada, mode: "insensitive" } } });
  return ordenarCoincidencias(buscada, filas);
}

export async function resolverPrecioMaterial(descripcion: string): Promise<PrecioMTOP | null> {
  return (await coincidenciasPrecioMaterial(descripcion))[0] ?? null;
}

export async function resolverPrecioEquipo(descripcion: string): Promise<PrecioEquipo | null> {
  const buscada = descripcion.trim();
  if (!buscada) return null;
  const filas = await db.precioEquipo.findMany({ where: { descripcion: { contains: buscada, mode: "insensitive" } } });
  return ordenarCoincidencias(buscada, filas)[0] ?? null;
}
