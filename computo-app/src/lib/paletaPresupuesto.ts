// Paleta pastel de la jerarquía del presupuesto (modo claro), definida por
// Luis en oct-2026. Un solo lugar para los colores de cada nivel: la tabla de
// la pestaña Presupuesto (título › capítulo › rubro › subtotal), la tarjeta
// "Precio Final" (total del presupuesto) y, con el mismo criterio, la pestaña
// Gestión de Obra (bloque = título, tarjeta = capítulo).
//
// Las clases van como literales completos (Tailwind 4 las detecta en este
// archivo); los hex sueltos son para estilos inline (fondos de columnas
// sticky, bordes laterales).

export const PALETA = {
  // Encabezado de la tabla ("PRESUPUESTO" + "Agregar título") — azul profundo
  encabezadoFondo: "#4A7FA8",
  encabezadoTexto: "#FFFFFF",
  encabezadoAccion: "text-white hover:text-white/80",

  // Títulos — azul hielo
  tituloFondo: "#D6E4F0",
  tituloTexto: "#1A3A5C",
  tituloBorde: "#A8C4DC",
  tituloFila: "bg-[#D6E4F0] hover:bg-[#CADCEB]",
  tituloTextoSecundario: "text-[#1A3A5C]/60",

  // Capítulos — verde salvia
  capituloFondo: "#E8F3EC",
  capituloTexto: "#1D4435",
  capituloFila: "bg-[#E8F3EC] hover:bg-[#DDEDE3]",
  capituloBordeClase: "border-[#CFE3D6]",
  capituloTextoClase: "text-[#1D4435]",
  capituloTextoSecundario: "text-[#1D4435]/60",

  // Rubros — blanco limpio
  rubroFondo: "#FFFFFF",

  // Subtotales — arena cálido
  subtotalFondo: "#FFF8EE",
  subtotalTexto: "#5C3D0A",
  subtotalFila: "bg-[#FFF8EE] border-[#F1E2C6]",
  subtotalTextoClase: "text-[#5C3D0A]",

  // Total del presupuesto — azul medio
  totalFondo: "#4A7FA8",
  totalTexto: "#FFFFFF",
} as const;
