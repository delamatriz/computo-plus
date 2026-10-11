"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { CLAVE_ORIGEN, DIAS_PRUEBA } from "@/lib/config-prueba";
import { MarcoRegistro, MensajeError, claseBotonPrimario, claseInput } from "@/components/registro/MarcoRegistro";

function leerOrigen(): string | null {
  try {
    return sessionStorage.getItem(CLAVE_ORIGEN);
  } catch {
    return null;
  }
}

// Paso 3 del registro público: recién acá se piden nombre y empresa. Al
// confirmar se crea la empresa en prueba, se inicia sesión y se entra a la app.
// La autorización viaja en una cookie httpOnly puesta al verificar el mail.
export default function BienvenidaPage() {
  const router = useRouter();
  // undefined = cargando; null = sin verificación válida.
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [nombre, setNombre] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [rut, setRut] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    fetch("/api/registro/completar")
      .then(async (r) => (r.ok ? ((await r.json()) as { email: string }).email : null))
      .then(setEmail)
      .catch(() => setEmail(null));
  }, []);

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const res = await fetch("/api/registro/completar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, empresa, rut, origen: leerOrigen() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.tokenIngreso) {
        if (res.status === 401) setEmail(null);
        setError(data?.mensaje ?? "No pudimos crear tu cuenta. Probá de nuevo.");
        setEnviando(false);
        return;
      }
      const ingreso = await signIn("registro", { token: data.tokenIngreso, redirect: false });
      if (!ingreso || ingreso.error) {
        // La cuenta ya existe: si el ingreso automático falla, entra a mano.
        router.replace("/login?callbackUrl=%2Finicio");
        return;
      }
      try {
        sessionStorage.removeItem(CLAVE_ORIGEN);
      } catch {}
      router.replace("/inicio");
      router.refresh();
    } catch {
      setError("No pudimos conectarnos. Revisá tu conexión y probá de nuevo.");
      setEnviando(false);
    }
  }

  if (email === undefined) {
    return (
      <MarcoRegistro titulo="Un momento…">
        <div className="flex justify-center py-6 text-slate-300">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      </MarcoRegistro>
    );
  }

  if (email === null) {
    return (
      <MarcoRegistro titulo="Tu verificación venció" subtitulo="Pasó demasiado tiempo o ya se usó. Empezá el registro de nuevo.">
        <Link href="/registro" className={claseBotonPrimario}>
          Empezar de nuevo
        </Link>
      </MarcoRegistro>
    );
  }

  return (
    <MarcoRegistro
      titulo="¡Listo, mail verificado!"
      subtitulo={`Contanos quién sos y arrancan tus ${DIAS_PRUEBA} días de prueba.`}
    >
      <form onSubmit={confirmar} className="space-y-4" noValidate>
        <div>
          <label htmlFor="bienvenida-nombre" className="block text-xs font-semibold text-[#1A3A5C] mb-1.5">
            Tu nombre
          </label>
          <input
            id="bienvenida-nombre"
            autoComplete="name"
            autoFocus
            required
            maxLength={80}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className={claseInput}
            placeholder="Ej. Ana Rodríguez"
          />
        </div>
        <div>
          <label htmlFor="bienvenida-empresa" className="block text-xs font-semibold text-[#1A3A5C] mb-1.5">
            Empresa o estudio
          </label>
          <input
            id="bienvenida-empresa"
            autoComplete="organization"
            required
            maxLength={120}
            value={empresa}
            onChange={(e) => setEmpresa(e.target.value)}
            className={claseInput}
            placeholder="Ej. Constructora del Sur"
          />
        </div>
        <div>
          <label htmlFor="bienvenida-rut" className="block text-xs font-semibold text-[#1A3A5C] mb-1.5">
            RUT <span className="font-normal text-slate-400">(opcional)</span>
          </label>
          <input
            id="bienvenida-rut"
            inputMode="numeric"
            maxLength={20}
            value={rut}
            onChange={(e) => setRut(e.target.value)}
            className={claseInput}
            placeholder="Lo podés cargar después"
          />
        </div>

        <p className="text-xs text-slate-400">
          Entrás como <span className="font-medium text-slate-500 break-all">{email}</span>
        </p>

        {error && <MensajeError>{error}</MensajeError>}

        <button type="submit" disabled={enviando || !nombre.trim() || !empresa.trim()} className={claseBotonPrimario}>
          {enviando && <Loader2 className="w-4 h-4 animate-spin" />}
          {enviando ? "Preparando tu cuenta…" : "Empezar"}
        </button>
      </form>
    </MarcoRegistro>
  );
}
