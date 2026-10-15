// Eventos internos para el SUPERADMIN (/admin → Eventos del sistema): topes de
// gasto alcanzados, clave de pruebas sin configurar, problemas de facturación.
// No confundir con EventoSistema, que son las notificaciones de la campanita
// que ven todos los usuarios.

import { db } from "@/lib/db";

/** Como máximo un evento igual (tipo + función + empresa) por hora, para no inundar la tabla. */
const VENTANA_DEDUP_MS = 60 * 60 * 1000;

export async function registrarEventoAdmin(
  tipo: string,
  empresaId: string | null,
  funcion?: string | null,
  detalle?: string | null
): Promise<void> {
  try {
    // null se compara como null (no se omite el filtro): un evento sin empresa
    // no deduplica uno de una empresa, ni el de una empresa el de otra.
    const existente = await db.eventoAdmin.findFirst({
      where: {
        tipo,
        empresaId: empresaId ?? null,
        funcion: funcion ?? null,
        createdAt: { gte: new Date(Date.now() - VENTANA_DEDUP_MS) },
      },
      select: { id: true },
    });
    if (existente) return;
    await db.eventoAdmin.create({ data: { tipo, empresaId, funcion: funcion ?? null, detalle: detalle ?? null } });
  } catch (err) {
    // Registrar el evento nunca tiene que romper la respuesta al usuario.
    console.error("[registrarEventoAdmin]", tipo, err);
  }
}
