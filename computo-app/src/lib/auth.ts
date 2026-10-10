// Configuración de NextAuth (Multi-tenant Fase 2, oct-2026): login por
// credenciales (email + contraseña) contra la tabla User, sesión en JWT (sin
// tablas de sesión en la base por ahora). El token lleva id, email, nombre,
// rol y empresaId — empresaId es el tenant de todo lo que haga el usuario.

import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

declare module "next-auth" {
  interface User {
    id: string;
    email: string;
    nombre: string;
    rol: string;
    empresaId: string;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      nombre: string;
      rol: string;
      empresaId: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    email: string;
    nombre: string;
    rol: string;
    empresaId: string;
  }
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

        return { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol, empresaId: user.empresaId };
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
