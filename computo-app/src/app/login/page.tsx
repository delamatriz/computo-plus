"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { FormularioLogin } from "@/components/FormularioLogin";

// Fallback del login: el flujo principal es el modal de la landing ("/").
// Acá llega el proxy cuando se pide una página sin sesión, con
// ?callbackUrl=<página pedida>.

// Solo rutas internas ("/proyectos/..."): nunca redirigir a otro dominio que
// venga en ?callbackUrl= (ni "//otro.com", que el navegador toma como externo).
function destinoSeguro(callbackUrl: string | null): string {
  if (!callbackUrl) return "/inicio";
  try {
    const url = new URL(callbackUrl, window.location.origin);
    if (url.origin !== window.location.origin) return "/inicio";
    const destino = url.pathname + url.search + url.hash;
    // "/" es la landing: después del login va a la app.
    return destino === "/" ? "/inicio" : destino;
  } catch {
    return "/inicio";
  }
}

function FormularioConDestino() {
  const searchParams = useSearchParams();
  return (
    <>
      {/* ?aviso=pago: viene de /planes/confirmacion después de pagar (el estado real llega por webhook). */}
      {searchParams.get("aviso") === "pago" && (
        <p role="status" className="mb-5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm leading-snug text-blue-800">
          Tu pago está siendo procesado. En unos minutos tu cuenta estará activa.
        </p>
      )}
      <FormularioLogin destino={destinoSeguro(searchParams.get("callbackUrl"))} />
    </>
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
            <FormularioConDestino />
          </Suspense>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">Presupuestación de Obra Premium · Uruguay</p>
      </div>
    </div>
  );
}
