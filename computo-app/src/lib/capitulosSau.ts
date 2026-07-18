// Mapeo entre nombres de capítulo del proyecto y capítulos/subcapítulos del
// rubrado SAU ago. 2022. Cada entrada admite varios alias porque distintos
// proyectos nombran los capítulos de forma distinta (ej: "Pisos, Zócalos y
// Revestimientos" vs "Revestimientos y pisos").
//
// Fase 2, Etapa 5 — movido de src/app/proyectos/[id]/page.tsx a un módulo
// compartido para que tanto el cliente (abrirSubrubrosPanel, como red de
// seguridad cuando Capitulo.capituloCatalogoId es null) como el servidor
// (resolución de capituloCatalogoId al crear un capítulo — ver
// capituloCatalogoResolver.ts) usen la MISMA copia, sin riesgo de que se
// desincronicen. CAPITULOS_SAU en sí no se recorta en esta etapa — sigue
// intacto como fallback; el switch de runtime por capituloCatalogoId +
// ParticionSubcapitulo es el camino primario ahora (ver
// FASE2-DISENO-UNIFICACION-TAXONOMIAS.md).
export type MapeoSAU = { alias: string[]; capitulos: string[]; subcapitulos?: string[]; excluirSubcapitulos?: string[] };

const MUROS_SUBCAPS = [
  "Elevación de Muros — Ladrillo de Campo",
  "Elevación de Muros — Ticholos",
  "Elevación de Muros — Bloque Hormigón",
  "Elevación de Muros — Ladrillo de Vidrio",
];
const REVOQUES_SUBCAPS = [
  "Revoques — Cielorraso",
  "Revoques — Muros Interiores",
  "Revoques — Muros Exteriores",
  "Revoques — Otros",
];
const PISOS_SUBCAPS = ["Pisos, Zócalos y Otros", "Revestimientos", "Contrapisos"];

export const CAPITULOS_SAU: MapeoSAU[] = [
  { alias: ["Implantación y Replanteo", "Trabajos preliminares"], capitulos: ["Implantación y Replanteo"] },
  { alias: ["Excavaciones y Movimiento de Tierra"], capitulos: ["Excavaciones y Movimientos de Tierra"] },
  { alias: ["Movimiento de tierra y fundaciones"], capitulos: ["Excavaciones y Movimientos de Tierra", "Cimentaciones"] },
  { alias: ["Demoliciones y Picados", "Picado de mamposteria", "Picado de mampostería"], capitulos: ["Demoliciones"] },
  { alias: ["Cimentaciones"], capitulos: ["Cimentaciones"] },
  { alias: ["Estructura de Hormigón Armado", "Estructura"], capitulos: ["Estructura"] },
  // Albañilería "paraguas": todo lo que NO esté reclamado por Pisos/
  // Revestimientos — el único recorte que coexiste con "Albañilería" como
  // capítulo de proyecto aparte dentro de un mismo proyecto (ver HOGAR).
  // Impermeabilizaciones y Aislaciones dejó de ser un recorte de este
  // paraguas — pasó a ser su propio CapituloCatalogo standalone (ver
  // expansión de biblioteca Impermeabilización/Vidrios, 18/07/2026).
  // Muros y Revoques NO se excluyen acá: "Mampostería y muros"/"Revoques
  // y enlucidos" son nombres alternativos que usan proyectos que NO usan
  // "Albañilería" combinado (nunca coexisten los dos en un mismo
  // proyecto), así que deben seguir viéndose en el paraguas para los
  // proyectos que sí usan el capítulo combinado.
  // subcapitulos NO se lista a mano acá — se resuelve dinámicamente contra
  // lo que exista en SubrubroEstandar (ver obtenerMapeoSAU/abrirSubrubrosPanel)
  // para que un subcapítulo nuevo (ej. Aberturas, Adherencia, Membranas,
  // Patología de Fachada) aparezca solo sin tener que tocar este archivo.
  { alias: ["Albañilería"], capitulos: ["Albañilería"], excluirSubcapitulos: PISOS_SUBCAPS },
  { alias: ["Mampostería y muros"], capitulos: ["Albañilería"], subcapitulos: MUROS_SUBCAPS },
  { alias: ["Revoques y enlucidos"], capitulos: ["Albañilería"], subcapitulos: REVOQUES_SUBCAPS },
  { alias: ["Pisos, Zócalos y Revestimientos", "Revestimientos y pisos"], capitulos: ["Albañilería"], subcapitulos: PISOS_SUBCAPS },
  { alias: ["Impermeabilizaciones y Aislaciones"], capitulos: ["Impermeabilizaciones y Aislaciones"] },
  { alias: ["Pinturas", "Pintura"], capitulos: ["Subcontratos - Pinturas"] },
  { alias: ["Carpintería"], capitulos: ["Subcontratos - Carpinterías"] },
  { alias: ["Herrería y metálica", "Herrería y metalica"], capitulos: ["Subcontratos - Carpinterías"], subcapitulos: ["Hierro"] },
  { alias: ["Vidrios y Espejos", "Vidriería"], capitulos: ["Subcontratos - Vidrios"] },
  { alias: ["Yeso y Cielorrasos"], capitulos: ["Subcontratos - Yeso"] },
  { alias: ["Sistemas Constructivos No Tradicionales"], capitulos: ["Sistemas No Tradicionales"] },
  // "Subcontratos - Acondicionamientos" se reparte por subcapítulo entre
  // dos capítulos de proyecto distintos — antes mostraban el balde
  // completo mezclado (equipamiento de baño/cocina junto con césped/
  // piscina/deck), ver auditoría 15/07/2026.
  { alias: ["Equipamiento"], capitulos: ["Subcontratos - Acondicionamientos"], subcapitulos: ["Equipamiento"] },
  { alias: ["Obras exteriores y paisajismo", "Obra Exterior / Jardín", "Obra Exterior y Jardín"], capitulos: ["Subcontratos - Acondicionamientos"], subcapitulos: ["Obra Exterior / Jardín"] },
  { alias: ["Cubierta / Techos", "Cubierta"], capitulos: ["Cubierta / Techos"] },
  { alias: ["Instalación Sanitaria"], capitulos: ["Instalación Sanitaria"] },
  { alias: ["Instalación Eléctrica"], capitulos: ["Instalación Eléctrica"] },
  { alias: ["Instalación Térmica / Aire Acondicionado", "Instalación Térmica"], capitulos: ["Instalación Térmica / Aire Acondicionado"] },
  { alias: ["Ascensor"], capitulos: ["Ascensor"] },
];

export function obtenerMapeoSAU(nombreCapitulo: string): { capitulos: string[]; subcapitulos?: string[]; excluirSubcapitulos?: string[] } | undefined {
  const norm = nombreCapitulo.trim().toLowerCase();
  const entrada = CAPITULOS_SAU.find((m) => m.alias.some((a) => a.toLowerCase() === norm));
  return entrada
    ? { capitulos: entrada.capitulos, subcapitulos: entrada.subcapitulos, excluirSubcapitulos: entrada.excluirSubcapitulos }
    : undefined;
}
