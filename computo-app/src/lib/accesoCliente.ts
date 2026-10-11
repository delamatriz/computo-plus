"use client";

// Lado cliente del acceso por estado de la empresa y cupos de la prueba
// (servidor: lib/acceso.ts). Tipos de la respuesta de GET /api/cuenta/estado
// y de los errores de acceso (403/401 con código, mensaje y link de contacto).

import { useCallback, useEffect, useState } from "react";

export type EstadoEmpresa = "PRUEBA" | "ACTIVA" | "VENCIDA" | "DESACTIVADA";

export interface Cupo {
  permitido: boolean;
  usado: number;
  /** null = sin límite (empresa ACTIVA). */
  limite: number | null;
}

export interface EstadoCuenta {
  estado: EstadoEmpresa;
  fechaVencimientoPrueba: string | null;
  diasRestantes: number | null;
  cupos: { calculoRapido: Cupo; proyectoAsistido: Cupo };
  proyectosAsistidos: string[];
  contacto: string;
}

export interface ErrorAcceso {
  error: "EMAIL_NO_VERIFICADO" | "EMPRESA_DESACTIVADA" | "PRUEBA_VENCIDA" | "CUPO_AGOTADO" | "NO_DISPONIBLE_EN_PRUEBA";
  mensaje: string;
  contacto: string;
}

const CODIGOS = new Set(["EMAIL_NO_VERIFICADO", "EMPRESA_DESACTIVADA", "PRUEBA_VENCIDA", "CUPO_AGOTADO", "NO_DISPONIBLE_EN_PRUEBA"]);

/** true si la respuesta JSON es un error de acceso (para mostrarlo con <AvisoAcceso />). */
export function esErrorAcceso(data: unknown): data is ErrorAcceso {
  const d = data as Partial<ErrorAcceso> | null;
  return !!d && typeof d.error === "string" && CODIGOS.has(d.error) && typeof d.mensaje === "string";
}

const BLOQUEOS_DE_CUENTA = new Set(["PRUEBA_VENCIDA", "EMPRESA_DESACTIVADA", "EMAIL_NO_VERIFICADO"]);

/**
 * Bloqueo de toda la cuenta (no de una función): lo avisa <AvisoCuentaBloqueada />
 * en forma global, así que las pantallas no lo repiten en su propio aviso.
 */
export function esBloqueoDeCuenta(data: unknown): data is ErrorAcceso {
  return esErrorAcceso(data) && BLOQUEOS_DE_CUENTA.has(data.error);
}

/**
 * Estado de la cuenta (al montar; `recargar` vuelve a pedirlo, ej. después de
 * gastar un cupo). cuenta null mientras carga o si falla: quien lo use no debe
 * bloquear nada con null — el servidor es el que decide.
 */
export function useEstadoCuenta(): { cuenta: EstadoCuenta | null; recargar: () => void } {
  const [cuenta, setCuenta] = useState<EstadoCuenta | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let cancelado = false;
    fetch("/api/cuenta/estado")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelado && data?.estado) setCuenta(data);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [version]);
  const recargar = useCallback(() => setVersion((v) => v + 1), []);
  return { cuenta, recargar };
}
