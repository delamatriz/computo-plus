"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CreditCard, Lock, MessageCircle, RotateCw, X } from "lucide-react";
import { esBloqueoDeCuenta, type ErrorAcceso } from "@/lib/accesoCliente";

const EVENTO = "cp:cuenta-bloqueada";

declare global {
  interface Window {
    __cpFetchConAvisoDeCuenta?: boolean;
  }
}

// Envuelve window.fetch una sola vez: si un pedido a /api/* vuelve 403/401
// con un bloqueo de cuenta (prueba vencida, empresa desactivada, email sin
// verificar), avisa con un evento. No cambia la respuesta: cada pantalla la
// sigue manejando como siempre.
function instalarIntercepcion() {
  if (typeof window === "undefined" || window.__cpFetchConAvisoDeCuenta) return;
  window.__cpFetchConAvisoDeCuenta = true;
  const fetchOriginal = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const res = await fetchOriginal(...args);
    if (res.status === 403 || res.status === 401) {
      try {
        const destino = args[0] instanceof Request ? args[0].url : String(args[0]);
        const url = new URL(destino, window.location.origin);
        if (url.origin === window.location.origin && url.pathname.startsWith("/api/")) {
          const data = await res.clone().json().catch(() => null);
          if (esBloqueoDeCuenta(data)) window.dispatchEvent(new CustomEvent<ErrorAcceso>(EVENTO, { detail: data }));
        }
      } catch {}
    }
    return res;
  };
}

// Aviso flotante (no modal) cuando el servidor rechaza un cambio porque la
// cuenta está en solo lectura o sin acceso. Hace falta porque muchas pantallas
// editan en línea con actualización optimista: sin esto, el cambio se veía
// aplicado y se perdía al recargar. Montado una vez en el layout raíz.
export function AvisoCuentaBloqueada() {
  const [aviso, setAviso] = useState<ErrorAcceso | null>(null);

  useEffect(() => {
    instalarIntercepcion();
    const alBloquear = (e: Event) => setAviso((e as CustomEvent<ErrorAcceso>).detail);
    window.addEventListener(EVENTO, alBloquear);
    return () => window.removeEventListener(EVENTO, alBloquear);
  }, []);

  if (!aviso) return null;
  const vencida = aviso.error === "PRUEBA_VENCIDA";
  // Prueba vencida o sin cupo: salir es contratar un plan. Con la cuenta desactivada o el mail sin
  // verificar un plan no ayuda: ahí el contacto por WhatsApp sigue siendo la salida principal.
  const conPlanes = vencida || aviso.error === "CUPO_AGOTADO" || aviso.error === "NO_DISPONIBLE_EN_PRUEBA";
  const claseWhatsapp = conPlanes
    ? "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors"
    : "inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] px-3 py-1.5 text-xs font-semibold text-white transition-colors";

  return (
    <div className="fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4 pointer-events-none">
      <div
        role="alert"
        className="pointer-events-auto w-full max-w-md rounded-xl border border-red-200 bg-white shadow-modal px-4 py-3.5 flex items-start gap-3"
      >
        <span className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
          <Lock className="w-4 h-4 text-red-500" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#1E293B]">{vencida ? "Este cambio no se guardó" : "No se pudo completar"}</p>
          <p className="text-sm text-slate-500 mt-0.5 leading-snug">{aviso.mensaje}</p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {conPlanes && (
              <Link
                href="/planes"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] px-3 py-1.5 text-xs font-semibold text-white transition-colors"
              >
                <CreditCard className="w-3.5 h-3.5" />
                Ver planes
              </Link>
            )}
            <a href={aviso.contacto} target="_blank" rel="noopener noreferrer" className={claseWhatsapp}>
              <MessageCircle className="w-3.5 h-3.5" />
              Contactanos
            </a>
            {vencida && (
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors"
              >
                <RotateCw className="w-3.5 h-3.5" />
                Recargar
              </button>
            )}
          </div>
        </div>
        <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar aviso" className="p-1 rounded-md text-slate-300 hover:text-slate-500">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
