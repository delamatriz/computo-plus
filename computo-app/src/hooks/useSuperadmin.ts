import { useEffect, useState } from "react";
import { getSession } from "next-auth/react";
import type { Rol } from "@/lib/roles";

// Rol del usuario para decidir qué controles mostrar — solo UX: quien decide
// de verdad es el servidor (requerirSuperadmin lee el rol de la base). El rol
// sale del JWT, así que un cambio de rol se ve recién al volver a loguearse.
// Mientras carga devuelve null: los callers lo tratan como "no SUPERADMIN"
// (superadmin === true) para no mostrar controles que después desaparecen.
export function useRolUsuario(): Rol | null {
  // null = cargando o sin sesión
  const [rol, setRol] = useState<Rol | null>(null);
  useEffect(() => {
    getSession()
      .then((s) => setRol(s?.user?.rol ?? null))
      .catch(() => setRol(null));
  }, []);
  return rol;
}

export function useSuperadmin(): boolean | null {
  // null = cargando, true = es SUPERADMIN, false = no es SUPERADMIN
  const [esSuperadmin, setEsSuperadmin] = useState<boolean | null>(null);
  useEffect(() => {
    getSession()
      .then((s) => setEsSuperadmin(s?.user?.rol === "SUPERADMIN"))
      .catch(() => setEsSuperadmin(false));
  }, []);
  return esSuperadmin;
}
