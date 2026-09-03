// Comparación de similitud de texto para la importación de listas de
// precios (ver /materiales, ModalImportarPrecios y
// api/precios-mtop/importar) — decide si una fila del archivo subido
// "actualiza" un material ya existente (misma descripción, con pequeñas
// variaciones de redacción/formato) o si es "nuevo". Isomorfo a propósito
// (sin APIs de servidor ni de browser) para que el mismo criterio se use
// en la vista previa (cliente) y en el endpoint que escribe (servidor) —
// nunca dos implementaciones que puedan desincronizarse.

/** Minúsculas, sin tildes, espacios colapsados — mismo criterio de
 *  reemplazo explícito que normalizar() en precios-mtop/route.ts, acá
 *  además colapsando espacios repetidos. */
export function normalizarTexto(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[áàäâ]/g, "a")
    .replace(/[éèëê]/g, "e")
    .replace(/[íìïî]/g, "i")
    .replace(/[óòöô]/g, "o")
    .replace(/[úùüû]/g, "u")
    .replace(/ñ/g, "n")
    .replace(/\s+/g, " ");
}

/** Distancia de Levenshtein clásica (programación dinámica, una fila). */
export function distanciaLevenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const fila = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) fila[j] = j;

  for (let i = 1; i <= m; i++) {
    let anterior = fila[0];
    fila[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = fila[j];
      fila[j] = a[i - 1] === b[j - 1] ? anterior : 1 + Math.min(anterior, fila[j], fila[j - 1]);
      anterior = temp;
    }
  }
  return fila[n];
}

/** 1 = idénticos (normalizados), 0 = completamente distintos. */
export function similitud(a: string, b: string): number {
  const na = normalizarTexto(a);
  const nb = normalizarTexto(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const distancia = distanciaLevenshtein(na, nb);
  const largoMax = Math.max(na.length, nb.length);
  return 1 - distancia / largoMax;
}

// 0.85 — conservador a propósito: falso negativo (algo que en realidad es
// el mismo material pero no matchea) solo crea una fila "Nuevo" de más,
// molesto pero inofensivo; falso positivo (matchear dos materiales
// distintos como si fueran el mismo) pisaría el precio de un material que
// no tiene nada que ver — mucho peor, así que se prioriza precisión sobre
// recall.
export const UMBRAL_SIMILITUD_DEFAULT = 0.85;

export interface CandidatoImportacion {
  id: string;
  codigo: string;
  descripcion: string;
  precioUnitario: number;
}

export interface CoincidenciaImportacion {
  candidato: CandidatoImportacion;
  score: number;
}

/** Mejor candidato por encima del umbral, o null si ninguno alcanza. */
export function mejorCoincidencia(
  descripcion: string,
  candidatos: CandidatoImportacion[],
  umbral: number = UMBRAL_SIMILITUD_DEFAULT
): CoincidenciaImportacion | null {
  let mejor: CoincidenciaImportacion | null = null;
  for (const candidato of candidatos) {
    const score = similitud(descripcion, candidato.descripcion);
    if (!mejor || score > mejor.score) mejor = { candidato, score };
  }
  return mejor && mejor.score >= umbral ? mejor : null;
}
