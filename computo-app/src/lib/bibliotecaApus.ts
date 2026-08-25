import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";

const client = new Anthropic();

export interface SubrubroConApu {
  id: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  precioUY: number;
  materiales: { descripcion: string; unidad: string; rendimiento: number }[];
  manoObra: { categoria: string; rendimiento: number; jornadaHs: number }[];
  equipos: { descripcion: string; unidad: string; rendimiento: number }[];
}

/**
 * Clasifica una descripción libre de trabajos contra los CapituloCatalogo
 * que tienen biblioteca real de subrubros (SubrubroEstandar activo) —
 * mismo patrón de prompt de clasificación barata que ya usa
 * /api/sugerir-capitulos (una sola llamada de IA, sin pricing), pero
 * contra la lista real de capítulos CON biblioteca — sugerir-capitulos
 * usa una lista más amplia de 16 nombres que incluye categorías
 * administrativas sin biblioteca propia (Honorarios profesionales,
 * Imprevistos, etc.), que acá no aplican.
 *
 * Puede devolver varios capítulos (una tarea real casi siempre toca más
 * de uno) o ninguno si la descripción no matchea bien con nada — ese
 * caso es el fallback esperado, no un error.
 */
export async function clasificarCapitulosBiblioteca(
  descripcion: string
): Promise<{ id: string; nombre: string }[]> {
  if (!descripcion?.trim()) return [];

  const capitulos = await db.capituloCatalogo.findMany({
    where: { activo: true, subrubros: { some: { activo: true } } },
    select: { id: true, nombre: true },
    orderBy: { nombre: "asc" },
  });
  if (capitulos.length === 0) return [];

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: `Sos un experto en construcción uruguaya. Dada una descripción de trabajos, elegís TODOS los capítulos relevantes (ninguno, uno o varios) de esta lista — son los únicos que tienen biblioteca de precios real disponible:
${capitulos.map((c) => c.nombre).join(", ")}
Respondé SOLO con JSON: { "capitulos": ["nombre1", "nombre2", ...] }. Si la descripción no matchea bien con ninguno, devolvé un array vacío — no fuerces un capítulo que no aplica.`,
      messages: [{ role: "user", content: descripcion }],
    });
    const text = response.content[0].type === "text" ? response.content[0].text : "{}";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return [];
    const data = JSON.parse(match[0]) as { capitulos?: string[] };
    const elegidos = new Set((data.capitulos ?? []).map((n) => n.toLowerCase().trim()));
    return capitulos.filter((c) => elegidos.has(c.nombre.toLowerCase().trim()));
  } catch (err) {
    console.error("[clasificarCapitulosBiblioteca]", err);
    return [];
  }
}

/**
 * Trae los subrubros reales (con su APU completo — materiales, mano de
 * obra, equipos) de los capítulos dados. Siempre acotado a esos
 * capítulos, nunca la biblioteca completa (401 items) — el capítulo más
 * grande hoy tiene 78, manejable en un prompt.
 */
export async function buscarSubrubrosPorCapitulos(capituloIds: string[]): Promise<SubrubroConApu[]> {
  if (capituloIds.length === 0) return [];

  const subrubros = await db.subrubroEstandar.findMany({
    where: { activo: true, capituloId: { in: capituloIds } },
    select: {
      id: true,
      codigo: true,
      descripcion: true,
      unidad: true,
      precioUY: true,
      apuEstandar: {
        select: {
          materiales: { select: { descripcion: true, unidad: true, rendimiento: true } },
          manoObra: { select: { categoria: true, rendimiento: true, jornadaHs: true } },
          equipos: { select: { descripcion: true, unidad: true, rendimiento: true } },
        },
      },
    },
    orderBy: { descripcion: "asc" },
  });

  return subrubros.map((s) => ({
    id: s.id,
    codigo: s.codigo,
    descripcion: s.descripcion,
    unidad: s.unidad,
    precioUY: s.precioUY,
    materiales: s.apuEstandar?.materiales ?? [],
    manoObra: s.apuEstandar?.manoObra ?? [],
    equipos: s.apuEstandar?.equipos ?? [],
  }));
}

/**
 * Convierte la lista de subrubros reales en el bloque de texto que se
 * inserta en el prompt de pricing — un subrubro por bloque, con su
 * desglose real de materiales/mano de obra/equipos (no solo el precio
 * total), para que la IA pueda tomar la composición real, no solo el
 * número final. El código entre corchetes ([1.1]) es lo que la IA debe
 * devolver para trazar qué subrubro real usó como base — nunca su
 * descripción libre, que no es un identificador confiable.
 */
export function formatearSubrubrosParaPrompt(subrubros: SubrubroConApu[]): string {
  if (subrubros.length === 0) return "";
  return subrubros
    .map((s) => {
      const mats = s.materiales
        .map((m) => `    · ${m.descripcion}: ${m.rendimiento} ${m.unidad} por ${s.unidad}`)
        .join("\n");
      const mo = s.manoObra
        .map((m) => `    · ${m.categoria}: ${m.rendimiento} ${s.unidad} por jornada de ${m.jornadaHs}hs`)
        .join("\n");
      const eq = s.equipos
        .map((e) => `    · ${e.descripcion}: ${e.rendimiento} ${e.unidad} por ${s.unidad}`)
        .join("\n");
      return (
        `[${s.codigo}] ${s.descripcion} — ${s.unidad} — $${s.precioUY} UY\n` +
        `  Materiales:\n${mats || "    (ninguno)"}\n` +
        `  Mano de obra:\n${mo || "    (ninguna)"}` +
        (eq ? `\n  Equipos:\n${eq}` : "")
      );
    })
    .join("\n\n");
}
