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
  // Solo el catálogo global: el matching por texto es automático y no debe elegir, en silencio,
  // un material que importó una empresa (los privados se usan por vínculo explícito, precioMTOPId).
  const filas = await db.precioMTOP.findMany({ where: { descripcion: { contains: buscada, mode: "insensitive" }, empresaId: null } });
  return ordenarCoincidencias(buscada, filas);
}

export async function resolverPrecioMaterial(descripcion: string): Promise<PrecioMTOP | null> {
  return (await coincidenciasPrecioMaterial(descripcion))[0] ?? null;
}

// Versiones en lote de resolverPrecioMaterial/resolverPrecioEquipo: UNA sola
// consulta para muchas descripciones (OR de "contiene") y el mismo orden de
// arriba aplicado en memoria a cada una. Mismo resultado que llamar la
// función de a una, sin una consulta por línea. Devuelve un Map por la
// descripción tal cual se pidió (sin coincidencia → null).
const contieneSinMayusculas = (texto: string, buscada: string) =>
  texto.toLocaleLowerCase("es").includes(buscada.toLocaleLowerCase("es"));

export async function resolverPreciosMaterialesEnLote(descripciones: string[]): Promise<Map<string, PrecioMTOP | null>> {
  const buscadas = [...new Set(descripciones.map((d) => d.trim()).filter(Boolean))];
  const resultado = new Map<string, PrecioMTOP | null>(descripciones.map((d) => [d, null]));
  if (buscadas.length === 0) return resultado;
  const filas = await db.precioMTOP.findMany({
    where: { empresaId: null, OR: buscadas.map((b) => ({ descripcion: { contains: b, mode: "insensitive" as const } })) },
  });
  for (const d of descripciones) {
    const b = d.trim();
    if (!b) continue;
    resultado.set(d, ordenarCoincidencias(b, filas.filter((f) => contieneSinMayusculas(f.descripcion, b)))[0] ?? null);
  }
  return resultado;
}

export async function resolverPreciosEquiposEnLote(descripciones: string[]): Promise<Map<string, PrecioEquipo | null>> {
  const buscadas = [...new Set(descripciones.map((d) => d.trim()).filter(Boolean))];
  const resultado = new Map<string, PrecioEquipo | null>(descripciones.map((d) => [d, null]));
  if (buscadas.length === 0) return resultado;
  const filas = await db.precioEquipo.findMany({
    where: { OR: buscadas.map((b) => ({ descripcion: { contains: b, mode: "insensitive" as const } })) },
  });
  for (const d of descripciones) {
    const b = d.trim();
    if (!b) continue;
    resultado.set(d, ordenarCoincidencias(b, filas.filter((f) => contieneSinMayusculas(f.descripcion, b)))[0] ?? null);
  }
  return resultado;
}

export async function resolverPrecioEquipo(descripcion: string): Promise<PrecioEquipo | null> {
  const buscada = descripcion.trim();
  if (!buscada) return null;
  const filas = await db.precioEquipo.findMany({ where: { descripcion: { contains: buscada, mode: "insensitive" } } });
  return ordenarCoincidencias(buscada, filas)[0] ?? null;
}

// Precio de una línea de APU estándar de la Biblioteca: el del catálogo si
// resuelve con precio > 0; si no, el precio fijo de respaldo que se guardó
// con la línea (MaterialAPUEstandar.precioReferencia, EquipoAPUEstandar.
// costoReferencia, ManoObraAPUEstandar.jornalReferencia — ver "Guardar en
// biblioteca"); si tampoco hay, el del catálogo tal cual (o 0). `esFijo`
// indica que se usó el respaldo, para marcarlo "Pendiente de verificar".
export const NOTA_PRECIO_FIJO_BIBLIOTECA =
  "Precio fijo guardado desde un proyecto — sin vínculo al catálogo, no se actualiza solo";

export function precioConRespaldo(
  precioCatalogo: number | null | undefined,
  respaldo: number | null | undefined
): { precio: number; esFijo: boolean } {
  if (precioCatalogo != null && precioCatalogo > 0) return { precio: precioCatalogo, esFijo: false };
  if (respaldo != null && respaldo > 0) return { precio: respaldo, esFijo: true };
  return { precio: precioCatalogo ?? 0, esFijo: false };
}
