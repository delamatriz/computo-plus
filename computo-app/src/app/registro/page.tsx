"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { DIAS_PRUEBA, PASSWORD_LARGO_MINIMO } from "@/lib/config-prueba";
import { MarcoRegistro, MensajeError, claseBotonPrimario, claseInput } from "@/components/registro/MarcoRegistro";

// Paso 1 del registro público: email + contraseña. Al enviar llega un código
// por mail y se pasa a /verificar. Nombre y empresa se piden recién en
// /bienvenida.
export default function RegistroPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verPassword, setVerPassword] = useState(false);
  // Honeypot: oculto para personas; un bot que lo complete no se registra.
  const [sitio, setSitio] = useState("");
  const [error, setError] = useState<{ mensaje: string; yaExiste?: boolean } | null>(null);
  const [enviando, setEnviando] = useState(false);

  const emailLimpio = email.trim().toLowerCase();
  const passwordCorta = password.length > 0 && password.length < PASSWORD_LARGO_MINIMO;

  async function registrar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < PASSWORD_LARGO_MINIMO) {
      setError({ mensaje: `La contraseña tiene que tener al menos ${PASSWORD_LARGO_MINIMO} caracteres.` });
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch("/api/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailLimpio, password, sitio }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        router.push(`/verificar?email=${encodeURIComponent(emailLimpio)}`);
        return;
      }
      setError({ mensaje: data?.mensaje ?? "No pudimos crear tu cuenta. Probá de nuevo.", yaExiste: data?.error === "ya_existe" });
    } catch {
      setError({ mensaje: "No pudimos conectarnos. Revisá tu conexión y probá de nuevo." });
    }
    setEnviando(false);
  }

  return (
    <MarcoRegistro
      titulo="Creá tu cuenta"
      subtitulo={`${DIAS_PRUEBA} días gratis, sin tarjeta.`}
      pie={
        <>
          ¿Ya tenés cuenta?{" "}
          <Link href="/login" className="font-semibold text-[#2563EB] hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={registrar} className="space-y-4" noValidate>
        <div>
          <label htmlFor="registro-email" className="block text-xs font-semibold text-[#1A3A5C] mb-1.5">
            Email
          </label>
          <input
            id="registro-email"
            type="email"
            autoComplete="email"
            autoFocus
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={claseInput}
            placeholder="nombre@empresa.com"
          />
        </div>
        <div>
          <label htmlFor="registro-password" className="block text-xs font-semibold text-[#1A3A5C] mb-1.5">
            Contraseña
          </label>
          <div className="relative">
            <input
              id="registro-password"
              type={verPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={PASSWORD_LARGO_MINIMO}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby="registro-password-ayuda"
              className={`${claseInput} pr-10`}
            />
            <button
              type="button"
              onClick={() => setVerPassword((v) => !v)}
              aria-label={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-slate-400 hover:text-slate-600"
            >
              {verPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p id="registro-password-ayuda" className={`text-xs mt-1.5 ${passwordCorta ? "text-amber-600" : "text-slate-400"}`}>
            Mínimo {PASSWORD_LARGO_MINIMO} caracteres.
          </p>
        </div>

        {/* Honeypot: fuera de pantalla, sin foco ni autocompletado. */}
        <div aria-hidden="true" className="absolute -left-[9999px] w-px h-px overflow-hidden">
          <label htmlFor="registro-sitio">Sitio web</label>
          <input id="registro-sitio" type="text" tabIndex={-1} autoComplete="off" value={sitio} onChange={(e) => setSitio(e.target.value)} />
        </div>

        {error && (
          <MensajeError>
            {error.mensaje}
            {error.yaExiste && (
              <>
                {" "}
                <Link href="/login" className="font-semibold underline">
                  Entrar
                </Link>
              </>
            )}
          </MensajeError>
        )}

        <button type="submit" disabled={enviando || !emailLimpio || !password} className={claseBotonPrimario}>
          {enviando && <Loader2 className="w-4 h-4 animate-spin" />}
          {enviando ? "Creando cuenta…" : "Crear cuenta"}
        </button>

        <p className="text-xs text-slate-400 text-center leading-relaxed">
          Al crear tu cuenta aceptás los{" "}
          <Link href="/terminos" className="underline hover:text-slate-600">Términos y condiciones</Link> y la{" "}
          <Link href="/privacidad" className="underline hover:text-slate-600">Política de privacidad</Link>.
        </p>
      </form>
    </MarcoRegistro>
  );
}
