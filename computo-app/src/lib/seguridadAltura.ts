import { db } from "@/lib/db";

const NOMBRE_CAPITULO = "Seguridad y Trabajos en Altura";

function descripcionesPara(modalidadAltura: string | null): string[] {
  const modalidades = (modalidadAltura ?? "").split(",").map((m) => m.trim());
  const tiene = (m: string) => modalidades.includes(m);

  return [
    "Estudio y plan de seguridad",
    ...(tiene("andamios") || tiene("combinacion") ? ["Memoria descriptiva de andamios"] : []),
    "Memoria de instalación eléctrica de obra",
    "Señalización y vallado perimetral de obra",
    ...(tiene("andamios") || tiene("combinacion") ? ["Alquiler y montaje de andamio tubular"] : []),
    ...(tiene("balancin") ? ["Alquiler de balancín con operario calificado"] : []),
    ...(tiene("silleta") ? ["Trabajo en silleta — operario especializado"] : []),
    ...(tiene("grua") ? ["Alquiler de grúa torre con maquinista"] : []),
  ];
}

/* ─── Crea el capítulo de seguridad y sus rubros predefinidos según la
   modalidad de trabajo en altura declarada — a nivel de proyecto (para
   capítulos sueltos) Y a nivel de cada título que lo tenga marcado (con su
   propia modalidad, ver Titulo.requierePlanSeguridad/modalidadAltura).
   Pensada para ejecutarse luego de crear/editar el proyecto. Es idempotente
   en cada bucket por separado: el capítulo suelto no bloquea ni es
   bloqueado por el de un título, y un título ya generado no afecta a los
   demás. ── */
export async function generarCapituloSeguridad(proyectoId: string): Promise<void> {
  const proyecto = await db.proyecto.findUnique({
    where: { id: proyectoId },
    include: { capitulos: true, titulos: true },
  });

  if (!proyecto) return;

  const titulosQueNecesitan = proyecto.titulos.filter((t) => t.requierePlanSeguridad);
  if (!proyecto.requierePlanSeguridad && titulosQueNecesitan.length === 0) return;

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
  // esta misma llamada (el suelto + uno por título) — arranca del máximo
  // existente, igual que el POST de "Agregar capítulo", e incrementa uno
  // por uno para que nunca se pisen entre sí.
  let orden = proyecto.capitulos.length > 0
    ? Math.max(...proyecto.capitulos.map((c) => c.orden)) + 1
    : 1;

  async function crear(tituloId: string | null, modalidadAltura: string | null) {
    const miOrden = orden++;
    await db.capitulo.create({
      data: {
        proyectoId,
        tituloId,
        nombre: NOMBRE_CAPITULO,
        codigo: String(miOrden).padStart(2, "0"),
        color: "#DC2626",
        orden: miOrden,
        capituloCatalogoId: capituloCatalogo?.id,
        rubros: {
          create: descripcionesPara(modalidadAltura).map((descripcion, i) => ({
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

  if (proyecto.requierePlanSeguridad) {
    const capitulosSueltos = proyecto.capitulos.filter((c) => c.tituloId == null);
    if (!yaExisteEn(capitulosSueltos)) {
      await crear(null, proyecto.modalidadAltura);
    }
  }

  for (const titulo of titulosQueNecesitan) {
    const capitulosDelTitulo = proyecto.capitulos.filter((c) => c.tituloId === titulo.id);
    if (!yaExisteEn(capitulosDelTitulo)) {
      await crear(titulo.id, titulo.modalidadAltura);
    }
  }
}
