import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { WHERE_A_COTIZAR, WHERE_REQUIEREN_VERIFICACION } from "@/lib/pendientesMateriales";
import { sesionActual, esSuperadmin } from "@/lib/sesion";
import { avisosNoLeidosDeEmpresa } from "@/lib/avisos";
import { mesActualUruguay, TIPO_EVENTO_CONSUMO } from "@/lib/consumoIA";

// Datos del panel de la campanita del Header: eventos cargados a mano
// (ver comentario en el modelo EventoSistema) + conteo de materiales
// pendientes de verificación, calculado al vuelo (no se guarda).
//
// El criterio de "requierenVerificacion" vs "aCotizar" replica la misma
// precedencia que ya usa BadgeVerificacion en app/rubros/page.tsx: un
// material con motivoVerificacion "sin_precio_referencia" se cuenta como
// "a cotizar" aunque también tenga requiereVerificacion=true — no se
// duplica entre las dos categorías.
//
// `avisos`: avisos de plataforma (modelo Aviso) que la empresa de la sesión todavía no leyó.
// El SUPERADMIN no los ve (son para los clientes). Se marcan leídos con
// POST /api/notificaciones/marcar-leido al abrir el panel, no acá.
export async function GET() {
  try {
    const sesion = await sesionActual();
    const superadmin = !!sesion && (await esSuperadmin(sesion));
    const avisos = sesion && !superadmin ? await avisosNoLeidosDeEmpresa(sesion.empresaId) : [];
    // Solo el SUPERADMIN: alertas de consumo IA del mes en curso (EventoAdmin
    // que deja el job diario, ver lib/alertasConsumoIA.ts). Ningún cliente
    // las recibe.
    const alertasConsumoIA = superadmin
      ? await db.eventoAdmin.findMany({
          where: { tipo: { in: Object.values(TIPO_EVENTO_CONSUMO) }, createdAt: { gte: mesActualUruguay().desde } },
          orderBy: { createdAt: "desc" },
          select: { id: true, tipo: true, detalle: true, createdAt: true },
        })
      : [];

    const [eventos, requierenVerificacion, aCotizar] = await Promise.all([
      db.eventoSistema.findMany({
        orderBy: { fecha: "desc" },
        take: 10,
      }),
      // Criterio compartido con los filtros de /materiales (lib/pendientesMateriales.ts).
      // Solo el catálogo global: lo que importa un ADMIN no entra en estos contadores.
      db.precioMTOP.count({ where: { ...WHERE_REQUIEREN_VERIFICACION, empresaId: null } }),
      db.precioMTOP.count({ where: { ...WHERE_A_COTIZAR, empresaId: null } }),
    ]);

    const hayNovedades =
      eventos.length > 0 || avisos.length > 0 || alertasConsumoIA.length > 0 || requierenVerificacion > 0 || aCotizar > 0;

    return NextResponse.json({
      eventos,
      avisos,
      alertasConsumoIA,
      pendientes: { requierenVerificacion, aCotizar },
      hayNovedades,
    });
  } catch (err) {
    console.error("[GET /api/notificaciones]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
