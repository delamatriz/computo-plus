import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { estadoVerificacion, normalizarEmail } from "@/lib/registro";

// Estado de la verificación pendiente de un email, para la pantalla
// /verificar (intentos, reenvíos, espera para reenviar). Sin datos sensibles:
// nunca devuelve el código ni la contraseña.
export async function GET(req: NextRequest) {
  try {
    const email = normalizarEmail(req.nextUrl.searchParams.get("email"));
    const pendiente = email
      ? await db.verificacionPendiente.findFirst({
          where: { email, verificadoEn: null },
          select: { intentos: true, reenvios: true, ultimoEnvio: true, venceEn: true },
        })
      : null;
    if (!pendiente) return NextResponse.json({ existe: false });
    return NextResponse.json({ existe: true, ...estadoVerificacion(pendiente) });
  } catch (err) {
    console.error("[GET /api/registro/estado]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
