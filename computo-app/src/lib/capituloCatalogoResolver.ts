import { PrismaClient } from "@/generated/prisma/client";
import { obtenerMapeoSAU } from "@/lib/capitulosSau";

/**
 * Fase 2, Etapa 5 — resuelve capituloCatalogoId para un capítulo real en el
 * momento de crearlo, usando el mismo alias de CAPITULOS_SAU que ya usa
 * obtenerMapeoSAU en el cliente (mismo módulo compartido, ver
 * capitulosSau.ts). Cierra el agujero detectado en el diagnóstico previo:
 * antes de esto, todo capítulo nuevo nacía con capituloCatalogoId: null y
 * dependía de un backfill posterior.
 *
 * Nunca bloquea: si no matchea ningún CapituloCatalogo (alias ambiguo, sin
 * alias, o alias sin catálogo dado de alta), devuelve undefined y loguea un
 * warning — mismo criterio que crearSubrubroEstandar().
 */
export async function resolverCapituloCatalogoId(
  db: PrismaClient,
  nombreCapitulo: string
): Promise<string | undefined> {
  const mapeo = obtenerMapeoSAU(nombreCapitulo);
  const candidatos = mapeo ? mapeo.capitulos : [nombreCapitulo];

  if (candidatos.length !== 1) {
    console.warn(
      `[resolverCapituloCatalogoId] "${nombreCapitulo}" resuelve a ${candidatos.length} capítulos de catálogo (${candidatos.join(", ")}) — ambiguo, se crea sin capituloCatalogoId`
    );
    return undefined;
  }

  const catalogo = await db.capituloCatalogo.findUnique({ where: { nombre: candidatos[0] } });
  if (!catalogo) {
    console.warn(
      `[resolverCapituloCatalogoId] Sin CapituloCatalogo para "${candidatos[0]}" (capítulo real: "${nombreCapitulo}") — se crea sin capituloCatalogoId`
    );
    return undefined;
  }

  return catalogo.id;
}
