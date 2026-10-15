// Acceso por estado de la empresa y cupos de la prueba gratis (oct-2026).
//
//   - Estado efectivo: una empresa en PRUEBA con la fecha de vencimiento
//     pasada vale como VENCIDA (y se persiste la primera vez que se nota).
//   - VENCIDA: solo lectura. El bloqueo de escritura vive en src/proxy.ts
//     (todo POST/PUT/PATCH/DELETE de /api/*); lectura y PDF siguen andando.
//   - DESACTIVADA y email sin verificar: sin acceso (lib/sesion.ts).
//   - Funciones asistidas en PRUEBA: Cálculo Rápido con cupo propio, un
//     proyecto asistido (la primera función asistida usada en un proyecto lo
//     ocupa; las siguientes en ESE proyecto son libres) y el resto de las
//     funciones sin proyecto bloqueadas directamente.
//
// El consumo se registra en ConsumoFuncionesAsistidas ANTES de llamar al
// servicio, en la misma transacción que chequea el cupo (con la fila de la
// empresa bloqueada), así dos pedidos simultáneos no pasan el límite.
// Valores de cupos y días en src/lib/config-prueba.ts.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mensajeCupoCalculoRapido, mensajeCupoProyectoAsistido, whatsappContacto } from "@/lib/config-prueba";
import type { EstadoEmpresa } from "@/generated/prisma/client";
import type { SesionUsuario } from "@/lib/sesion";
import { ErrorFuncionNoDisponible } from "@/lib/anthropic-client";

export type TipoFuncionAsistida = "calculo_rapido" | "proyecto_ia";

export type CodigoAcceso =
  | "EMAIL_NO_VERIFICADO"
  | "EMPRESA_DESACTIVADA"
  | "PRUEBA_VENCIDA"
  | "CUPO_AGOTADO"
  | "NO_DISPONIBLE_EN_PRUEBA";

const MENSAJES: Record<Exclude<CodigoAcceso, "CUPO_AGOTADO">, string> = {
  EMAIL_NO_VERIFICADO: "Tenés que verificar tu email para usar CÓMPUTO+.",
  EMPRESA_DESACTIVADA: "Tu cuenta está desactivada. Escribinos para reactivarla.",
  PRUEBA_VENCIDA:
    "Tu período de prueba venció. Estás en modo solo lectura: podés ver y exportar tus proyectos, pero no modificarlos.",
  NO_DISPONIBLE_EN_PRUEBA: "Esta función no está disponible en la prueba gratis. Escribinos y te contamos cómo activarla.",
};

/** PRUEBA con el vencimiento pasado cuenta como VENCIDA. */
export function estadoEfectivo(e: { estado: EstadoEmpresa; fechaVencimientoPrueba: Date | null }, ahora = new Date()): EstadoEmpresa {
  if (e.estado === "PRUEBA" && e.fechaVencimientoPrueba && e.fechaVencimientoPrueba.getTime() <= ahora.getTime()) {
    return "VENCIDA";
  }
  return e.estado;
}

/** Deja persistido el paso PRUEBA → VENCIDA (idempotente, nunca pisa otro estado). */
async function persistirVencimiento(empresaId: string): Promise<void> {
  await db.empresa
    .updateMany({ where: { id: empresaId, estado: "PRUEBA", fechaVencimientoPrueba: { lte: new Date() } }, data: { estado: "VENCIDA" } })
    .catch((err) => console.error("[acceso] no se pudo persistir el vencimiento", err));
}

/** Datos de acceso de un usuario (de la base, no del JWT). null si el usuario ya no existe. */
export async function estadoAccesoUsuario(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { emailVerificado: true, empresa: { select: { id: true, estado: true, fechaVencimientoPrueba: true } } },
  });
  if (!user) return null;
  const estado = estadoEfectivo(user.empresa);
  if (estado !== user.empresa.estado) await persistirVencimiento(user.empresa.id);
  return { emailVerificado: user.emailVerificado, empresaId: user.empresa.id, estado };
}

/** Respuesta estándar de acceso denegado: código, mensaje y link de WhatsApp con el email del usuario. */
export function respuestaAcceso(codigo: CodigoAcceso, email: string, extra: { mensaje?: string; [k: string]: unknown } = {}) {
  const { mensaje, ...resto } = extra;
  return NextResponse.json(
    {
      error: codigo,
      mensaje: mensaje ?? (codigo === "CUPO_AGOTADO" ? "Usaste el cupo de la prueba gratis." : MENSAJES[codigo]),
      contacto: whatsappContacto(email),
      ...resto,
    },
    { status: codigo === "EMAIL_NO_VERIFICADO" ? 401 : 403 }
  );
}

const limiteDe = (e: { cupoCalculosRapidos: number; cupoProyectosIA: number }, tipo: TipoFuncionAsistida) =>
  tipo === "calculo_rapido" ? e.cupoCalculosRapidos : e.cupoProyectosIA;

/**
 * Cupo de una función asistida para la empresa. limite null = sin límite
 * (empresa ACTIVA). En VENCIDA/DESACTIVADA nunca está permitida.
 */
export async function verificarCupoFuncionAsistida(
  empresaId: string,
  tipo: TipoFuncionAsistida
): Promise<{ permitido: boolean; usado: number; limite: number | null }> {
  const empresa = await db.empresa.findUnique({
    where: { id: empresaId },
    select: { estado: true, fechaVencimientoPrueba: true, cupoCalculosRapidos: true, cupoProyectosIA: true },
  });
  if (!empresa) return { permitido: false, usado: 0, limite: 0 };
  const usado = await db.consumoFuncionesAsistidas.count({ where: { empresaId, tipo } });
  const estado = estadoEfectivo(empresa);
  if (estado === "ACTIVA") return { permitido: true, usado, limite: null };
  if (estado !== "PRUEBA") return { permitido: false, usado, limite: limiteDe(empresa, tipo) };
  const limite = limiteDe(empresa, tipo);
  return { permitido: usado < limite, usado, limite };
}

/**
 * Registra el uso de una función asistida antes de llamar al servicio.
 * Devuelve el id del consumo (null si no hizo falta registrar: empresa
 * ACTIVA, o proyecto que ya es el asistido) o la respuesta 403 lista para
 * retornar. proyecto_ia requiere proyectoId.
 */
export async function consumirFuncionAsistida(
  sesion: SesionUsuario,
  tipo: TipoFuncionAsistida,
  proyectoId?: string
): Promise<{ consumoId: string | null } | NextResponse> {
  if (tipo === "proyecto_ia" && !proyectoId) throw new Error("consumirFuncionAsistida: proyecto_ia sin proyectoId");

  const resultado = await db.$transaction(async (tx) => {
    // Serializa los consumos de la misma empresa hasta el fin de la transacción.
    await tx.$queryRaw`SELECT id FROM "Empresa" WHERE id = ${sesion.empresaId} FOR UPDATE`;
    const empresa = await tx.empresa.findUnique({
      where: { id: sesion.empresaId },
      select: { estado: true, fechaVencimientoPrueba: true, cupoCalculosRapidos: true, cupoProyectosIA: true },
    });
    if (!empresa) return { tipo: "denegado" as const, codigo: "EMPRESA_DESACTIVADA" as const };
    const estado = estadoEfectivo(empresa);
    if (estado === "ACTIVA") return { tipo: "ok" as const, consumoId: null };
    if (estado === "VENCIDA") return { tipo: "denegado" as const, codigo: "PRUEBA_VENCIDA" as const };
    if (estado === "DESACTIVADA") return { tipo: "denegado" as const, codigo: "EMPRESA_DESACTIVADA" as const };

    if (tipo === "proyecto_ia") {
      const yaAsistido = await tx.consumoFuncionesAsistidas.findFirst({
        where: { empresaId: sesion.empresaId, tipo, proyectoId },
        select: { id: true },
      });
      if (yaAsistido) return { tipo: "ok" as const, consumoId: null };
    }
    const usado = await tx.consumoFuncionesAsistidas.count({ where: { empresaId: sesion.empresaId, tipo } });
    const limite = limiteDe(empresa, tipo);
    if (usado >= limite) return { tipo: "agotado" as const, usado, limite };
    const consumo = await tx.consumoFuncionesAsistidas.create({
      data: { empresaId: sesion.empresaId, tipo, proyectoId: proyectoId ?? null },
      select: { id: true },
    });
    return { tipo: "ok" as const, consumoId: consumo.id };
  });

  if (resultado.tipo === "ok") return { consumoId: resultado.consumoId };
  if (resultado.tipo === "denegado") return respuestaAcceso(resultado.codigo, sesion.email);

  const { usado, limite } = resultado;
  let mensaje: string;
  if (tipo === "calculo_rapido") {
    mensaje = mensajeCupoCalculoRapido(limite);
  } else {
    const asistidos = await db.consumoFuncionesAsistidas.findMany({
      where: { empresaId: sesion.empresaId, tipo, proyectoId: { not: null } },
      select: { proyectoId: true },
      orderBy: { createdAt: "asc" },
    });
    const proyectos = await db.proyecto.findMany({
      where: { id: { in: asistidos.map((a) => a.proyectoId!) }, empresaId: sesion.empresaId },
      select: { nombre: true },
    });
    mensaje = mensajeCupoProyectoAsistido(limite, proyectos.map((p) => p.nombre));
  }
  return respuestaAcceso("CUPO_AGOTADO", sesion.email, { mensaje, tipo, usado, limite });
}

/** Devuelve un consumo si el servicio falló (para que un error no gaste cupo). */
export async function devolverConsumo(consumoId: string | null): Promise<void> {
  if (!consumoId) return;
  await db.consumoFuncionesAsistidas.deleteMany({ where: { id: consumoId } }).catch((err) => console.error("[acceso] devolverConsumo", err));
}

/** Funciones asistidas sin proyecto: no disponibles en PRUEBA. null = puede seguir. */
export async function bloquearSiEsPrueba(sesion: SesionUsuario): Promise<NextResponse | null> {
  const acceso = await estadoAccesoUsuario(sesion.id);
  if (acceso?.estado === "PRUEBA") return respuestaAcceso("NO_DISPONIBLE_EN_PRUEBA", sesion.email);
  return null;
}

/**
 * Respuesta al usuario cuando el servicio asistido no está disponible (tope
 * de gasto alcanzado, clave de pruebas sin configurar, facturación): 503
 * FUNCION_NO_DISPONIBLE con un mensaje sin detalles internos y el link de
 * WhatsApp. null si el error es otro (la ruta sigue con su manejo de siempre).
 * El EventoAdmin ya lo registró crearMensaje() (lib/anthropic-client.ts).
 */
export function respuestaFuncionNoDisponible(err: unknown, email: string): NextResponse | null {
  if (!(err instanceof ErrorFuncionNoDisponible)) return null;
  const mensaje =
    err.estadoEmpresa === "PRUEBA" && err.codigo === "LIMITE_WORKSPACE_ALCANZADO"
      ? "Por ahora no podemos habilitar más pruebas con esta función. Escribinos por WhatsApp."
      : "Esta función no está disponible por ahora. Escribinos por WhatsApp y te avisamos cuando vuelva.";
  return NextResponse.json({ error: "FUNCION_NO_DISPONIBLE", mensaje, contacto: whatsappContacto(email) }, { status: 503 });
}
