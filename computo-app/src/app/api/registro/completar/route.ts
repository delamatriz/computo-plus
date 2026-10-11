import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CUPO_CALCULOS_RAPIDOS, CUPO_PROYECTOS_ASISTIDOS, DIAS_PRUEBA, INGRESO_VIGENCIA_MIN } from "@/lib/config-prueba";
import { COOKIE_BIENVENIDA, generarSlugEmpresa, generarToken, hashear, sanitizarOrigen, sumarMinutos } from "@/lib/registro";

const LARGO_MAXIMO = { nombre: 80, empresa: 120, rut: 20 };
const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");

// Verificación pendiente a la que apunta la cookie de /bienvenida (puesta por
// POST /api/registro/verificar): verificada, sin usuario creado y sin vencer.
async function pendienteDeLaCookie(req: NextRequest) {
  const token = req.cookies.get(COOKIE_BIENVENIDA)?.value;
  if (!token) return null;
  return db.verificacionPendiente.findFirst({
    where: { token: hashear(token), verificadoEn: { not: null }, userId: null, tokenVenceEn: { gt: new Date() } },
  });
}

const sinAutorizacion = () =>
  NextResponse.json(
    { error: "sin_verificacion", mensaje: "Tu verificación venció o ya se usó. Empezá el registro de nuevo." },
    { status: 401 }
  );

/** Email de la verificación en curso (para mostrarlo en /bienvenida). */
export async function GET(req: NextRequest) {
  try {
    const pendiente = await pendienteDeLaCookie(req);
    if (!pendiente) return sinAutorizacion();
    return NextResponse.json({ email: pendiente.email });
  } catch (err) {
    console.error("[GET /api/registro/completar]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// Paso 3 del registro público: crea la Empresa (en PRUEBA) y el User (ADMIN,
// email verificado) y devuelve un token de ingreso de un solo uso para iniciar
// sesión sin volver a pedir la contraseña (provider "registro" en auth.ts).
// Del body solo se leen nombre, empresa, rut y origen: rol, plan, estado,
// cupos, etc. los fija el servidor.
export async function POST(req: NextRequest) {
  try {
    const pendiente = await pendienteDeLaCookie(req);
    if (!pendiente) return sinAutorizacion();

    const body = await req.json().catch(() => null);
    const nombre = texto(body?.nombre, LARGO_MAXIMO.nombre);
    const nombreEmpresa = texto(body?.empresa, LARGO_MAXIMO.empresa);
    const rut = texto(body?.rut, LARGO_MAXIMO.rut);
    const origen = sanitizarOrigen(body?.origen);
    if (!nombre) return NextResponse.json({ error: "falta_nombre", mensaje: "Contanos tu nombre." }, { status: 400 });
    if (!nombreEmpresa) {
      return NextResponse.json({ error: "falta_empresa", mensaje: "Falta el nombre de la empresa o estudio." }, { status: 400 });
    }

    // Empresa.rut es obligatorio y único: sin RUT queda un valor provisorio
    // único, igual que en el alta desde /admin.
    const slug = await generarSlugEmpresa(nombreEmpresa);
    const rutFinal = rut || `PENDIENTE-${slug}`;
    if (await db.empresa.findUnique({ where: { rut: rutFinal }, select: { id: true } })) {
      return NextResponse.json(
        { error: "rut_existente", mensaje: "Ya hay una empresa registrada con ese RUT. Si es la tuya, escribinos por WhatsApp." },
        { status: 409 }
      );
    }

    const ahora = new Date();
    const tokenIngreso = generarToken();
    try {
      await db.$transaction(async (tx) => {
        const empresa = await tx.empresa.create({
          data: {
            nombre: nombreEmpresa,
            rut: rutFinal,
            slug,
            plan: "basico",
            estado: "PRUEBA",
            fechaVencimientoPrueba: new Date(ahora.getTime() + DIAS_PRUEBA * 24 * 60 * 60_000),
            origen,
            cupoCalculosRapidos: CUPO_CALCULOS_RAPIDOS,
            cupoProyectosIA: CUPO_PROYECTOS_ASISTIDOS,
          },
          select: { id: true },
        });
        const user = await tx.user.create({
          data: {
            email: pendiente.email,
            passwordHash: pendiente.passwordHash,
            nombre,
            rol: "ADMIN",
            empresaId: empresa.id,
            emailVerificado: true,
          },
          select: { id: true },
        });
        // El token de /bienvenida se reemplaza por el de ingreso (un solo uso).
        const marcado = await tx.verificacionPendiente.updateMany({
          where: { id: pendiente.id, userId: null },
          data: { userId: user.id, token: hashear(tokenIngreso), tokenVenceEn: sumarMinutos(ahora, INGRESO_VIGENCIA_MIN) },
        });
        if (marcado.count === 0) throw new Error("verificacion_ya_usada");
      });
    } catch (err) {
      // Doble envío del formulario, o el email/slug/RUT se ocupó entre medio.
      const codigo = (err as { code?: string })?.code;
      if (codigo === "P2002" || (err as Error)?.message === "verificacion_ya_usada") {
        return NextResponse.json(
          { error: "conflicto", mensaje: "Esa cuenta ya se creó. Entrá con tu email y contraseña." },
          { status: 409 }
        );
      }
      throw err;
    }

    const res = NextResponse.json({ tokenIngreso }, { status: 201 });
    res.cookies.delete(COOKIE_BIENVENIDA);
    return res;
  } catch (err) {
    console.error("[POST /api/registro/completar]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
