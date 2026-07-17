import { db } from "@/lib/db";

const NOMBRE_CAPITULO = "Seguridad y Trabajos en Altura";

/* ─── Crea el capítulo de seguridad y sus rubros predefinidos según la
   modalidad de trabajo en altura declarada en el proyecto. Pensada para
   ejecutarse luego de crear el proyecto, solo si requierePlanSeguridad
   está activo. Es idempotente: si el capítulo ya existe, no hace nada. ── */
export async function generarCapituloSeguridad(proyectoId: string): Promise<void> {
  const proyecto = await db.proyecto.findUnique({
    where: { id: proyectoId },
    include: { capitulos: true },
  });

  if (!proyecto || !proyecto.requierePlanSeguridad) return;

  // Fase 2, Etapa 7 — "Seguridad y Trabajos en Altura" no tiene biblioteca
  // propia (sus rubros siempre se arman a mano acá abajo), pero SÍ tiene
  // fila en CapituloCatalogo desde esta etapa, solo para poder resolver
  // capituloCatalogoId. La idempotencia se chequea por las DOS señales
  // (capituloCatalogoId Y nombre string) para no duplicar capítulos ya
  // creados antes de esta migración, que quedaron con capituloCatalogoId
  // null.
  const capituloCatalogo = await db.capituloCatalogo.findUnique({ where: { nombre: NOMBRE_CAPITULO } });

  const yaExiste = proyecto.capitulos.some(
    (c) =>
      (capituloCatalogo && c.capituloCatalogoId === capituloCatalogo.id) ||
      c.nombre.toLowerCase() === NOMBRE_CAPITULO.toLowerCase()
  );
  if (yaExiste) return;

  const modalidades = (proyecto.modalidadAltura ?? "").split(",").map((m) => m.trim());
  const tiene = (m: string) => modalidades.includes(m);

  const descripciones: string[] = [
    "Estudio y plan de seguridad",
    ...(tiene("andamios") || tiene("combinacion") ? ["Memoria descriptiva de andamios"] : []),
    "Memoria de instalación eléctrica de obra",
    "Señalización y vallado perimetral de obra",
    ...(tiene("andamios") || tiene("combinacion") ? ["Alquiler y montaje de andamio tubular"] : []),
    ...(tiene("balancin") ? ["Alquiler de balancín con operario calificado"] : []),
    ...(tiene("silleta") ? ["Trabajo en silleta — operario especializado"] : []),
    ...(tiene("grua") ? ["Alquiler de grúa torre con maquinista"] : []),
  ];

  const orden = proyecto.capitulos.length > 0
    ? Math.max(...proyecto.capitulos.map((c) => c.orden)) + 1
    : 1;

  if (!capituloCatalogo) {
    console.warn(
      `[generarCapituloSeguridad] Sin CapituloCatalogo para "${NOMBRE_CAPITULO}" — se crea sin capituloCatalogoId`
    );
  }

  await db.capitulo.create({
    data: {
      proyectoId,
      nombre: NOMBRE_CAPITULO,
      codigo: String(orden).padStart(2, "0"),
      color: "#DC2626",
      orden,
      capituloCatalogoId: capituloCatalogo?.id,
      rubros: {
        create: descripciones.map((descripcion, i) => ({
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
