/**
 * Helper lazy para ConfiguracionEmpresa.
 *
 * Devuelve la configuración de la empresa, creándola con los defaults si
 * todavía no existe. Idempotente y seguro en concurrencia (P2002 → re-read).
 */
import { db } from "@/lib/db";
import type { ConfiguracionEmpresa } from "@/generated/prisma/client";

export type { ConfiguracionEmpresa };

export async function obtenerConfigEmpresa(empresaId: string): Promise<ConfiguracionEmpresa> {
  const existente = await db.configuracionEmpresa.findUnique({
    where: { empresaId },
  });
  if (existente) return existente;

  try {
    return await db.configuracionEmpresa.create({
      data: { empresaId },
    });
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      const creado = await db.configuracionEmpresa.findUnique({
        where: { empresaId },
      });
      if (creado) return creado;
    }
    throw err;
  }
}
