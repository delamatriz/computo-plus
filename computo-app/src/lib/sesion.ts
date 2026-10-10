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

import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export type SesionUsuario = {
  id: string;
  email: string;
  nombre: string;
  rol: string;
  empresaId: string;
};

const noAutenticado = () => NextResponse.json({ error: "No autenticado" }, { status: 401 });
const noEncontrado = (mensaje: string) => NextResponse.json({ error: mensaje }, { status: 404 });

export async function sesionActual(): Promise<SesionUsuario | null> {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  if (!user?.id || !user.empresaId) return null;
  return user;
}

/** Sesión obligatoria. Devuelve el usuario o un 401 listo para retornar. */
export async function requerirSesion(): Promise<SesionUsuario | NextResponse> {
  return (await sesionActual()) ?? noAutenticado();
}

/** Sesión + que el proyecto sea de la empresa del usuario (si no, 404). */
export async function requerirProyecto(proyectoId: string): Promise<SesionUsuario | NextResponse> {
  const sesion = await sesionActual();
  if (!sesion) return noAutenticado();
  const proyecto = await db.proyecto.findFirst({
    where: { id: proyectoId, empresaId: sesion.empresaId },
    select: { id: true },
  });
  return proyecto ? sesion : noEncontrado("Proyecto no encontrado");
}

/** Igual que requerirProyecto, partiendo de un rubro. Devuelve también el proyectoId. */
export async function requerirRubro(rubroId: string): Promise<(SesionUsuario & { proyectoId: string }) | NextResponse> {
  const sesion = await sesionActual();
  if (!sesion) return noAutenticado();
  const rubro = await db.rubro.findFirst({
    where: { id: rubroId, capitulo: { proyecto: { empresaId: sesion.empresaId } } },
    select: { capitulo: { select: { proyectoId: true } } },
  });
  return rubro ? { ...sesion, proyectoId: rubro.capitulo.proyectoId } : noEncontrado("Rubro no encontrado");
}

/** Igual que requerirProyecto, partiendo de un capítulo. */
export async function requerirCapitulo(capituloId: string): Promise<(SesionUsuario & { proyectoId: string }) | NextResponse> {
  const sesion = await sesionActual();
  if (!sesion) return noAutenticado();
  const capitulo = await db.capitulo.findFirst({
    where: { id: capituloId, proyecto: { empresaId: sesion.empresaId } },
    select: { proyectoId: true },
  });
  return capitulo ? { ...sesion, proyectoId: capitulo.proyectoId } : noEncontrado("Capítulo no encontrado");
}

/** Igual que requerirProyecto, partiendo de un título. */
export async function requerirTitulo(tituloId: string): Promise<(SesionUsuario & { proyectoId: string }) | NextResponse> {
  const sesion = await sesionActual();
  if (!sesion) return noAutenticado();
  const titulo = await db.titulo.findFirst({
    where: { id: tituloId, proyecto: { empresaId: sesion.empresaId } },
    select: { proyectoId: true },
  });
  return titulo ? { ...sesion, proyectoId: titulo.proyectoId } : noEncontrado("Título no encontrado");
}

/** Igual que requerirProyecto, partiendo de una cotización de proveedor. */
export async function requerirCotizacion(cotizacionId: string): Promise<(SesionUsuario & { proyectoId: string }) | NextResponse> {
  const sesion = await sesionActual();
  if (!sesion) return noAutenticado();
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
