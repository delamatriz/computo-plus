"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";

// Solo rutas internas ("/proyectos/..."): nunca redirigir a otro dominio que
// venga en ?callbackUrl= (ni "//otro.com", que el navegador toma como externo).
function destinoSeguro(callbackUrl: string | null): string {
  if (!callbackUrl) return "/";
  try {
    const url = new URL(callbackUrl, window.location.origin);
    if (url.origin !== window.location.origin) return "/";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/";
  }
}

function FormularioLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
        return;
      }
      router.replace(destinoSeguro(searchParams.get("callbackUrl")));
      router.refresh();
    } catch {
      setError("Email o contraseña incorrectos");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={entrar} className="space-y-4" noValidate>
      <div>
        <label htmlFor="email" className="block text-xs font-semibold text-[#1A3A5C] mb-1.5">
          Email
        </label>
        <input
          id="email"
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
        <label htmlFor="password" className="block text-xs font-semibold text-[#1A3A5C] mb-1.5">
          Contraseña
        </label>
        <input
          id="password"
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
        Entrar
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-full bg-[#F0F4F8] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-[#1A3A5C]">CÓMPUTO+</h1>
          <p className="text-sm text-[#4A7FA8] mt-1">Presupuestación de Obra Premium</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-7">
          <h2 className="text-base font-semibold text-[#1E293B] mb-5">Ingresá a tu cuenta</h2>
          <Suspense fallback={null}>
            <FormularioLogin />
          </Suspense>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">Presupuestación de Obra Premium · Uruguay</p>
      </div>
    </div>
  );
}
