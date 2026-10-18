// Avisos de plataforma a las empresas clientes (ver modelo Aviso en schema.prisma).
// Se crea UN aviso por evento; "no leído" para una empresa es no tener fila en AvisoLeido.

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { estadoEfectivo } from "@/lib/acceso";

export const TIPO_AVISO_PRECIOS = "PRECIOS_ACTUALIZADOS";

/**
 * Avisa a las empresas que el SUPERADMIN actualizó precios del catálogo global. No hace nada si
 * `cantidad` es 0. `proveedor`: nombre del proveedor de una lista comercial (el título lo
 * incluye); sin él es la lista oficial MTOP. Nunca tira: un fallo al avisar no debe romper la
 * importación que ya se guardó.
 */
export async function crearAvisoPreciosActualizados(creadoPorId: string, cantidad: number, proveedor?: string): Promise<void> {
  if (cantidad <= 0) return;
  try {
    await db.aviso.create({
      data: {
        titulo: `Precios actualizados — ${proveedor?.trim() || "Lista MTOP"}`,
        descripcion: `Se actualizaron ${cantidad} materiales en el catálogo. Podés aplicar los nuevos precios a tus proyectos en curso.`,
        tipo: TIPO_AVISO_PRECIOS,
        creadoPorId,
      },
    });
  } catch (err) {
    console.error("[avisos] no se pudo crear el aviso de precios actualizados", err);
  }
}

/**
 * Avisos que la empresa todavía no leyó. Solo los ven las empresas ACTIVA o PRUEBA vigente, y
 * solo los creados después de que la empresa existe (una empresa nueva no hereda el historial).
 */
export async function avisosNoLeidosDeEmpresa(empresaId: string) {
  const empresa = await db.empresa.findUnique({
    where: { id: empresaId },
    select: { estado: true, fechaVencimientoPrueba: true, createdAt: true },
  });
  if (!empresa) return [];
  const estado = estadoEfectivo(empresa);
  if (estado !== "ACTIVA" && estado !== "PRUEBA") return [];
  const where: Prisma.AvisoWhereInput = {
    fechaCreacion: { gte: empresa.createdAt },
    leidos: { none: { empresaId } },
  };
  return db.aviso.findMany({
    where,
    orderBy: { fechaCreacion: "desc" },
    take: 20,
    select: { id: true, titulo: true, descripcion: true, tipo: true, fechaCreacion: true },
  });
}
