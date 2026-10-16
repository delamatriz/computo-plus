// Visibilidad del catálogo de materiales (PrecioMTOP) por empresa.
//
// empresaId null = catálogo global (Lista MTOP oficial y listas de proveedor que importa el
// SUPERADMIN): lo ven todas las empresas. empresaId con valor = lo importó un ADMIN de esa
// empresa: solo esa empresa lo ve y lo usa.
//
// Regla de uso:
//  - Lo que ve o elige el usuario (buscador del APU, /materiales): visibleParaEmpresa(empresa).
//  - Todo lo automático o de mantenimiento (matching por texto, prompts de IA, verificación de
//    precios de mercado, cola de revisión, contadores): SOLO_CATALOGO_GLOBAL. Los materiales
//    privados de una empresa se usan únicamente por vínculo explícito (precioMTOPId).

export const SOLO_CATALOGO_GLOBAL = { empresaId: null } as const;

/** Global + lo propio de la empresa. Sin empresa (sesión ausente) solo lo global. */
export function visibleParaEmpresa(empresaId: string | null | undefined) {
  return empresaId ? { OR: [{ empresaId: null }, { empresaId }] } : SOLO_CATALOGO_GLOBAL;
}

/**
 * Código de un material importado por un ADMIN. El único de la base sigue siendo
 * (codigo, proveedor), así que el código del archivo se prefija con la empresa: dos empresas
 * que importan la misma lista de un proveedor no chocan.
 */
export function codigoParaEmpresa(empresaId: string, codigoArchivo: string): string {
  return `E${empresaId.slice(-6)}-${codigoArchivo.trim()}`;
}
