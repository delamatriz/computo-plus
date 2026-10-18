"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Check, Loader2 } from "lucide-react";
import { MP_PLANES, PLANES_MP, type PlanMP } from "@/lib/config-mercadopago";
import { MAIL_CONTACTO } from "@/lib/config-prueba";
import { fmtDecimalUY } from "@/lib/formatoNumeros";

// Elegí tu plan (pública, sin sidebar). Los dos planes tienen acceso completo; hoy la diferencia
// es solo el precio. "Elegir este plan" crea la suscripción en MercadoPago
// (POST /api/pagos/crear-suscripcion) y redirige a su pantalla de pago. Sin sesión, el pedido
// vuelve 401 y se manda al login (que después regresa acá). El estado de la cuenta lo cambia el
// webhook de MercadoPago, no esta pantalla.
const BENEFICIOS = [
  "Acceso completo a todas las funciones de CÓMPUTO+",
  "Sin los cupos ni el vencimiento de la prueba gratis",
  "Se cobra todos los meses con MercadoPago",
];

export default function PlanesPage() {
  const router = useRouter();
  const [eligiendo, setEligiendo] = useState<PlanMP | null>(null);
  const [error, setError] = useState<string | null>(null);
  // true si hay sesión y la empresa está VENCIDA: la pantalla es la intermedia a la que el proxy
  // manda a esos usuarios (ver src/proxy.ts). Sin sesión el pedido falla y no se muestra nada.
  const [vencida, setVencida] = useState(false);

  useEffect(() => {
    let cancelado = false;
    fetch("/api/cuenta/estado")
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => {
        if (!cancelado && c?.estado === "VENCIDA") setVencida(true);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, []);

  async function elegir(plan: PlanMP) {
    setError(null);
    setEligiendo(plan);
    try {
      const res = await fetch("/api/pagos/crear-suscripcion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (res.status === 401) {
        router.push("/login?callbackUrl=/planes");
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (res.ok && typeof data.init_point === "string") {
        window.location.href = data.init_point;
        return; // el navegador se va: se deja el botón en "Redirigiendo…"
      }
      setError(data?.mensaje ?? "No pudimos iniciar el pago. Probá de nuevo en un rato.");
    } catch {
      setError("No se pudo conectar con el servidor. Probá de nuevo.");
    }
    setEligiendo(null);
  }

  return (
    <div className="min-h-screen bg-[#F0F4F8] px-4 py-12 font-sans">
      <div className="max-w-[760px] mx-auto">
        <Link href="/" className="block text-4xl font-bold tracking-tight text-[#1A3A5C]">
          CÓMPUTO+
        </Link>
        <p className="text-sm text-slate-500 mt-1">Presupuestación de Obra Premium</p>
        {vencida ? (
          // La app está cerrada hasta que contrate un plan (el proxy lo manda de vuelta acá): en vez
          // de "Volver", la salida es cerrar sesión.
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: "/" })}
            className="inline-block mt-5 text-sm font-semibold text-[#2563EB] hover:underline"
          >
            Cerrar sesión
          </button>
        ) : (
          <Link href="/inicio" className="inline-block mt-5 text-sm font-semibold text-[#2563EB] hover:underline">
            ← Volver
          </Link>
        )}

        <h1 className="text-3xl font-bold text-[#1A3A5C] mt-10 leading-tight">Elegí tu plan</h1>
        <p className="text-[15px] leading-7 text-slate-600 mt-2">
          Los dos planes tienen acceso completo a CÓMPUTO+. Elegí el que prefieras y pagás con MercadoPago, en pesos uruguayos.
        </p>

        {vencida && (
          <p role="status" className="mt-6 rounded-lg border border-slate-200 bg-slate-100 px-4 py-3 text-sm leading-relaxed text-slate-600">
            Tu período de prueba terminó. Elegí un plan para seguir usando CÓMPUTO+. Tus proyectos y datos están intactos.
          </p>
        )}

        {error && (
          <p role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="grid gap-5 sm:grid-cols-2 mt-8">
          {PLANES_MP.map((plan) => {
            const { nombre, montoUYU, montoUSD } = MP_PLANES[plan];
            const ocupado = eligiendo !== null;
            return (
              <div key={plan} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col">
                <h2 className="text-lg font-semibold text-[#1A3A5C]">{nombre}</h2>
                <p className="mt-3 text-[#1A3A5C]">
                  <span className="text-sm font-semibold text-slate-500">USD </span>
                  <span className="text-4xl font-bold tracking-tight">{fmtDecimalUY(montoUSD, 0)}</span>
                  <span className="text-sm text-slate-500"> /mes</span>
                </p>
                <p className="mt-1 text-xs text-slate-400">≈ UYU {fmtDecimalUY(montoUYU, 0)}/mes</p>
                <ul className="mt-5 space-y-2.5 flex-1">
                  {BENEFICIOS.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm leading-snug text-slate-700">
                      <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#2563EB]" />
                      {b}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => elegir(plan)}
                  disabled={ocupado}
                  className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 disabled:cursor-not-allowed px-4 py-2.5 text-sm font-semibold text-white transition-colors"
                >
                  {eligiendo === plan && <Loader2 className="w-4 h-4 animate-spin" />}
                  {eligiendo === plan ? "Redirigiendo…" : "Elegir este plan"}
                </button>
              </div>
            );
          })}
        </div>

        <p className="text-sm text-slate-500 mt-8 leading-relaxed">
          ¿Dudas o preferís otra forma de pago? Escribinos a{" "}
          <a href={`mailto:${MAIL_CONTACTO}`} className="underline hover:text-slate-700">
            {MAIL_CONTACTO}
          </a>
          .
        </p>

        <p className="text-center text-sm text-slate-400 mt-16">computo.delamatriz.com</p>
      </div>
    </div>
  );
}
