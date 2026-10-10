// Protección de rutas (Multi-tenant Fase 2, oct-2026). En Next 16 la
// convención `middleware` pasó a llamarse `proxy` (corre en Node.js).
//
// Toda la app pide sesión, salvo la landing ("/", que tiene el modal de
// login), /login (fallback) y /api/auth/* (NextAuth). Sin sesión:
//   - páginas → redirige a /login?callbackUrl=<la página pedida>
//   - /api/*  → 401 JSON (un fetch no puede seguir un redirect a una página
//     de login; con el 401 el cliente sabe qué pasó)
// Los archivos estáticos (/_next, /public) quedan afuera por el matcher.

import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PUBLICAS = ["/", "/login"];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (PUBLICAS.includes(pathname) || pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (token) return NextResponse.next();

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
