import { NextResponse } from "next/server";
import { db } from "@/lib/db";

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
      db.precioMTOP.count({
        where: {
          requiereVerificacion: true,
          motivoVerificacion: { not: "sin_precio_referencia" },
        },
      }),
      db.precioMTOP.count({
        where: { motivoVerificacion: "sin_precio_referencia" },
      }),
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
