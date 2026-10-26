// Tipos de obra de un proyecto (Proyecto.tipo guarda el id). Única fuente de
// los nombres que se muestran: el formulario de Nuevo proyecto y las tarjetas
// de /proyectos.
export const TIPOS_OBRA = [
  { id: "REPARACIONES", label: "Reparaciones" },
  { id: "REFORMA", label: "Reforma / Ampliación" },
  { id: "VIVIENDA", label: "Vivienda unifamiliar" },
  { id: "PH", label: "Propiedad Horizontal" },
  { id: "COMERCIAL", label: "Local comercial" },
  { id: "INDUSTRIAL", label: "Industrial" },
];

/** Nombre legible del tipo de obra; un id desconocido se muestra tal cual. */
export function nombreTipoObra(id: string): string {
  return TIPOS_OBRA.find((t) => t.id === id)?.label ?? id;
}
