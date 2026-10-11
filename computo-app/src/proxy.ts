// Protección de rutas (Multi-tenant Fase 2, oct-2026). En Next 16 la
// convención `middleware` pasó a llamarse `proxy` (corre en Node.js).
//
// Toda la app pide sesión, salvo la landing ("/", que tiene el modal de
// login), /login (fallback), /api/auth/* (NextAuth) y el registro público
// (/registro → /verificar → /bienvenida, sus APIs /api/registro/* y las
// páginas legales). Sin sesión:
//   - páginas → redirige a /login?callbackUrl=<la página pedida>
//   - /api/*  → 401 JSON (un fetch no puede seguir un redirect a una página
//     de login; con el 401 el cliente sabe qué pasó)
// Los archivos estáticos (/_next, /public) quedan afuera por el matcher.
//
// Prueba vencida (oct-2026): con sesión, todo pedido que escribe
// (POST/PUT/PATCH/DELETE) a /api/* de una empresa VENCIDA → 403
// PRUEBA_VENCIDA. Lectura y exportación (los PDF son GET) siguen andando.
// Acá y no en cada ruta: cubre las ~100 rutas que escriben sin tocarlas.

import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { estadoAccesoUsuario, respuestaAcceso } from "@/lib/acceso";

const PUBLICAS = ["/", "/login", "/registro", "/verificar", "/bienvenida", "/terminos", "/privacidad"];
const PREFIJOS_PUBLICOS = ["/api/auth/", "/api/registro"];
const METODOS_DE_ESCRITURA = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (PUBLICAS.includes(pathname) || PREFIJOS_PUBLICOS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (token) {
    if (pathname.startsWith("/api/") && METODOS_DE_ESCRITURA.has(request.method)) {
      const acceso = await estadoAccesoUsuario(token.id);
      if (acceso?.estado === "VENCIDA") return respuestaAcceso("PRUEBA_VENCIDA", token.email);
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const login = new URL("/login", request.url);
  login.searchParams.set("callbackUrl", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  // Todo menos los internos de Next y los archivos con extensión (imágenes,
  // fuentes, cmaps de pdf.js, favicon).
  matcher: ["/((?!_next/static|_next/image|.*\\.[^/]+$).*)"],
};
