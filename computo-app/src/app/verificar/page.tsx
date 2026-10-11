"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, MessageCircle } from "lucide-react";
import { CODIGO_DIGITOS, CODIGO_VIGENCIA_MIN, whatsappCodigoNoLlego } from "@/lib/config-prueba";
import { MarcoRegistro, MensajeError, claseBotonPrimario } from "@/components/registro/MarcoRegistro";

interface Estado {
  intentosRestantes: number;
  reenviosRestantes: number;
  segundosParaReenvio: number;
  bloqueado: boolean;
  vencido: boolean;
}

const vacio = () => Array.from({ length: CODIGO_DIGITOS }, () => "");

function fmtEspera(seg: number) {
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function Verificar() {
  const router = useRouter();
  const email = (useSearchParams().get("email") ?? "").trim().toLowerCase();

  const [digitos, setDigitos] = useState<string[]>(vacio);
  const [estado, setEstado] = useState<Estado | null>(null);
  // null = cargando; false = no hay registro en curso para este email.
  const [existe, setExiste] = useState<boolean | null>(null);
  const [espera, setEspera] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const casilleros = useRef<(HTMLInputElement | null)[]>([]);

  const aplicarEstado = useCallback((e: Estado) => {
    setEstado(e);
    setEspera(e.segundosParaReenvio);
  }, []);

  useEffect(() => {
    if (!email) {
      setExiste(false);
      return;
    }
    fetch(`/api/registro/estado?email=${encodeURIComponent(email)}`)
      .then((r) => r.json())
      .then((data) => {
        setExiste(!!data?.existe);
        if (data?.existe) aplicarEstado(data);
      })
      .catch(() => setExiste(true)); // sin red: se deja intentar igual
  }, [email, aplicarEstado]);

  // Cuenta regresiva del reenvío, de a un segundo hasta llegar a 0.
  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  const enfocar = (i: number) => casilleros.current[Math.max(0, Math.min(CODIGO_DIGITOS - 1, i))]?.focus();

  const verificar = useCallback(
    async (codigo: string) => {
      setError(null);
      setAviso(null);
      setEnviando(true);
      try {
        const res = await fetch("/api/registro/verificar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, codigo }),
        });
        const data = await res.json().catch(() => null);
        if (res.ok) {
          router.push("/bienvenida");
          return;
        }
        if (data?.error === "sin_registro") setExiste(false);
        if (data && typeof data.intentosRestantes === "number") aplicarEstado(data);
        setError(data?.mensaje ?? "No pudimos verificar el código. Probá de nuevo.");
        setDigitos(vacio());
      } catch {
        setError("No pudimos conectarnos. Revisá tu conexión y probá de nuevo.");
      }
      setEnviando(false);
      // Después de que el fieldset vuelve a estar habilitado.
      setTimeout(() => enfocar(0), 50);
    },
    [email, router, aplicarEstado]
  );

  function escribir(i: number, valor: string) {
    const numeros = valor.replace(/\D/g, "");
    if (!numeros) {
      setDigitos((d) => d.map((x, j) => (j === i ? "" : x)));
      return;
    }
    // Pegar o autocompletar (SMS/mail) puede traer varios dígitos de una vez.
    const nuevos = [...digitos];
    for (let k = 0; k < numeros.length && i + k < CODIGO_DIGITOS; k++) nuevos[i + k] = numeros[k];
    setDigitos(nuevos);
    const siguiente = i + numeros.length;
    if (nuevos.every((d) => d !== "")) verificar(nuevos.join(""));
    else enfocar(siguiente);
  }

  function teclear(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digitos[i] && i > 0) {
      e.preventDefault();
      setDigitos((d) => d.map((x, j) => (j === i - 1 ? "" : x)));
      enfocar(i - 1);
    } else if (e.key === "ArrowLeft") enfocar(i - 1);
    else if (e.key === "ArrowRight") enfocar(i + 1);
  }

  async function reenviar() {
    setError(null);
    setAviso(null);
    setReenviando(true);
    try {
      const res = await fetch("/api/registro/reenviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => null);
      if (data && typeof data.intentosRestantes === "number") aplicarEstado(data);
      if (res.ok) {
        setAviso("Te mandamos un código nuevo. El anterior ya no vale.");
        setDigitos(vacio());
        enfocar(0);
      } else {
        if (data?.error === "sin_registro") setExiste(false);
        setError(data?.mensaje ?? "No pudimos reenviar el código.");
      }
    } catch {
      setError("No pudimos conectarnos. Revisá tu conexión y probá de nuevo.");
    }
    setReenviando(false);
  }

  const linkWhatsApp = (
    <a
      href={whatsappCodigoNoLlego(email)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 font-semibold text-[#2563EB] hover:underline"
    >
      <MessageCircle className="w-4 h-4" />
      Escribinos por WhatsApp
    </a>
  );

  if (existe === false) {
    return (
      <MarcoRegistro titulo="No hay un registro en curso" subtitulo="El código venció, ya se usó o el link está incompleto.">
        <Link href="/registro" className={claseBotonPrimario}>
          Empezar de nuevo
        </Link>
      </MarcoRegistro>
    );
  }

  const bloqueado = !!estado?.bloqueado;
  const sinReenvios = estado?.reenviosRestantes === 0;
  const puedeReenviar = !!estado && !sinReenvios && espera === 0;

  return (
    <MarcoRegistro
      titulo="Revisá tu mail"
      subtitulo={
        <>
          Te mandamos un código de {CODIGO_DIGITOS} números a <span className="font-medium text-[#1E293B] break-all">{email}</span>. Vence en{" "}
          {CODIGO_VIGENCIA_MIN} minutos.
        </>
      }
      pie={<>¿No te llegó? {linkWhatsApp}</>}
    >
      <div className="space-y-4">
        <fieldset disabled={enviando || bloqueado || existe === null}>
          <legend className="sr-only">Código de verificación</legend>
          <div className="flex justify-between gap-2">
            {digitos.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  casilleros.current[i] = el;
                }}
                value={d}
                onChange={(e) => escribir(i, e.target.value)}
                onKeyDown={(e) => teclear(i, e)}
                onFocus={(e) => e.target.select()}
                inputMode="numeric"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                autoFocus={i === 0}
                maxLength={CODIGO_DIGITOS}
                aria-label={`Dígito ${i + 1} de ${CODIGO_DIGITOS}`}
                className="w-11 h-12 sm:w-12 sm:h-14 rounded-lg border border-slate-200 bg-white text-center text-xl font-semibold text-[#1A3A5C] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition disabled:bg-slate-50 disabled:text-slate-400"
              />
            ))}
          </div>
        </fieldset>

        {enviando && (
          <p className="flex items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Verificando…
          </p>
        )}
        {error && <MensajeError>{error}</MensajeError>}
        {aviso && !error && (
          <p role="status" className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
            {aviso}
          </p>
        )}
        {bloqueado && !error && (
          <MensajeError>Agotaste los intentos para este código. {sinReenvios ? "Escribinos por WhatsApp y te ayudamos." : "Pedí un código nuevo."}</MensajeError>
        )}

        <div className="text-center text-sm">
          {sinReenvios ? (
            <span className="text-slate-400">Ya no quedan reenvíos para este registro.</span>
          ) : (
            <button
              type="button"
              onClick={reenviar}
              disabled={!puedeReenviar || reenviando}
              className="font-semibold text-[#2563EB] hover:underline disabled:text-slate-400 disabled:no-underline disabled:cursor-not-allowed"
            >
              {reenviando ? "Enviando…" : espera > 0 ? `Reenviar código en ${fmtEspera(espera)}` : "Reenviar código"}
            </button>
          )}
        </div>
      </div>
    </MarcoRegistro>
  );
}

export default function VerificarPage() {
  return (
    <Suspense fallback={null}>
      <Verificar />
    </Suspense>
  );
}
