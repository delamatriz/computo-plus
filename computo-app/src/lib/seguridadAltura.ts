import { db } from "@/lib/db";

// "Seguridad y Trabajos en Altura" dejó de ser un capítulo propio (oct-2026):
// sus tres rubros fijos viven dentro de "Implantación y Replanteo" de cada
// Título que declara requierePlanSeguridad.
const NOMBRE_IMPLANTACION = "Implantación y Replanteo";
// Nombre del capítulo viejo: solo se usa para NO tocar un Título que todavía
// lo conserva (la migración de proyectos existentes lo resuelve aparte).
const NOMBRE_CAPITULO_VIEJO = "Seguridad y Trabajos en Altura";

// Rubros fijos, sin modalidad — la maquinaria puntual (andamios, grúa,
// balancín, silleta) se carga en el Equipo del APU de cada rubro que la
// use, no acá. Son solo la documentación/administrativo del Plan y Estudio
// de Seguridad.
const DESCRIPCIONES_FIJAS = [
  "Estudio y plan de seguridad",
  "Memoria de instalación eléctrica de obra",
  "Señalización y vallado perimetral de obra",
];

const norm = (s: string) => s.trim().toLowerCase();

// Próximo código "R###" de un capítulo (máximo numérico existente + 1).
function proximoCodigoRubro(codigos: string[]): number {
  return codigos.reduce((mx, c) => Math.max(mx, parseInt(c.replace(/\D/g, "") || "0", 10)), 0) + 1;
}

/* ─── Carga los 3 rubros del Plan y Estudio de Seguridad dentro de
   "Implantación y Replanteo" de cada Título del proyecto que tenga
   requierePlanSeguridad=true; si el Título no tiene ese capítulo, lo crea
   (con el vínculo al catálogo y primero en el orden, como en la Lista
   estándar). Idempotente por título y por rubro: no duplica un capítulo ni un
   rubro que ya existe (se compara la descripción, sin distinguir mayúsculas),
   y uno ya generado no bloquea ni afecta a los demás títulos. Pensada para
   ejecutarse luego de crear/editar el proyecto. ── */
export async function generarCapituloSeguridad(proyectoId: string): Promise<void> {
  const proyecto = await db.proyecto.findUnique({
    where: { id: proyectoId },
    include: {
      titulos: { orderBy: { orden: "asc" } },
      capitulos: { include: { rubros: { select: { codigo: true, descripcion: true } } } },
    },
  });
  if (!proyecto) return;

  const titulosQueNecesitan = proyecto.titulos.filter((t) => t.requierePlanSeguridad);
  if (titulosQueNecesitan.length === 0) return;

  const catalogoImplantacion = await db.capituloCatalogo.findUnique({ where: { nombre: NOMBRE_IMPLANTACION } });
  if (!catalogoImplantacion) {
    console.warn(`[generarCapituloSeguridad] Sin CapituloCatalogo para "${NOMBRE_IMPLANTACION}" — se crea sin capituloCatalogoId`);
  }

  for (const titulo of titulosQueNecesitan) {
    const capitulos = proyecto.capitulos.filter((c) => c.tituloId === titulo.id);

    // Transición: un Título que todavía tiene el capítulo viejo "Seguridad y
    // Trabajos en Altura" no se toca (agregarle los rubros acá los duplicaría
    // con los de ese capítulo); la migración de proyectos los pasa a
    // Implantación y borra el capítulo viejo.
    if (capitulos.some((c) => norm(c.nombre) === norm(NOMBRE_CAPITULO_VIEJO))) continue;

    let implantacion = capitulos.find(
      (c) => (catalogoImplantacion && c.capituloCatalogoId === catalogoImplantacion.id) || norm(c.nombre) === norm(NOMBRE_IMPLANTACION)
    );

    if (!implantacion) {
      // Primero en el orden del Título (Implantación es el #1 de la Lista
      // estándar). Código: "<n° de título>.1" si está libre; si no, el
      // siguiente libre del título.
      const indiceTitulo = proyecto.titulos.findIndex((t) => t.id === titulo.id) + 1;
      const usados = new Set(capitulos.map((c) => c.codigo));
      let n = 1;
      while (usados.has(`${indiceTitulo}.${n}`)) n++;
      const orden = capitulos.length > 0 ? Math.min(...capitulos.map((c) => c.orden)) - 1 : 1;
      const creado = await db.capitulo.create({
        data: {
          proyectoId,
          tituloId: titulo.id,
          nombre: NOMBRE_IMPLANTACION,
          codigo: `${indiceTitulo}.${n}`,
          color: "#94A3B8",
          orden,
          capituloCatalogoId: catalogoImplantacion?.id,
        },
        include: { rubros: { select: { codigo: true, descripcion: true } } },
      });
      implantacion = creado;
    }

    const existentes = new Set(implantacion.rubros.map((r) => norm(r.descripcion)));
    let n = proximoCodigoRubro(implantacion.rubros.map((r) => r.codigo));
    for (const descripcion of DESCRIPCIONES_FIJAS) {
      if (existentes.has(norm(descripcion))) continue;
      await db.rubro.create({
        data: {
          capituloId: implantacion.id,
          codigo: `R${String(n++).padStart(3, "0")}`,
          descripcion,
          unidad: "gl",
          cantidad: 1,
          precioUnit: 0,
        },
      });
    }
  }
}
