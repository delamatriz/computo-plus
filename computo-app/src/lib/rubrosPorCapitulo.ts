import { db } from "@/lib/db";
import { obtenerMapeoSAU } from "@/lib/capitulosSau";

// Rubros reales (SubrubroEstandar activos) agrupados por capítulo de la Lista estándar del asistente
// de Nuevo proyecto — solo descripción y unidad, sin precios. Los nombres del asistente
// (CapituloEstandar) y los del catálogo de subrubros (CapituloCatalogo) no siempre coinciden
// ("Estructura de Hormigón Armado" / "Estructura", "Carpintería" / "Carpinterías"): el vínculo es
// el mismo alias de CAPITULOS_SAU que usa resolverCapituloCatalogoId al crear un capítulo real,
// incluidos los recortes por subcapítulo (Pisos y Revestimientos / Albañilería).

export interface RubroDeCatalogo {
  descripcion: string;
  unidad: string;
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Para cada nombre de capítulo de la Lista estándar, sus rubros reales. Un capítulo sin catálogo
 * asociado (ej. "Ensayo de Suelos") queda con lista vacía. Los rubros van sin repetir, en el orden
 * del catálogo.
 */
export async function rubrosPorCapituloEstandar(nombres: string[]): Promise<Map<string, RubroDeCatalogo[]>> {
  const subrubros = await db.subrubroEstandar.findMany({
    where: { activo: true, capituloId: { not: null } },
    select: {
      descripcion: true,
      unidad: true,
      capituloCatalogo: { select: { nombre: true } },
      subcapituloCatalogo: { select: { nombre: true } },
    },
    orderBy: [{ orden: "asc" }, { codigo: "asc" }],
  });

  const resultado = new Map<string, RubroDeCatalogo[]>();
  for (const nombre of nombres) {
    const mapeo = obtenerMapeoSAU(nombre);
    const capitulos = new Set((mapeo?.capitulos ?? [nombre]).map(norm));
    const incluir = mapeo?.subcapitulos ? new Set(mapeo.subcapitulos.map(norm)) : null;
    const excluir = mapeo?.excluirSubcapitulos ? new Set(mapeo.excluirSubcapitulos.map(norm)) : null;

    const vistos = new Set<string>();
    const rubros: RubroDeCatalogo[] = [];
    for (const s of subrubros) {
      if (!s.capituloCatalogo || !capitulos.has(norm(s.capituloCatalogo.nombre))) continue;
      const sub = s.subcapituloCatalogo ? norm(s.subcapituloCatalogo.nombre) : null;
      if (incluir && (!sub || !incluir.has(sub))) continue;
      if (excluir && sub && excluir.has(sub)) continue;
      const clave = norm(s.descripcion);
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      rubros.push({ descripcion: s.descripcion.trim(), unidad: s.unidad });
    }
    resultado.set(nombre, rubros);
  }
  return resultado;
}
