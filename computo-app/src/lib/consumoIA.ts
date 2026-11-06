// Consumo de IA por empresa (nov-2026): cuánto gasta cada cliente en la API de
// Anthropic por mes, contra un techo por plan. Lo usan el panel /admin →
// Consumo IA y el job diario que avisa al SUPERADMIN (EventoAdmin + mail).
//
// LogConsumoIA guarda tokens, no plata: el costo se calcula acá con el precio
// del modelo. Todas las funciones de la app usan claude-sonnet-4-6 (USD 3 /
// 15 por millón de tokens de entrada / salida, sin recargo de contexto largo;
// verificado en platform.claude.com/docs/en/about-claude/pricing el
// 2026-11-06). Si se cambia de modelo, actualizar estos dos precios. La
// búsqueda web (USD 10 por 1.000) solo la usa verificar-precio-mercado, que es
// del SUPERADMIN y no queda asociada a ninguna empresa.

import { db } from "@/lib/db";
import { partesFechaUruguay } from "@/lib/fechaUruguay";

export const PRECIO_INPUT_USD_POR_MTOK = 3;
export const PRECIO_OUTPUT_USD_POR_MTOK = 15;

// Umbrales mensuales de gasto IA por plan, en USD. Neto después de IVA (22%) y
// MercadoPago: Básico (USD 25) deja USD 19,43 → techo sostenible ~USD 11,60;
// Premium (USD 35) deja USD 27,21 → techo ~USD 16,00.
export const UMBRAL_ATENCION_BASICO = 9;
export const UMBRAL_ALERTA_BASICO = 12;
export const UMBRAL_ATENCION_PREMIUM = 13;
export const UMBRAL_ALERTA_PREMIUM = 16;

export type NivelConsumo = "NORMAL" | "ATENCION" | "ALERTA";

export function costoUSD(inputTokens: number, outputTokens: number): number {
  return (inputTokens * PRECIO_INPUT_USD_POR_MTOK + outputTokens * PRECIO_OUTPUT_USD_POR_MTOK) / 1_000_000;
}

/** Umbrales del plan. Sin plan o desconocido (ej. empresa en PRUEBA) cuenta como básico; enterprise, como premium hasta que tenga los suyos. */
export function umbralesDelPlan(plan: string | null | undefined): { atencion: number; alerta: number } {
  if (plan === "premium" || plan === "enterprise") return { atencion: UMBRAL_ATENCION_PREMIUM, alerta: UMBRAL_ALERTA_PREMIUM };
  return { atencion: UMBRAL_ATENCION_BASICO, alerta: UMBRAL_ALERTA_BASICO };
}

export function nivelConsumo(costo: number, plan: string | null | undefined): NivelConsumo {
  const { atencion, alerta } = umbralesDelPlan(plan);
  if (costo >= alerta) return "ALERTA";
  if (costo >= atencion) return "ATENCION";
  return "NORMAL";
}

// ── Meses en hora de Uruguay (UTC−3 todo el año, sin horario de verano) ──

/** Instante en que empieza el mes `mes` (1–12) de `anio` en Uruguay. Acepta mes fuera de rango (0 = diciembre anterior, 13 = enero siguiente). */
export function inicioMesUruguay(anio: number, mes: number): Date {
  return new Date(Date.UTC(anio, mes - 1, 1, 3, 0, 0));
}

/** "aaaa-mm" de un mes relativo al actual (0 = este mes, −1 = el anterior…). */
function mesRelativo(desplazamiento: number, ahora: Date): { anio: number; mes: number; clave: string; desde: Date; hasta: Date } {
  const { anio, mes } = partesFechaUruguay(ahora);
  const desde = inicioMesUruguay(anio, mes + desplazamiento);
  const hasta = inicioMesUruguay(anio, mes + desplazamiento + 1);
  const d = new Date(desde.getTime() + 12 * 3_600_000); // un instante seguro dentro del mes
  const a = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  return { anio: a, mes: m, clave: `${a}-${String(m).padStart(2, "0")}`, desde, hasta };
}

export function mesActualUruguay(ahora: Date = new Date()) {
  return mesRelativo(0, ahora);
}

// ── Resumen por empresa (tabla del panel y job diario) ──

export interface ConsumoEmpresa {
  empresaId: string;
  nombre: string;
  plan: string;
  estado: string;
  gastoMes: number;
  llamadasMes: number;
  funcionMasUsada: string | null;
  gastoMesAnterior: number;
  nivel: NivelConsumo;
}

export interface ResumenConsumoIA {
  mes: string;
  umbrales: { basico: { atencion: number; alerta: number }; premium: { atencion: number; alerta: number } };
  empresas: ConsumoEmpresa[];
  totales: { gastoMes: number; llamadasMes: number; promedioPorCliente: number };
}

type FilaAgregada = { empresaId: string; llamadas: bigint; tin: bigint | null; tout: bigint | null };

async function agregadoPorEmpresa(desde: Date, hasta: Date): Promise<Map<string, { llamadas: number; costo: number }>> {
  const filas = await db.$queryRaw<FilaAgregada[]>`
    SELECT "empresaId", count(*) AS llamadas, sum("inputTokens") AS tin, sum("outputTokens") AS tout
    FROM "LogConsumoIA"
    WHERE "empresaId" IS NOT NULL AND "createdAt" >= ${desde} AND "createdAt" < ${hasta}
    GROUP BY "empresaId"`;
  return new Map(
    filas.map((f) => [f.empresaId, { llamadas: Number(f.llamadas), costo: costoUSD(Number(f.tin ?? 0), Number(f.tout ?? 0)) }])
  );
}

/**
 * Consumo del mes en curso (hora de Uruguay) de las empresas clientes que
 * pueden usar la IA: ACTIVA y PRUEBA (PRUEBA sin plan propio cuenta como
 * básico). Ordenado por gasto del mes, de mayor a menor.
 */
export async function resumenConsumoIA(ahora: Date = new Date()): Promise<ResumenConsumoIA> {
  const actual = mesRelativo(0, ahora);
  const anterior = mesRelativo(-1, ahora);

  const [empresas, mesActual, mesAnterior, porFuncion] = await Promise.all([
    db.empresa.findMany({
      where: { estado: { in: ["ACTIVA", "PRUEBA"] } },
      select: { id: true, nombre: true, plan: true, estado: true },
    }),
    agregadoPorEmpresa(actual.desde, actual.hasta),
    agregadoPorEmpresa(anterior.desde, anterior.hasta),
    db.$queryRaw<{ empresaId: string; funcion: string; n: bigint }[]>`
      SELECT "empresaId", funcion, count(*) AS n
      FROM "LogConsumoIA"
      WHERE "empresaId" IS NOT NULL AND "createdAt" >= ${actual.desde} AND "createdAt" < ${actual.hasta}
      GROUP BY "empresaId", funcion`,
  ]);

  const masUsada = new Map<string, { funcion: string; n: number }>();
  for (const f of porFuncion) {
    const n = Number(f.n);
    const previa = masUsada.get(f.empresaId);
    if (!previa || n > previa.n) masUsada.set(f.empresaId, { funcion: f.funcion, n });
  }

  const filas: ConsumoEmpresa[] = empresas.map((e) => {
    const plan = e.estado === "PRUEBA" && !e.plan ? "basico" : e.plan;
    const gastoMes = mesActual.get(e.id)?.costo ?? 0;
    return {
      empresaId: e.id,
      nombre: e.nombre,
      plan,
      estado: e.estado,
      gastoMes,
      llamadasMes: mesActual.get(e.id)?.llamadas ?? 0,
      funcionMasUsada: masUsada.get(e.id)?.funcion ?? null,
      gastoMesAnterior: mesAnterior.get(e.id)?.costo ?? 0,
      nivel: nivelConsumo(gastoMes, plan),
    };
  });
  filas.sort((a, b) => b.gastoMes - a.gastoMes || a.nombre.localeCompare(b.nombre));

  const gastoMes = filas.reduce((s, f) => s + f.gastoMes, 0);
  const llamadasMes = filas.reduce((s, f) => s + f.llamadasMes, 0);
  return {
    mes: actual.clave,
    umbrales: { basico: umbralesDelPlan("basico"), premium: umbralesDelPlan("premium") },
    empresas: filas,
    totales: { gastoMes, llamadasMes, promedioPorCliente: filas.length > 0 ? gastoMes / filas.length : 0 },
  };
}

// ── Detalle de una empresa (al hacer clic en una fila) ──

export interface DetalleConsumoEmpresa {
  empresaId: string;
  nombre: string;
  plan: string;
  mes: string;
  porFuncion: { funcion: string; llamadas: number; inputTokens: number; outputTokens: number; costo: number }[];
  ultimosMeses: { mes: string; costo: number; llamadas: number }[];
  gastoMes: number;
  gastoMesAnterior: number;
}

export async function detalleConsumoEmpresa(empresaId: string, ahora: Date = new Date()): Promise<DetalleConsumoEmpresa | null> {
  const empresa = await db.empresa.findUnique({ where: { id: empresaId }, select: { id: true, nombre: true, plan: true, estado: true } });
  if (!empresa) return null;
  const actual = mesRelativo(0, ahora);
  const meses = [-5, -4, -3, -2, -1, 0].map((d) => mesRelativo(d, ahora));

  const [funciones, historico] = await Promise.all([
    db.$queryRaw<{ funcion: string; n: bigint; tin: bigint | null; tout: bigint | null }[]>`
      SELECT funcion, count(*) AS n, sum("inputTokens") AS tin, sum("outputTokens") AS tout
      FROM "LogConsumoIA"
      WHERE "empresaId" = ${empresaId} AND "createdAt" >= ${actual.desde} AND "createdAt" < ${actual.hasta}
      GROUP BY funcion`,
    db.$queryRaw<{ desde: Date; n: bigint; tin: bigint | null; tout: bigint | null }[]>`
      SELECT date_trunc('month', "createdAt" - interval '3 hours') AS desde, count(*) AS n,
             sum("inputTokens") AS tin, sum("outputTokens") AS tout
      FROM "LogConsumoIA"
      WHERE "empresaId" = ${empresaId} AND "createdAt" >= ${meses[0].desde} AND "createdAt" < ${actual.hasta}
      GROUP BY 1`,
  ]);

  const porFuncion = funciones
    .map((f) => {
      const inputTokens = Number(f.tin ?? 0);
      const outputTokens = Number(f.tout ?? 0);
      return { funcion: f.funcion, llamadas: Number(f.n), inputTokens, outputTokens, costo: costoUSD(inputTokens, outputTokens) };
    })
    .sort((a, b) => b.costo - a.costo);

  // date_trunc sobre la hora de Uruguay devuelve el 1° del mes a las 00:00 "sin zona": su año-mes es la clave.
  const porMes = new Map(
    historico.map((h) => {
      const d = new Date(h.desde);
      const clave = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      return [clave, { costo: costoUSD(Number(h.tin ?? 0), Number(h.tout ?? 0)), llamadas: Number(h.n) }];
    })
  );
  const ultimosMeses = meses.map((m) => ({ mes: m.clave, costo: porMes.get(m.clave)?.costo ?? 0, llamadas: porMes.get(m.clave)?.llamadas ?? 0 }));

  return {
    empresaId: empresa.id,
    nombre: empresa.nombre,
    plan: empresa.estado === "PRUEBA" && !empresa.plan ? "basico" : empresa.plan,
    mes: actual.clave,
    porFuncion,
    ultimosMeses,
    gastoMes: ultimosMeses[5].costo,
    gastoMesAnterior: ultimosMeses[4].costo,
  };
}

// ── Job diario: avisos al SUPERADMIN ──

export const TIPO_EVENTO_CONSUMO: Record<Exclude<NivelConsumo, "NORMAL">, string> = {
  ATENCION: "CONSUMO_IA_ATENCION",
  ALERTA: "CONSUMO_IA_ALERTA",
};

export function textoAvisoConsumo(nivel: Exclude<NivelConsumo, "NORMAL">, empresa: string, gasto: number): string {
  const monto = gasto.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return nivel === "ALERTA"
    ? `⚠️ ${empresa} — consumo IA USD ${monto} este mes (zona de pérdida)`
    : `⚡ ${empresa} — consumo IA USD ${monto} este mes (cerca del límite)`;
}
