// Cliente de Anthropic según el estado de la empresa (oct-2026) — el ÚNICO
// lugar de la app que crea clientes de Anthropic.
//
//   - Empresa en PRUEBA → ANTHROPIC_API_KEY_PRUEBA (workspace "CÓMPUTO+
//     Pruebas", con su propio tope de gasto). Falla cerrado: si la clave no
//     está, NUNCA cae a la principal — tira ErrorFuncionNoDisponible.
//   - ACTIVA / null (SUPERADMIN sobre el catálogo global) → ANTHROPIC_API_KEY.
//   - VENCIDA / DESACTIVADA no llegan acá (lib/sesion.ts y proxy.ts las
//     cortan antes); si llegaran, van con la principal como cualquier no-PRUEBA.
//
// El estado se lee de la base en cada llamada (clienteParaEmpresa), así una
// empresa que pasa de PRUEBA a ACTIVA desde /admin cambia de clave al instante.
//
// crearMensaje() es lo que usan todas las funciones asistidas: elige el
// cliente, hace la llamada y traduce los topes de gasto (workspace de pruebas,
// organización) a ErrorFuncionNoDisponible, registrando un EventoAdmin. Los
// códigos HTTP salen de la documentación oficial de Anthropic (api/rate-limits,
// api/errors): el tope de un workspace que fijamos nosotros es un 400, NO un 429.

import Anthropic from "@anthropic-ai/sdk";
import type { EstadoEmpresa } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { registrarEventoAdmin } from "@/lib/eventos-admin";

export type CodigoNoDisponible =
  | "ANTHROPIC_KEY_PRUEBA_NO_CONFIGURADA"
  | "LIMITE_WORKSPACE_ALCANZADO"
  | "LIMITE_ORG_ALCANZADO"
  | "PROBLEMA_DE_FACTURACION";

export class ErrorFuncionNoDisponible extends Error {
  constructor(
    public codigo: CodigoNoDisponible,
    /** Estado de la empresa que hizo la llamada (decide el mensaje al usuario). */
    public estadoEmpresa: EstadoEmpresa | null = null
  ) {
    super(`Función no disponible: ${codigo}`);
    this.name = "ErrorFuncionNoDisponible";
  }
}

// Un cliente por clave, reutilizado (no uno nuevo por pedido).
const clientes = new Map<string, Anthropic>();
function clienteConClave(apiKey: string | undefined): Anthropic {
  const k = apiKey ?? "";
  let cliente = clientes.get(k);
  if (!cliente) {
    cliente = new Anthropic({ apiKey });
    clientes.set(k, cliente);
  }
  return cliente;
}

/**
 * Cliente según el estado de la empresa. PRUEBA → clave de pruebas (falla
 * cerrado); cualquier otro estado o null → clave principal.
 */
export function getAnthropicClient(estadoEmpresa: EstadoEmpresa | null): Anthropic {
  if (estadoEmpresa === "PRUEBA") {
    const key = process.env.ANTHROPIC_API_KEY_PRUEBA;
    if (!key) throw new ErrorFuncionNoDisponible("ANTHROPIC_KEY_PRUEBA_NO_CONFIGURADA", estadoEmpresa);
    return clienteConClave(key);
  }
  return clienteConClave(process.env.ANTHROPIC_API_KEY);
}

/** Estado de la empresa leído de la base (null = sin empresa: SUPERADMIN / catálogo global). */
async function estadoDeEmpresa(empresaId: string | null): Promise<EstadoEmpresa | null> {
  if (!empresaId) return null;
  const empresa = await db.empresa.findUnique({ where: { id: empresaId }, select: { estado: true } });
  return empresa?.estado ?? null;
}

/** Cliente para una empresa, leyendo su estado de la base. null = SUPERADMIN / sin empresa. */
export async function clienteParaEmpresa(empresaId: string | null): Promise<Anthropic> {
  return getAnthropicClient(await estadoDeEmpresa(empresaId));
}

export interface ContextoLlamada {
  /** Empresa que dispara la llamada; null para tareas de SUPERADMIN sobre el catálogo global. */
  empresaId: string | null;
  /** Nombre de la función (mismo que LogConsumoIA.funcion), para el EventoAdmin. */
  funcion: string;
}

/**
 * messages.create con el cliente de la empresa. Los topes de gasto y los
 * problemas de facturación salen como ErrorFuncionNoDisponible (con un
 * EventoAdmin registrado); cualquier otro error se propaga tal cual.
 */
export async function crearMensaje(
  contexto: ContextoLlamada,
  params: Anthropic.MessageCreateParamsNonStreaming
): Promise<Anthropic.Message> {
  const estado = await estadoDeEmpresa(contexto.empresaId);
  let cliente: Anthropic;
  try {
    cliente = getAnthropicClient(estado);
  } catch (err) {
    if (err instanceof ErrorFuncionNoDisponible) {
      await registrarEventoAdmin(err.codigo, contexto.empresaId, contexto.funcion, "Falta ANTHROPIC_API_KEY_PRUEBA en el servidor.");
    }
    throw err;
  }
  try {
    return await cliente.messages.create(params);
  } catch (err) {
    const tope = clasificarErrorAnthropic(err);
    if (!tope) throw err;
    await registrarEventoAdmin(tope.evento, contexto.empresaId, contexto.funcion, tope.detalle(estado));
    throw new ErrorFuncionNoDisponible(tope.codigo, estado);
  }
}

/**
 * Traduce un error de la API a un tope / problema de facturación. null si es
 * otro error (rate limit momentáneo, 5xx, red…): ese se propaga como siempre.
 * El cuerpo del error está en err.error ({ type: "error", error: { type,
 * message, details } }) — err.message es "400 {…json…}", no el texto de la API.
 */
export function clasificarErrorAnthropic(err: unknown) {
  // Por forma y no con instanceof: el SDK se publica en CJS y ESM, y si se
  // cargan las dos copias, la clase del error no es la misma que la importada.
  if (!esErrorDeApi(err)) return null;
  const cuerpo = (err.error ?? {}) as { error?: { message?: string; details?: { error_code?: string } } };
  const mensaje = cuerpo.error?.message ?? "";
  const codigoApi = cuerpo.error?.details?.error_code;
  const pedido = err.requestID ? ` (request ${err.requestID})` : "";
  const detalle = (texto: string) => (estado: EstadoEmpresa | null) =>
    `${texto} Clave usada: ${estado === "PRUEBA" ? "pruebas" : "principal"}.${pedido}`;

  // Tope que fijamos a un workspace (el de pruebas): 400 invalid_request_error.
  if (err.status === 400 && mensaje.startsWith("You have reached your specified workspace API usage limits")) {
    return { evento: "WORKSPACE_SPEND_LIMIT", codigo: "LIMITE_WORKSPACE_ALCANZADO" as const, detalle: detalle("Se alcanzó el tope mensual de gasto del workspace.") };
  }
  // Tope que fijamos a toda la organización: también 400.
  if (err.status === 400 && mensaje.startsWith("You have reached your specified API usage limits")) {
    return { evento: "ORG_SPEND_LIMIT", codigo: "LIMITE_ORG_ALCANZADO" as const, detalle: detalle("Se alcanzó el tope de gasto fijado para la organización (afecta a todas las empresas).") };
  }
  // Tope mensual del plan de Anthropic (tier): 429 sin retry-after.
  if (err.status === 429 && codigoApi === "enforced_spend_limit_reached") {
    return { evento: "ORG_SPEND_LIMIT", codigo: "LIMITE_ORG_ALCANZADO" as const, detalle: detalle("Se alcanzó el tope mensual del plan de Anthropic (afecta a todas las empresas).") };
  }
  // Problema de pago de la cuenta de Anthropic.
  if (err.status === 402) {
    return { evento: "BILLING_ERROR", codigo: "PROBLEMA_DE_FACTURACION" as const, detalle: detalle(`Problema de facturación en Anthropic: ${mensaje || err.message}`) };
  }
  return null;
}

function esErrorDeApi(err: unknown): err is { status: number; error?: unknown; message: string; requestID?: string | null } {
  return err instanceof Anthropic.APIError || (err instanceof Error && typeof (err as { status?: unknown }).status === "number" && "error" in err);
}
