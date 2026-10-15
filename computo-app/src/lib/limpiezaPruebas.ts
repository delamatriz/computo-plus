// Limpieza automática de pruebas abandonadas (oct-2026): empresas cuya prueba
// venció hace más de DIAS_GRACIA días y que nunca crearon un proyecto. La
// corre un Cron Job de Render una vez por semana contra
// POST /api/admin/limpiar-pruebas-vencidas.
//
// "Vencida" es el estado efectivo (ver lib/acceso.ts): el paso PRUEBA →
// VENCIDA se guarda recién cuando la empresa vuelve a entrar, así que una
// prueba abandonada puede seguir figurando como PRUEBA en la base. Por eso el
// filtro es por fecha, sobre PRUEBA y VENCIDA. Nunca toca ACTIVA ni
// DESACTIVADA, ni una empresa que tenga aunque sea un proyecto.

import { db } from "@/lib/db";
import { registrarEventoAdmin } from "@/lib/eventos-admin";

/** Días después del vencimiento antes de borrar una prueba sin proyectos. */
export const DIAS_GRACIA_LIMPIEZA = 30;

export async function limpiarPruebasVencidas({ simular = false } = {}): Promise<{ eliminadas: number; empresas: string[] }> {
  const limite = new Date(Date.now() - DIAS_GRACIA_LIMPIEZA * 24 * 60 * 60_000);
  const candidatas = await db.empresa.findMany({
    where: {
      estado: { in: ["PRUEBA", "VENCIDA"] },
      fechaVencimientoPrueba: { lt: limite },
      proyectos: { none: {} },
    },
    select: { id: true, nombre: true },
    orderBy: { fechaVencimientoPrueba: "asc" },
  });
  const nombres = candidatas.map((e) => e.nombre);
  if (simular || candidatas.length === 0) return { eliminadas: 0, empresas: nombres };

  // Mismo filtro en el borrado: si entre la lectura y acá alguna creó un
  // proyecto o pasó a ACTIVA, no se borra.
  const { count } = await db.empresa.deleteMany({
    where: {
      id: { in: candidatas.map((e) => e.id) },
      estado: { in: ["PRUEBA", "VENCIDA"] },
      fechaVencimientoPrueba: { lt: limite },
      proyectos: { none: {} },
    },
  });
  await registrarEventoAdmin(
    "LIMPIEZA_AUTOMATICA",
    null,
    "limpiar-pruebas-vencidas",
    `${count} empresa${count === 1 ? "" : "s"} eliminada${count === 1 ? "" : "s"} (prueba vencida hace más de ${DIAS_GRACIA_LIMPIEZA} días, sin proyectos): ${nombres.join(", ")}`
  );
  return { eliminadas: count, empresas: nombres };
}
