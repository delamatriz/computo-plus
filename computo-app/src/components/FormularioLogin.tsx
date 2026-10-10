"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";

// Formulario de login por credenciales (NextAuth). Lo usan el modal de la
// landing (flujo principal) y la página /login (fallback, adonde redirige el
// proxy cuando se entra a una página sin sesión).
export function FormularioLogin({ destino }: { destino: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const res = await signIn("credentials", { email, password, redirect: false });
      if (!res || res.error) {
        setError("Email o contraseña incorrectos");
        setEnviando(false);
        return;
      }
      // Queda "Entrando…" hasta que la navegación cambia de página.
      router.replace(destino);
      router.refresh();
    } catch {
      setError("Email o contraseña incorrectos");
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={entrar} className="space-y-4" noValidate>
      <div>
        <label htmlFor="login-email" className="block text-xs font-semibold text-[#1A3A5C] mb-1.5">
          Email
        </label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-[#1E293B] placeholder:text-slate-400 focus:outline-none focus:border-[#4A7FA8] focus:ring-2 focus:ring-[#4A7FA8]/20 transition"
          placeholder="nombre@empresa.com"
        />
      </div>
      <div>
        <label htmlFor="login-password" className="block text-xs font-semibold text-[#1A3A5C] mb-1.5">
          Contraseña
        </label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-[#1E293B] focus:outline-none focus:border-[#4A7FA8] focus:ring-2 focus:ring-[#4A7FA8]/20 transition"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando || !email || !password}
        className="w-full h-10 rounded-lg bg-[#1A3A5C] hover:bg-[#4A7FA8] text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {enviando && <Loader2 className="w-4 h-4 animate-spin" />}
        {enviando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
