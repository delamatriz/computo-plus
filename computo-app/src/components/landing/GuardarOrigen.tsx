"use client";

import { useEffect } from "react";
import { CLAVE_ORIGEN } from "@/lib/config-prueba";

// ?o= (instagram, mail, demo…) de la landing: se guarda para asociarlo al
// registro en /bienvenida. Mismo criterio que sanitizarOrigen() del servidor.
export function GuardarOrigen() {
  useEffect(() => {
    try {
      const o = new URLSearchParams(window.location.search).get("o");
      const limpio = o?.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 30);
      if (limpio) sessionStorage.setItem(CLAVE_ORIGEN, limpio);
    } catch {}
  }, []);
  return null;
}
