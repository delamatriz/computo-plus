import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { BIENVENIDA_VIGENCIA_MIN, CODIGO_DIGITOS, CODIGO_MAX_INTENTOS } from "@/lib/config-prueba";
import {
  COOKIE_BIENVENIDA,
  coincideHash,
  estadoVerificacion,
  generarToken,
  hashear,
  normalizarEmail,
  sumarMinutos,
} from "@/lib/registro";

// Paso 2 del registro público: el código de 6 dígitos. Al acertar, marca la
// verificación y deja una cookie httpOnly con un token de un solo uso que
// autoriza completar /bienvenida (POST /api/registro/completar).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const email = normalizarEmail(body?.email);
    const codigo = typeof body?.codigo === "string" ? body.codigo.trim() : "";

    const pendiente = email
      ? await db.verificacionPendiente.findFirst({ where: { email, verificadoEn: null } })
      : null;
    if (!pendiente) {
      return NextResponse.json(
        { error: "sin_registro", mensaje: "No encontramos un registro en curso para ese email. Empezá de nuevo." },
        { status: 404 }
      );
    }
    const estado = estadoVerificacion(pendiente);
    if (estado.bloqueado) {
      return NextResponse.json(
        { error: "bloqueado", mensaje: "Agotaste los intentos para este código.", ...estado },
        { status: 429 }
      );
    }
    if (estado.vencido) {
      return NextResponse.json({ error: "vencido", mensaje: "El código venció. Pedí uno nuevo.", ...estado }, { status: 410 });
    }
    if (!new RegExp(`^\\d{${CODIGO_DIGITOS}}$`).test(codigo)) {
      return NextResponse.json({ error: "codigo_invalido", mensaje: `El código tiene ${CODIGO_DIGITOS} números.`, ...estado }, { status: 400 });
    }

    // El intento se cuenta ANTES de comparar, condicionado a que no se haya
    // pasado del máximo: dos pedidos simultáneos no suman intentos de más.
    const contado = await db.verificacionPendiente.updateMany({
      where: { id: pendiente.id, intentos: { lt: CODIGO_MAX_INTENTOS }, verificadoEn: null },
      data: { intentos: { increment: 1 } },
    });
    if (contado.count === 0) {
      return NextResponse.json({ error: "bloqueado", mensaje: "Agotaste los intentos para este código.", ...estado }, { status: 429 });
    }
    const despues = estadoVerificacion({ ...pendiente, intentos: pendiente.intentos + 1 });

    if (!coincideHash(codigo, pendiente.codigo)) {
      if (despues.bloqueado) {
        return NextResponse.json({ error: "bloqueado", mensaje: "Agotaste los intentos para este código.", ...despues }, { status: 429 });
      }
      const n = despues.intentosRestantes;
      return NextResponse.json(
        { error: "codigo_incorrecto", mensaje: `Código incorrecto. Te ${n === 1 ? "queda 1 intento" : `quedan ${n} intentos`}.`, ...despues },
        { status: 400 }
      );
    }

    const token = generarToken();
    const ahora = new Date();
    await db.verificacionPendiente.update({
      where: { id: pendiente.id },
      data: { verificadoEn: ahora, token: hashear(token), tokenVenceEn: sumarMinutos(ahora, BIENVENIDA_VIGENCIA_MIN) },
    });

    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_BIENVENIDA, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: BIENVENIDA_VIGENCIA_MIN * 60,
    });
    return res;
  } catch (err) {
    console.error("[POST /api/registro/verificar]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
