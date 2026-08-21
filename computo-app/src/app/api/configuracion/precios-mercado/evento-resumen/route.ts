import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Evento B — la corrida de "Buscar precios actualizados" vive entera del
// lado del cliente (tandas disparadas desde el navegador, ver
// SeccionActualizacionDatos.tsx), así que no hay ningún punto del servidor
// que sepa cuándo termina toda la corrida. El cliente llama acá al final
// (se vació la cola sola, o se apretó "Detener") con el resumen que ya
// tiene calculado — no se recalcula nada acá, se confía en el conteo que
// ya se le mostró al usuario en pantalla.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { actualizados, pendientesRevision, restantes } = body ?? {};

    if (
      typeof actualizados !== "number" ||
      typeof pendientesRevision !== "number" ||
      typeof restantes !== "number"
    ) {
      return NextResponse.json({ error: "Faltan actualizados/pendientesRevision/restantes (number)" }, { status: 400 });
    }

    const totalProcesados = actualizados + pendientesRevision;
    const completada = restantes === 0;

    const evento = await db.eventoSistema.create({
      data: completada
        ? {
            titulo: "Verificación de precios de materiales completada",
            descripcion: `${totalProcesados} materiales verificados: ${actualizados} actualizados automático, ${pendientesRevision} quedaron pendientes de revisión.`,
          }
        : {
            titulo: "Verificación de precios de materiales interrumpida",
            descripcion: `Se detuvo después de procesar ${totalProcesados} materiales: ${actualizados} actualizados automático, ${pendientesRevision} quedaron pendientes de revisión. Quedan ${restantes} sin procesar.`,
          },
    });

    return NextResponse.json(evento);
  } catch (err) {
    console.error("[POST /api/configuracion/precios-mercado/evento-resumen]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
