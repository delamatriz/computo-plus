import type { PrismaClient } from "@/generated/prisma/client";

// Listas de precios importadas (ImportacionPrecios) — sección "Listas
// importadas" de /materiales. Cada importación agrupa los materiales que
// CREÓ (PrecioMTOP.importacionId); los que solo actualizó siguen en la
// importación que los creó. Los materiales cargados antes de existir este
// modelo no tienen importación y no aparecen acá.
//
// Recibe el cliente de Prisma por parámetro para poder probarlo desde un
// script con su propio cliente.

export interface ImportacionListada {
  id: string;
  fecha: string;
  proveedor: string | null;
  descripcion: string | null;
  creadoPor: string | null;
  materiales: number;
  /** Cuántos de esos materiales usa algún APU (no se borrarían al eliminar la lista). */
  enUso: number;
  /** Lista Oficial MTOP (proveedor null): no se puede eliminar desde la pantalla. */
  esOficial: boolean;
}

/** Importaciones de un dueño: null = catálogo global (Administrador), o una empresa. Más reciente primero. */
export async function listarImportaciones(db: PrismaClient, empresaId: string | null): Promise<ImportacionListada[]> {
  const filas = await db.importacionPrecios.findMany({
    where: { empresaId },
    orderBy: { fecha: "desc" },
    select: {
      id: true,
      fecha: true,
      proveedor: true,
      descripcion: true,
      creadoPor: { select: { nombre: true } },
      _count: { select: { materiales: true } },
    },
  });
  const materiales = await db.precioMTOP.findMany({
    where: { importacionId: { in: filas.map((f) => f.id) } },
    select: { id: true, importacionId: true },
  });
  const usados = await idsEnUso(db, materiales.map((m) => m.id));
  const enUsoPorLista = new Map<string, number>();
  for (const m of materiales) {
    if (m.importacionId && usados.has(m.id)) enUsoPorLista.set(m.importacionId, (enUsoPorLista.get(m.importacionId) ?? 0) + 1);
  }
  return filas.map((f) => ({
    id: f.id,
    fecha: f.fecha.toISOString(),
    proveedor: f.proveedor,
    descripcion: f.descripcion,
    creadoPor: f.creadoPor?.nombre ?? null,
    materiales: f._count.materiales,
    enUso: enUsoPorLista.get(f.id) ?? 0,
    esOficial: f.proveedor === null,
  }));
}

export interface ResultadoEliminacion {
  /** Materiales que se borran (o se borrarían, al simular). */
  borrados: number;
  /** Materiales que quedan porque los usa algún APU (presupuestos o Mis rubros). */
  protegidos: number;
  /** true si la importación quedó sin materiales y se borró su registro. */
  listaEliminada: boolean;
}

// "En uso" = lo referencia un material de APU de un presupuesto
// (MaterialAPU.precioMTOPId) o de Mis rubros (MaterialAPUEmpresa.precioMTOPId,
// id guardado sin FK). El Catálogo de Rubros encuentra precios por
// descripción, no por id: eso no se puede detectar acá.
async function idsEnUso(db: Pick<PrismaClient, "materialAPU" | "materialAPUEmpresa">, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const [enPresupuestos, enMisRubros] = await Promise.all([
    db.materialAPU.findMany({ where: { precioMTOPId: { in: ids } }, select: { precioMTOPId: true }, distinct: ["precioMTOPId"] }),
    db.materialAPUEmpresa.findMany({ where: { precioMTOPId: { in: ids } }, select: { precioMTOPId: true }, distinct: ["precioMTOPId"] }),
  ]);
  return new Set([...enPresupuestos, ...enMisRubros].map((m) => m.precioMTOPId).filter((id): id is string => !!id));
}

/**
 * Elimina los materiales de una importación que no usa ningún APU; los que
 * están en uso quedan (protegidos) y la importación sigue listada con ellos.
 * Si no queda ninguno, se borra también el registro de la importación.
 * Con `simular` solo cuenta, sin escribir. No valida permisos ni que sea la
 * Lista MTOP: eso lo hace la ruta.
 */
export async function eliminarImportacion(
  db: PrismaClient,
  importacionId: string,
  { simular = false }: { simular?: boolean } = {}
): Promise<ResultadoEliminacion> {
  return db.$transaction(async (tx) => {
    const materiales = await tx.precioMTOP.findMany({ where: { importacionId }, select: { id: true } });
    const ids = materiales.map((m) => m.id);
    const enUso = await idsEnUso(tx, ids);
    const aBorrar = ids.filter((id) => !enUso.has(id));

    if (simular) return { borrados: aBorrar.length, protegidos: enUso.size, listaEliminada: enUso.size === 0 };

    const { count } = aBorrar.length
      ? await tx.precioMTOP.deleteMany({ where: { id: { in: aBorrar }, importacionId } })
      : { count: 0 };
    const quedan = await tx.precioMTOP.count({ where: { importacionId } });
    if (quedan === 0) await tx.importacionPrecios.delete({ where: { id: importacionId } });
    return { borrados: count, protegidos: quedan, listaEliminada: quedan === 0 };
  });
}
