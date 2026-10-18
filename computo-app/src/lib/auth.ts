// Configuración de NextAuth (Multi-tenant Fase 2, oct-2026): login por
// credenciales (email + contraseña) contra la tabla User, sesión en JWT (sin
// tablas de sesión en la base por ahora). El token lleva id, email, nombre,
// rol y empresaId — empresaId es el tenant de todo lo que haga el usuario.
//
// Segundo provider, "registro" (registro público, oct-2026): al terminar
// /bienvenida el navegador ya no tiene la contraseña, así que entra con el
// token de ingreso de un solo uso que devuelve POST /api/registro/completar.

import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { estadoAccesoUsuario } from "@/lib/acceso";
import { hashear } from "@/lib/registro";
import { esRol, type Rol } from "@/lib/roles";

declare module "next-auth" {
  interface User {
    id: string;
    email: string;
    nombre: string;
    rol: Rol;
    empresaId: string;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      nombre: string;
      rol: Rol;
      empresaId: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    email: string;
    nombre: string;
    rol: Rol;
    empresaId: string;
  }
}

// Sin acceso → el error llega a signIn() como `error` (FormularioLogin lo
// traduce). Una empresa VENCIDA sí inicia sesión, pero el proxy la manda a /planes.
async function exigirAcceso(userId: string): Promise<void> {
  const acceso = await estadoAccesoUsuario(userId);
  if (acceso && !acceso.emailVerificado) throw new Error("EMAIL_NO_VERIFICADO");
  if (acceso?.estado === "DESACTIVADA") throw new Error("EMPRESA_DESACTIVADA");
}

function usuarioDeSesion(user: { id: string; email: string; nombre: string; rol: string; empresaId: string }) {
  // Un rol desconocido en la base (no debería pasar) entra con el mínimo.
  const rol: Rol = esRol(user.rol) ? user.rol : "USUARIO";
  return { id: user.id, email: user.email, nombre: user.nombre, rol, empresaId: user.empresaId };
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Email y contraseña",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;
        if (!email || !password) return null;

        const user = await db.user.findUnique({ where: { email } });
        if (!user) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        await exigirAcceso(user.id);
        return usuarioDeSesion(user);
      },
    }),
    CredentialsProvider({
      id: "registro",
      name: "Ingreso tras el registro",
      credentials: { token: { label: "Token", type: "text" } },
      async authorize(credentials) {
        const token = credentials?.token;
        if (!token) return null;
        // Un solo uso: se borra la verificación al consumirla. Si dos pedidos
        // llegan juntos, deleteMany solo le da count 1 a uno de los dos.
        const pendiente = await db.verificacionPendiente.findFirst({
          where: { token: hashear(token), userId: { not: null }, tokenVenceEn: { gt: new Date() } },
          select: { id: true, userId: true },
        });
        if (!pendiente?.userId) return null;
        const consumido = await db.verificacionPendiente.deleteMany({ where: { id: pendiente.id } });
        if (consumido.count === 0) return null;
        const user = await db.user.findUnique({ where: { id: pendiente.userId } });
        return user ? usuarioDeSesion(user) : null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // `user` solo viene en el login; después el token ya tiene los datos.
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.nombre = user.nombre;
        token.rol = user.rol;
        token.empresaId = user.empresaId;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = { id: token.id, email: token.email, nombre: token.nombre, rol: token.rol, empresaId: token.empresaId };
      return session;
    },
  },
};
