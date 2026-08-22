import { db } from "@/lib/db";

const NOMBRE_CAPITULO = "Seguridad y Trabajos en Altura";

// Rubros fijos, sin modalidad — la maquinaria puntual (andamios, grúa,
// balancín, silleta) se carga en el Equipo del APU de cada rubro que la
// use, no acá. Este capítulo es solo la documentación/administrativo del
// Plan y Estudio de Seguridad.
const DESCRIPCIONES_FIJAS = [
  "Estudio y plan de seguridad",
  "Memoria de instalación eléctrica de obra",
  "Señalización y vallado perimetral de obra",
];

/* ─── Crea el capítulo de seguridad y sus rubros fijos para cada Título
   del proyecto que tenga requierePlanSeguridad=true. Idempotente por
   título: uno ya generado no bloquea ni afecta a los demás. Pensada para
   ejecutarse luego de crear/editar el proyecto. ── */
export async function generarCapituloSeguridad(proyectoId: string): Promise<void> {
  const proyecto = await db.proyecto.findUnique({
    where: { id: proyectoId },
    include: { capitulos: true, titulos: true },
  });

  if (!proyecto) return;

  const titulosQueNecesitan = proyecto.titulos.filter((t) => t.requierePlanSeguridad);
  if (titulosQueNecesitan.length === 0) return;

  // Fase 2, Etapa 7 — "Seguridad y Trabajos en Altura" no tiene biblioteca
  // propia (sus rubros siempre se arman a mano acá abajo), pero SÍ tiene
  // fila en CapituloCatalogo desde esta etapa, solo para poder resolver
  // capituloCatalogoId. La idempotencia se chequea por las DOS señales
  // (capituloCatalogoId Y nombre string) para no duplicar capítulos ya
  // creados antes de esta migración, que quedaron con capituloCatalogoId
  // null.
  const capituloCatalogo = await db.capituloCatalogo.findUnique({ where: { nombre: NOMBRE_CAPITULO } });
  if (!capituloCatalogo) {
    console.warn(
      `[generarCapituloSeguridad] Sin CapituloCatalogo para "${NOMBRE_CAPITULO}" — se crea sin capituloCatalogoId`
    );
  }

  const yaExisteEn = (capitulos: typeof proyecto.capitulos) =>
    capitulos.some(
      (c) =>
        (capituloCatalogo && c.capituloCatalogoId === capituloCatalogo.id) ||
        c.nombre.toLowerCase() === NOMBRE_CAPITULO.toLowerCase()
    );

  // Contador de orden compartido entre todos los capítulos que se creen en
  // esta misma llamada (uno por título) — arranca del máximo existente,
  // igual que el POST de "Agregar capítulo", e incrementa uno por uno para
  // que nunca se pisen entre sí.
  let orden = proyecto.capitulos.length > 0
    ? Math.max(...proyecto.capitulos.map((c) => c.orden)) + 1
    : 1;

  for (const titulo of titulosQueNecesitan) {
    const capitulosDelTitulo = proyecto.capitulos.filter((c) => c.tituloId === titulo.id);
    if (yaExisteEn(capitulosDelTitulo)) continue;

    const miOrden = orden++;
    await db.capitulo.create({
      data: {
        proyectoId,
        tituloId: titulo.id,
        nombre: NOMBRE_CAPITULO,
        codigo: String(miOrden).padStart(2, "0"),
        color: "#DC2626",
        orden: miOrden,
        capituloCatalogoId: capituloCatalogo?.id,
        rubros: {
          create: DESCRIPCIONES_FIJAS.map((descripcion, i) => ({
            codigo: `R${String(i + 1).padStart(3, "0")}`,
            descripcion,
            unidad: "gl",
            cantidad: 1,
            precioUnit: 0,
          })),
        },
      },
    });
  }
}
