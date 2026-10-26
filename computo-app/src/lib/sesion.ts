// Autorización por tenant (Multi-tenant, oct-2026). Cada ruta API que toca
// datos de una empresa pasa por acá: sin sesión → 401; con sesión pero el
// recurso es de otra empresa → 404 (no 403, para no revelar que existe).
//
// Uso en un route handler:
//   const acceso = await requerirProyecto(proyectoId);
//   if (acceso instanceof NextResponse) return acceso;
//   // acceso.empresaId, acceso.id (usuario), ...
//
// El proxy (src/proxy.ts) ya corta las /api/* sin sesión con 401; esto es la
// segunda capa, y la única que sabe de empresas.
//
// Los hijos de un proyecto (entradas de bitácora, ítems de una orden, etc.)
// se validan en cada ruta filtrando también por el proyecto, ej.
//   db.entradaBitacora.findFirst({ where: { id: entradaId, proyectoId } })
//
// Registro público (oct-2026): además del JWT, cada pedido lee de la base el
// usuario y su empresa (ver lib/acceso.ts): email sin verificar → 401
// EMAIL_NO_VERIFICADO; empresa DESACTIVADA → 403 EMPRESA_DESACTIVADA. Una
// empresa VENCIDA sí pasa acá (lectura); su bloqueo de escritura está en
// src/proxy.ts.

import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { estadoAccesoUsuario, respuestaAcceso } from "@/lib/acceso";
import { esRol, type Rol } from "@/lib/roles";

export type SesionUsuario = {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  empresaId: string;
};

const noAutenticado = () => NextResponse.json({ error: "No autenticado" }, { status: 401 });
const noEncontrado = (mensaje: string) => NextResponse.json({ error: mensaje }, { status: 404 });

/**
 * Sesión del pedido validada contra la base: usuario existente, email
 * verificado y empresa no desactivada. empresaId sale de la base (no del
 * JWT). Si no pasa, devuelve la respuesta 401/403 lista para retornar.
 */
async function resolverSesion(): Promise<SesionUsuario | NextResponse> {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  if (!user?.id || !user.empresaId) return noAutenticado();
  const acceso = await estadoAccesoUsuario(user.id);
  if (!acceso) return noAutenticado();
  if (!acceso.emailVerificado) return respuestaAcceso("EMAIL_NO_VERIFICADO", user.email);
  if (acceso.estado === "DESACTIVADA") return respuestaAcceso("EMPRESA_DESACTIVADA", user.email);
  return { ...user, empresaId: acceso.empresaId };
}

/** Sesión válida o null (páginas de servidor: con null redirigen a /login). */
export async function sesionActual(): Promise<SesionUsuario | null> {
  const sesion = await resolverSesion();
  return sesion instanceof NextResponse ? null : sesion;
}

/** Sesión obligatoria. Devuelve el usuario o la respuesta 401/403 lista para retornar. */
export async function requerirSesion(): Promise<SesionUsuario | NextResponse> {
  return resolverSesion();
}

/** Sesión + que el proyecto sea de la empresa del usuario (si no, 404). */
export async function requerirProyecto(proyectoId: string): Promise<SesionUsuario | NextResponse> {
  const sesion = await resolverSesion();
  if (sesion instanceof NextResponse) return sesion;
  const proyecto = await db.proyecto.findFirst({
    where: { id: proyectoId, empresaId: sesion.empresaId },
    select: { id: true },
  });
  return proyecto ? sesion : noEncontrado("Proyecto no encontrado");
}

/** Igual que requerirProyecto, partiendo de un rubro. Devuelve también el proyectoId. */
export async function requerirRubro(rubroId: string): Promise<(SesionUsuario & { proyectoId: string }) | NextResponse> {
  const sesion = await resolverSesion();
  if (sesion instanceof NextResponse) return sesion;
  const rubro = await db.rubro.findFirst({
    where: { id: rubroId, capitulo: { proyecto: { empresaId: sesion.empresaId } } },
    select: { capitulo: { select: { proyectoId: true } } },
  });
  return rubro ? { ...sesion, proyectoId: rubro.capitulo.proyectoId } : noEncontrado("Rubro no encontrado");
}

/** Igual que requerirProyecto, partiendo de un capítulo. */
export async function requerirCapitulo(capituloId: string): Promise<(SesionUsuario & { proyectoId: string }) | NextResponse> {
  const sesion = await resolverSesion();
  if (sesion instanceof NextResponse) return sesion;
  const capitulo = await db.capitulo.findFirst({
    where: { id: capituloId, proyecto: { empresaId: sesion.empresaId } },
    select: { proyectoId: true },
  });
  return capitulo ? { ...sesion, proyectoId: capitulo.proyectoId } : noEncontrado("Capítulo no encontrado");
}

/** Igual que requerirProyecto, partiendo de un título. */
export async function requerirTitulo(tituloId: string): Promise<(SesionUsuario & { proyectoId: string }) | NextResponse> {
  const sesion = await resolverSesion();
  if (sesion instanceof NextResponse) return sesion;
  const titulo = await db.titulo.findFirst({
    where: { id: tituloId, proyecto: { empresaId: sesion.empresaId } },
    select: { proyectoId: true },
  });
  return titulo ? { ...sesion, proyectoId: titulo.proyectoId } : noEncontrado("Título no encontrado");
}

/** Igual que requerirProyecto, partiendo de una cotización de proveedor. */
export async function requerirCotizacion(cotizacionId: string): Promise<(SesionUsuario & { proyectoId: string }) | NextResponse> {
  const sesion = await resolverSesion();
  if (sesion instanceof NextResponse) return sesion;
  const cot = await db.cotizacionProveedor.findFirst({
    where: { id: cotizacionId, rubro: { capitulo: { proyecto: { empresaId: sesion.empresaId } } } },
    select: { rubro: { select: { capitulo: { select: { proyectoId: true } } } } },
  });
  return cot ? { ...sesion, proyectoId: cot.rubro.capitulo.proyectoId } : noEncontrado("Cotización no encontrada");
}

/** 404 estándar para un hijo que no pertenece al proyecto de la URL (mensaje completo, ej. "Entrada no encontrada"). */
export function hijoNoEncontrado(mensaje: string): NextResponse {
  return noEncontrado(mensaje);
}

/**
 * true si todos los rubros (ids que llegan en el body) son del proyecto.
 * Vacío o sin ids → true. Evita vincular rubros de otro proyecto/empresa.
 */
export async function rubrosSonDelProyecto(rubroIds: (string | null | undefined)[], proyectoId: string): Promise<boolean> {
  const ids = [...new Set(rubroIds.filter((r): r is string => !!r))];
  if (ids.length === 0) return true;
  const n = await db.rubro.count({ where: { id: { in: ids }, capitulo: { proyectoId } } });
  return n === ids.length;
}

/** Igual que rubrosSonDelProyecto, para capítulos. */
export async function capitulosSonDelProyecto(capituloIds: (string | null | undefined)[], proyectoId: string): Promise<boolean> {
  const ids = [...new Set(capituloIds.filter((c): c is string => !!c))];
  if (ids.length === 0) return true;
  const n = await db.capitulo.count({ where: { id: { in: ids }, proyectoId } });
  return n === ids.length;
}

/**
 * true si el usuario de la sesión es SUPERADMIN. El rol se lee de la base y
 * no del JWT: el token guarda el rol del momento del login, y un cambio de
 * rol (subir o bajar privilegios) tiene que valer en el acto.
 */
export async function esSuperadmin(sesion: SesionUsuario): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: sesion.id }, select: { rol: true } });
  return user?.rol === "SUPERADMIN";
}

/**
 * Sesión + rol ADMIN o SUPERADMIN (importar listas de precios). El rol se lee de la base, no del
 * JWT. Devuelve la sesión con `rol` ya resuelto; con otro rol (USUARIO) → 403.
 */
export async function requerirAdminOSuperadmin(
  mensaje = "Solo un administrador puede importar listas de precios"
): Promise<SesionUsuario | NextResponse> {
  const sesion = await resolverSesion();
  if (sesion instanceof NextResponse) return sesion;
  const user = await db.user.findUnique({ where: { id: sesion.id }, select: { rol: true } });
  if (!user || !esRol(user.rol) || (user.rol !== "SUPERADMIN" && user.rol !== "ADMIN")) {
    return NextResponse.json({ error: mensaje }, { status: 403 });
  }
  return { ...sesion, rol: user.rol };
}

/** Sesión + rol SUPERADMIN (panel /admin). Sin sesión → 401; otro rol → 403. */
export async function requerirSuperadmin(): Promise<SesionUsuario | NextResponse> {
  const sesion = await resolverSesion();
  if (sesion instanceof NextResponse) return sesion;
  if (!(await esSuperadmin(sesion))) {
    return NextResponse.json({ error: "Solo un SUPERADMIN puede hacer esto" }, { status: 403 });
  }
  return { ...sesion, rol: "SUPERADMIN" };
}
