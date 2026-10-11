import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CODIGO_VIGENCIA_MIN, PASSWORD_LARGO_MINIMO } from "@/lib/config-prueba";
import { enviarCodigoVerificacion } from "@/lib/mail";
import {
  emailValido,
  existeUsuarioConEmail,
  generarCodigo,
  hashear,
  ipDelPedido,
  normalizarEmail,
  passwordValida,
  permitirRegistroDesdeIp,
  sumarMinutos,
} from "@/lib/registro";

// Paso 1 del registro público: email + contraseña → código por mail.
// Solo se leen `email`, `password` y el honeypot `sitio`: cualquier otro campo
// del body (rol, empresaId, plan…) se ignora. El User recién se crea en
// /bienvenida (ver VerificacionPendiente).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    // Honeypot: campo oculto que una persona nunca completa. Si viene con
    // valor se responde como si todo hubiera salido bien, sin hacer nada.
    if (typeof body?.sitio === "string" && body.sitio.trim() !== "") {
      return NextResponse.json({ ok: true }, { status: 201 });
    }

    if (!permitirRegistroDesdeIp(ipDelPedido(req))) {
      return NextResponse.json(
        { error: "demasiados_intentos", mensaje: "Hiciste demasiados registros seguidos. Probá de nuevo en una hora." },
        { status: 429 }
      );
    }

    const email = normalizarEmail(body?.email);
    if (!emailValido(email)) {
      return NextResponse.json({ error: "email_invalido", mensaje: "Revisá el email: no parece válido." }, { status: 400 });
    }
    if (!passwordValida(body?.password)) {
      return NextResponse.json(
        { error: "password_invalida", mensaje: `La contraseña tiene que tener entre ${PASSWORD_LARGO_MINIMO} y 72 caracteres.` },
        { status: 400 }
      );
    }
    if (await existeUsuarioConEmail(email)) {
      return NextResponse.json(
        { error: "ya_existe", mensaje: "Ya hay una cuenta con ese email. Entrá con tu contraseña." },
        { status: 409 }
      );
    }

    const codigo = generarCodigo();
    const ahora = new Date();
    const passwordHash = await bcrypt.hash(body.password, 12);
    // Una sola verificación pendiente por email: un registro nuevo reemplaza al anterior.
    const pendiente = await db.$transaction(async (tx) => {
      await tx.verificacionPendiente.deleteMany({ where: { email } });
      return tx.verificacionPendiente.create({
        data: { email, codigo: hashear(codigo), passwordHash, ultimoEnvio: ahora, venceEn: sumarMinutos(ahora, CODIGO_VIGENCIA_MIN) },
        select: { id: true },
      });
    });

    try {
      await enviarCodigoVerificacion(email, codigo);
    } catch (err) {
      console.error("[POST /api/registro] no se pudo enviar el mail", err);
      await db.verificacionPendiente.delete({ where: { id: pendiente.id } }).catch(() => {});
      return NextResponse.json(
        { error: "mail_no_enviado", mensaje: "No pudimos enviarte el código. Probá de nuevo en unos minutos." },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/registro]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
