"use client";

import { Lock, MessageCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Aviso inline en el lugar donde se invoca una función que no está disponible
// (cupo de la prueba agotado, función fuera de la prueba, prueba vencida):
// el mensaje del servidor + "Escribinos por WhatsApp". No es un modal.
export function AvisoAcceso({
  mensaje,
  contacto,
  onCerrar,
  className,
}: {
  mensaje: string;
  contacto: string;
  onCerrar?: () => void;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn("flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900", className)}
    >
      <Lock className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600" />
      <div className="flex-1 min-w-0">
        <p className="leading-snug">{mensaje}</p>
        <a
          href={contacto}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 mt-1.5 font-semibold text-amber-800 hover:underline"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          Escribinos por WhatsApp
        </a>
      </div>
      {onCerrar && (
        <button type="button" onClick={onCerrar} aria-label="Cerrar aviso" className="p-0.5 rounded text-amber-500 hover:text-amber-700">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
