// Cálculos de resumen de un proyecto compartidos por el Panel de control y
// Mis Proyectos, para que las dos pantallas muestren el mismo total y el
// mismo orden.
import { SIGLAS } from "@/lib/capitalizarDescripcion";

interface RubroResumen {
  precioUnit: number;
  cantidad: number;
  updatedAt: Date;
  apu: { actualizadoEn: Date } | null;
}

interface ProyectoResumen {
  updatedAt: Date;
  capitulos: { updatedAt: Date; rubros: RubroResumen[] }[];
}

/** Select de Prisma con lo que necesitan las dos funciones de abajo. */
export const SELECT_CAPITULOS_RESUMEN = {
  select: {
    updatedAt: true,
    rubros: { select: { precioUnit: true, cantidad: true, updatedAt: true, apu: { select: { actualizadoEn: true } } } },
  },
} as const;

/** Total presupuestado: Costo Directo + Utilidad (Σ precioUnit × cantidad), sin Gastos Generales ni IVA. */
export function totalPresupuestado(p: Pick<ProyectoResumen, "capitulos">): number {
  return p.capitulos.reduce((a, c) => a + c.rubros.reduce((b, r) => b + r.precioUnit * r.cantidad, 0), 0);
}

// Última modificación real del proyecto: Proyecto.updatedAt solo cambia al
// editar el proyecto en sí (nombre, estado…), no sus capítulos, rubros ni
// APU — se toma la fecha más reciente de todo eso.
export function ultimaModificacion(p: ProyectoResumen): number {
  let max = p.updatedAt.getTime();
  for (const c of p.capitulos) {
    max = Math.max(max, c.updatedAt.getTime());
    for (const r of c.rubros) {
      max = Math.max(max, r.updatedAt.getTime(), r.apu?.actualizadoEn.getTime() ?? 0);
    }
  }
  return max;
}

// Palabras que van en minúscula dentro del nombre (salvo al principio).
// Los artículos (la, las, el, los) NO: suelen ser parte de un nombre propio
// ("Las Piedras", "La Paz").
const MINUSCULA = new Set(["de", "del", "y", "e", "en", "a", "al", "con", "para", "por", "o"]);
// Número romano válido (XXI, IV, II…): "CIVIL" o "MIL" no lo son.
const ROMANO = /^(?=[IVXLCDM])M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;

/**
 * Nombre del proyecto para mostrar: si está escrito todo en mayúsculas lo pasa
 * a mayúscula inicial por palabra ("EDIFICIO TORRE SIGLO XXI" → "Edificio
 * Torre Siglo XXI"), respetando números romanos, siglas conocidas y palabras
 * con dígitos. Si ya tiene minúsculas, se respeta como lo escribió el usuario.
 * Solo para mostrar: la base no se toca.
 */
export function nombreProyectoParaMostrar(nombre: string): string {
  const limpio = nombre.trim().replace(/\s+/g, " ");
  if (limpio !== limpio.toLocaleUpperCase("es")) return limpio;
  return limpio
    .split(" ")
    .map((w, i) => {
      if (ROMANO.test(w) || SIGLAS.has(w) || /\d/.test(w)) return w;
      const min = w.toLocaleLowerCase("es");
      if (i > 0 && MINUSCULA.has(min)) return min;
      return min.charAt(0).toLocaleUpperCase("es") + min.slice(1);
    })
    .join(" ");
}
