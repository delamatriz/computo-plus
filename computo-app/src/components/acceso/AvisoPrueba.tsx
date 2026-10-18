"use client";

import { Clock, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAIL_CONTACTO } from "@/lib/config-prueba";
import type { EstadoCuenta } from "@/lib/accesoCliente";

/** Desde cuántos días antes del vencimiento se muestra el aviso (con 10 días restantes ya aparece). */
const DIAS_AVISO = 10;

// Aviso del estado de la prueba (no es un modal): quedan DIAS_AVISO días o menos, o la prueba
// venció (solo lectura). Según los días que quedan:
//   10 a 2 → ámbar        "Te quedan N días de prueba gratuita"
//   1      → naranja      "Tu prueba vence mañana"
//   0      → rojo         "Tu período de prueba vence hoy"
//   vencida → rojo        "Tu período de prueba venció. Estás en modo solo lectura. Contactanos para continuar."
// variante "chip" va en el header (desde lg); "barra" es una franja fina debajo del header en
// pantallas más angostas, donde el header no tiene lugar (el logo se quedaba sin texto).
// "Contactanos" abre WhatsApp con el email del usuario; al lado va el mail de contacto. El cupo
// agotado NO se avisa acá: va en el lugar donde se invoca cada función (<AvisoAcceso />).
type Nivel = "ambar" | "naranja" | "rojo";

const ESTILOS: Record<Nivel, { icono: string; colores: string; boton: string; enlace: string }> = {
  ambar: {
    icono: "text-amber-600",
    colores: "border-amber-200 bg-amber-50 text-amber-900",
    boton: "bg-amber-600 hover:bg-amber-700",
    enlace: "text-amber-900",
  },
  naranja: {
    icono: "text-orange-600",
    colores: "border-orange-300 bg-orange-50 text-orange-900",
    boton: "bg-orange-600 hover:bg-orange-700",
    enlace: "text-orange-900",
  },
  rojo: {
    icono: "text-red-500",
    colores: "border-red-200 bg-red-50 text-red-800",
    boton: "bg-red-600 hover:bg-red-700",
    enlace: "text-red-800",
  },
};

export function AvisoPrueba({ cuenta, variante = "chip" }: { cuenta: EstadoCuenta | null; variante?: "chip" | "barra" }) {
  if (!cuenta) return null;
  const vencida = cuenta.estado === "VENCIDA";
  const dias = cuenta.diasRestantes;
  const porVencer = cuenta.estado === "PRUEBA" && dias !== null && dias <= DIAS_AVISO;
  if (!vencida && !porVencer) return null;

  const nivel: Nivel = vencida || dias === 0 ? "rojo" : dias === 1 ? "naranja" : "ambar";
  const texto = vencida
    ? "Tu período de prueba venció. Estás en modo solo lectura. Contactanos para continuar."
    : dias === 0
      ? "Tu período de prueba vence hoy"
      : dias === 1
        ? "Tu prueba vence mañana"
        : `Te quedan ${dias} días de prueba gratuita`;
  const textoMedio = vencida
    ? "Prueba vencida · solo lectura"
    : dias === 0
      ? "La prueba vence hoy"
      : dias === 1
        ? "La prueba vence mañana"
        : `${dias} días de prueba`;
  const Icono = vencida ? Eye : Clock;

  const { icono: colorIcono, colores, boton: colorBoton, enlace: colorEnlace } = ESTILOS[nivel];
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
  // Correo de contacto: el chip del header es angosto, así que ahí solo aparece en pantallas muy
  // anchas; en la barra (más lugar) aparece desde sm.
  const correo = (clase: string) => (
    <a href={`mailto:${MAIL_CONTACTO}`} className={cn("flex-shrink-0 underline underline-offset-2", colorEnlace, clase)}>
      {MAIL_CONTACTO}
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
        <span className="flex items-center gap-2 flex-shrink-0">
          {correo("hidden sm:inline")}
          {contactanos}
        </span>
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
      {correo("hidden 2xl:inline")}
      {contactanos}
    </div>
  );
}
