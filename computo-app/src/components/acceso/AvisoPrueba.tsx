"use client";

import { Clock, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EstadoCuenta } from "@/lib/accesoCliente";

/** Desde cuántos días antes del vencimiento se muestra el aviso. */
const DIAS_AVISO = 7;

// Aviso del estado de la prueba (no es un modal): quedan menos de DIAS_AVISO
// días, o la prueba venció (solo lectura). variante "chip" va en el header
// (desde lg); "barra" es una franja fina debajo del header en pantallas más
// angostas, donde el header no tiene lugar (el logo se quedaba sin texto).
// "Contactanos" abre WhatsApp con el email del usuario. El cupo agotado NO se
// avisa acá: va en el lugar donde se invoca cada función (<AvisoAcceso />).
export function AvisoPrueba({ cuenta, variante = "chip" }: { cuenta: EstadoCuenta | null; variante?: "chip" | "barra" }) {
  if (!cuenta) return null;
  const vencida = cuenta.estado === "VENCIDA";
  const dias = cuenta.diasRestantes;
  const porVencer = cuenta.estado === "PRUEBA" && dias !== null && dias < DIAS_AVISO;
  if (!vencida && !porVencer) return null;

  const texto = vencida
    ? "Tu período de prueba venció. Estás en modo solo lectura."
    : dias === 0
      ? "Tu prueba vence hoy."
      : `Te ${dias === 1 ? "queda 1 día" : `quedan ${dias} días`} de prueba.`;
  const textoMedio = vencida ? "Prueba vencida · solo lectura" : dias === 0 ? "La prueba vence hoy" : `${dias} ${dias === 1 ? "día" : "días"} de prueba`;
  const Icono = vencida ? Eye : Clock;

  const colorIcono = vencida ? "text-red-500" : "text-amber-600";
  const colores = vencida ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-900";
  const colorBoton = vencida ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700";
  const contactanos = (
    <a
      href={cuenta.contacto}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("flex-shrink-0 rounded-full px-2.5 py-0.5 font-semibold text-white transition-colors", colorBoton)}
    >
      Contactanos
    </a>
  );

  if (variante === "barra") {
    return (
      <div role="status" className={cn("flex items-center justify-between gap-3 border-b px-3 py-1.5 text-xs font-medium", colores)}>
        <span className="flex items-center gap-1.5 min-w-0">
          <Icono className={cn("w-3.5 h-3.5 flex-shrink-0", colorIcono)} />
          <span className="truncate sm:hidden">{textoMedio}</span>
          <span className="truncate hidden sm:inline">{texto}</span>
        </span>
        {contactanos}
      </div>
    );
  }

  return (
    <div
      role="status"
      className={cn("flex flex-shrink-0 items-center gap-2 rounded-full border pl-2.5 pr-1 py-1 text-xs font-medium whitespace-nowrap", colores)}
    >
      <Icono className={cn("w-3.5 h-3.5 flex-shrink-0", colorIcono)} />
      <span className="hidden xl:inline">{texto}</span>
      <span className="xl:hidden">{textoMedio}</span>
      {contactanos}
    </div>
  );
}
