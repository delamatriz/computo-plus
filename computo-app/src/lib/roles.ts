// Roles y planes (oct-2026). En la base User.rol y Empresa.plan son String
// sueltos (sin enum de Prisma todavía): estos tipos son la fuente de verdad
// de qué valores son válidos.
//
// SUPERADMIN: administra la plataforma (alta de empresas y usuarios, /admin).
// ADMIN:      administra su empresa.
// USUARIO:    usa la app dentro de su empresa.

export const ROLES = ["SUPERADMIN", "ADMIN", "USUARIO"] as const;
export type Rol = (typeof ROLES)[number];

/** Roles que se pueden asignar desde el panel /admin (SUPERADMIN no). */
export const ROLES_ASIGNABLES = ["ADMIN", "USUARIO"] as const satisfies readonly Rol[];

export const PLANES = ["basico", "profesional", "enterprise"] as const;
export type Plan = (typeof PLANES)[number];

export function esRol(valor: unknown): valor is Rol {
  return typeof valor === "string" && (ROLES as readonly string[]).includes(valor);
}

export function esPlan(valor: unknown): valor is Plan {
  return typeof valor === "string" && (PLANES as readonly string[]).includes(valor);
}
