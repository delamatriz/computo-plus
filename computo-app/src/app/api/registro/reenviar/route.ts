import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CODIGO_VIGENCIA_MIN, REENVIO_ESPERA_SEG } from "@/lib/config-prueba";
import { enviarCodigoVerificacion } from "@/lib/mail";
import { estadoVerificacion, generarCodigo, hashear, normalizarEmail, sumarMinutos } from "@/lib/registro";

// Reenvía un código NUEVO (el anterior deja de valer): recién a los
// REENVIO_ESPERA_SEG del último envío y hasta REENVIO_MAXIMO veces (ver
// config-prueba.ts). El código nuevo trae sus propios intentos y vencimiento.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const email = normalizarEmail(body?.email);
    const pendiente = email ? await db.verificacionPendiente.findFirst({ where: { email, verificadoEn: null } }) : null;
    if (!pendiente) {
      return NextResponse.json(
        { error: "sin_registro", mensaje: "No encontramos un registro en curso para ese email. Empezá de nuevo." },
        { status: 404 }
      );
    }
    const estado = estadoVerificacion(pendiente);
    if (estado.reenviosRestantes === 0) {
      return NextResponse.json(
        { error: "sin_reenvios", mensaje: "Ya no quedan reenvíos para este registro. Escribinos por WhatsApp.", ...estado },
        { status: 429 }
      );
    }
    if (estado.segundosParaReenvio > 0) {
      return NextResponse.json(
        { error: "espera", mensaje: `Podés pedir otro código en ${estado.segundosParaReenvio} segundos.`, ...estado },
        { status: 429 }
      );
    }

    const codigo = generarCodigo();
    const ahora = new Date();
    // Condicionado al estado leído: dos clics simultáneos no reenvían dos veces.
    const actualizado = await db.verificacionPendiente.updateMany({
      where: {
        id: pendiente.id,
        reenvios: pendiente.reenvios,
        ultimoEnvio: { lte: new Date(ahora.getTime() - REENVIO_ESPERA_SEG * 1000) },
        verificadoEn: null,
      },
      data: {
        codigo: hashear(codigo),
        intentos: 0,
        reenvios: { increment: 1 },
        ultimoEnvio: ahora,
        venceEn: sumarMinutos(ahora, CODIGO_VIGENCIA_MIN),
      },
    });
    if (actualizado.count === 0) {
      return NextResponse.json({ error: "espera", mensaje: "Ya te mandamos un código nuevo.", ...estado }, { status: 429 });
    }

    try {
      await enviarCodigoVerificacion(email, codigo);
    } catch (err) {
      console.error("[POST /api/registro/reenviar] no se pudo enviar el mail", err);
      return NextResponse.json(
        { error: "mail_no_enviado", mensaje: "No pudimos enviarte el código. Escribinos por WhatsApp." },
        { status: 502 }
      );
    }

    const despues = estadoVerificacion({ intentos: 0, reenvios: pendiente.reenvios + 1, ultimoEnvio: ahora, venceEn: sumarMinutos(ahora, CODIGO_VIGENCIA_MIN) });
    return NextResponse.json({ ok: true, ...despues });
  } catch (err) {
    console.error("[POST /api/registro/reenviar]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
