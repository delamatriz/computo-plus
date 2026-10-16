import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { WHERE_A_COTIZAR, WHERE_REQUIEREN_VERIFICACION } from "@/lib/pendientesMateriales";

// Datos del panel de la campanita del Header: eventos cargados a mano
// (ver comentario en el modelo EventoSistema) + conteo de materiales
// pendientes de verificación, calculado al vuelo (no se guarda).
//
// El criterio de "requierenVerificacion" vs "aCotizar" replica la misma
// precedencia que ya usa BadgeVerificacion en app/rubros/page.tsx: un
// material con motivoVerificacion "sin_precio_referencia" se cuenta como
// "a cotizar" aunque también tenga requiereVerificacion=true — no se
// duplica entre las dos categorías.
export async function GET() {
  try {
    const [eventos, requierenVerificacion, aCotizar] = await Promise.all([
      db.eventoSistema.findMany({
        orderBy: { fecha: "desc" },
        take: 10,
      }),
      // Criterio compartido con los filtros de /materiales (lib/pendientesMateriales.ts).
      db.precioMTOP.count({ where: WHERE_REQUIEREN_VERIFICACION }),
      db.precioMTOP.count({ where: WHERE_A_COTIZAR }),
    ]);

    const hayNovedades = eventos.length > 0 || requierenVerificacion > 0 || aCotizar > 0;

    return NextResponse.json({
      eventos,
      pendientes: { requierenVerificacion, aCotizar },
      hayNovedades,
    });
  } catch (err) {
    console.error("[GET /api/notificaciones]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
