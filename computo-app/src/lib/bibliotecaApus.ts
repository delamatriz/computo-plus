import { crearMensaje } from "@/lib/anthropic-client";
import { db } from "@/lib/db";
import { precioConRespaldo, resolverPrecioMaterial, resolverPrecioEquipo } from "@/lib/resolverPrecioInsumo";
import { sumManoObra } from "@/lib/apu-calc";
import { registrarLogConsumoIA } from "@/lib/logConsumoIA";
import { raicesDelRubro } from "@/lib/materialesParaPrompt";


export interface SubrubroConApu {
  id: string;
  // De qué biblioteca viene: la global (SubrubroEstandar, default) o la personal de la empresa
  // (SubrubroEmpresa). En la personal, `codigo` es un identificador para el prompt (MB-xxxxxxxx).
  fuente?: "global" | "empresa";
  codigo: string;
  descripcion: string;
  unidad: string;
  precioUY: number;
  // *Referencia: precio fijo de respaldo (ver precioConRespaldo en resolverPrecioInsumo.ts).
  materiales: { descripcion: string; unidad: string; rendimiento: number; precioReferencia: number | null }[];
  manoObra: { categoria: string; rendimiento: number; jornadaHs: number; jornalReferencia: number | null }[];
  equipos: { descripcion: string; unidad: string; rendimiento: number; costoReferencia: number | null }[];
}

/**
 * Clasifica una descripción libre de trabajos contra los CapituloCatalogo
 * que tienen biblioteca real de subrubros (SubrubroEstandar activo) —
 * prompt de clasificación barata (una sola llamada de IA, sin pricing)
 * contra la lista real de capítulos CON biblioteca — no contra una lista
 * amplia con categorías administrativas sin biblioteca propia (Honorarios
 * profesionales, Imprevistos, etc.), que acá no aplican. (Antes existía
 * una ruta aparte de sugerencia de capítulos con una lista más amplia; se
 * eliminó junto con la pestaña "Sugerir con IA" — la sugerencia de
 * capítulos vive en Cálculo Rápido.)
 *
 * Puede devolver varios capítulos (una tarea real casi siempre toca más
 * de uno) o ninguno si la descripción no matchea bien con nada — ese
 * caso es el fallback esperado, no un error.
 */
export async function clasificarCapitulosBiblioteca(
  descripcion: string,
  // Empresa de la sesión: elige la clave de Anthropic (prueba / principal) y
  // va al log de consumo. Obligatorio a propósito: sin default null, que
  // usaría la clave principal para una empresa en prueba.
  empresaId: string | null
): Promise<{ id: string; nombre: string }[]> {
  if (!descripcion?.trim()) return [];

  const capitulos = await db.capituloCatalogo.findMany({
    where: { activo: true, subrubros: { some: { activo: true } } },
    select: { id: true, nombre: true },
    orderBy: { nombre: "asc" },
  });
  if (capitulos.length === 0) return [];

  try {
    const response = await crearMensaje({ empresaId: empresaId, funcion: "calcular-rapido-clasificar" }, {
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      // temperature 0 — este paso es clasificación pura (¿cuáles de esta
      // lista fija de nombres aplican?), no generación libre: no hay
      // ningún motivo para que la misma descripción matchee distinto
      // capítulos entre corridas. Ver diagnóstico de variación de precio
      // en Cálculo Rápido (sep-2026).
      temperature: 0,
      system: `Sos un experto en construcción uruguaya. Dada una descripción de trabajos, elegís TODOS los capítulos relevantes (ninguno, uno o varios) de esta lista — son los únicos que tienen biblioteca de precios real disponible:
${capitulos.map((c) => c.nombre).join(", ")}
Respondé SOLO con JSON: { "capitulos": ["nombre1", "nombre2", ...] }. Si la descripción no matchea bien con ninguno, devolvé un array vacío — no fuerces un capítulo que no aplica.`,
      messages: [{ role: "user", content: descripcion }],
    });
    void registrarLogConsumoIA({
      funcion: "calcular-rapido-clasificar",
      empresaId,
      inputTokens: response.usage.input_tokens ?? 0,
      outputTokens: response.usage.output_tokens ?? 0,
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
          materiales: { select: { descripcion: true, unidad: true, rendimiento: true, precioReferencia: true } },
          manoObra: { select: { categoria: true, rendimiento: true, jornadaHs: true, jornalReferencia: true } },
          equipos: { select: { descripcion: true, unidad: true, rendimiento: true, costoReferencia: true } },
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

const sinTildesNorm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/**
 * Rubros de la biblioteca personal de la empresa (SubrubroEmpresa) que tocan la descripción de
 * la obra, con su APU, ordenados por relevancia del texto (cuántas raíces de la descripción
 * aparecen en el nombre/descripción del rubro; sin ninguna coincidencia no entran). Misma forma
 * que los subrubros globales, para mezclarlos en una sola lista en el prompt de Cálculo Rápido.
 * Es una lista corta por empresa: se filtra en memoria.
 */
export async function buscarSubrubrosEmpresa(
  empresaId: string,
  descripcion: string,
  maximo = 10
): Promise<SubrubroConApu[]> {
  const raices = raicesDelRubro(descripcion);
  if (raices.length === 0) return [];

  const rubros = await db.subrubroEmpresa.findMany({
    where: { empresaId },
    select: {
      id: true,
      nombre: true,
      descripcion: true,
      unidad: true,
      precioUY: true,
      apus: {
        orderBy: { createdAt: "asc" },
        take: 1,
        select: {
          materiales: { select: { descripcion: true, unidad: true, cantidad: true, precioUnit: true, precioReferencia: true } },
          manoObra: { select: { categoria: true, cantidad: true, jornal: true, jornalReferencia: true, jornadasHoras: true } },
          equipos: { select: { descripcion: true, unidad: true, cantidad: true, costoUnit: true, costoReferencia: true } },
        },
      },
    },
  });

  return rubros
    .map((r) => {
      const texto = sinTildesNorm(`${r.nombre} ${r.descripcion ?? ""}`);
      return { r, score: raices.filter((raiz) => texto.includes(raiz)).length };
    })
    .filter((x) => x.score > 0 && x.r.precioUY > 0)
    .sort((a, b) => b.score - a.score || a.r.nombre.localeCompare(b.r.nombre))
    .slice(0, maximo)
    .map(({ r }): SubrubroConApu => {
      const apu = r.apus[0];
      return {
        id: r.id,
        fuente: "empresa",
        codigo: `MB-${r.id.slice(0, 8)}`,
        descripcion: r.nombre,
        unidad: r.unidad,
        precioUY: r.precioUY,
        materiales: (apu?.materiales ?? []).map((m) => ({
          descripcion: m.descripcion,
          unidad: m.unidad,
          rendimiento: m.cantidad,
          precioReferencia: m.precioReferencia ?? m.precioUnit,
        })),
        manoObra: (apu?.manoObra ?? []).map((m) => ({
          categoria: m.categoria,
          rendimiento: m.cantidad,
          jornadaHs: m.jornadasHoras ?? 8,
          jornalReferencia: m.jornalReferencia ?? m.jornal,
        })),
        equipos: (apu?.equipos ?? []).map((e) => ({
          descripcion: e.descripcion,
          unidad: e.unidad,
          rendimiento: e.cantidad,
          costoReferencia: e.costoReferencia ?? e.costoUnit,
        })),
      };
    });
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
/**
 * Resuelve la proporción real materiales/mano de obra/equipos de un
 * subrubro de biblioteca — mismo mecanismo de resolución en vivo que usa
 * /api/subrubros-estandar/[id]/descompuesto (materiales contra PrecioMTOP,
 * mano de obra contra CategoriaLaboral, equipos contra PrecioEquipo por
 * descripción), pero devolviendo solo los 3 totales, no el detalle línea
 * por línea — para poder aplicar esta MISMA proporción real al monto que
 * ya calculó /api/calcular-rapido (cantidad inferida × precioUY real), en
 * vez de dejar que la IA reinvente su propio desglose materiales/mano de
 * obra en cada corrida (ver diagnóstico de variación de precio, sep-2026).
 */
export async function resolverProporcionDesglose(
  subrubro: SubrubroConApu
): Promise<{ materialesTotal: number; manoObraTotal: number; equiposTotal: number } | null> {
  if (subrubro.materiales.length === 0 && subrubro.manoObra.length === 0 && subrubro.equipos.length === 0) {
    return null;
  }

  let materialesTotal = 0;
  for (const m of subrubro.materiales) {
    const precioMTOP = await resolverPrecioMaterial(m.descripcion);
    materialesTotal += m.rendimiento * precioConRespaldo(precioMTOP?.precioUnitario, m.precioReferencia).precio;
  }

  const categoriasLaborales = await db.categoriaLaboral.findMany();
  const jornalPorNombre = (nombre: string) =>
    categoriasLaborales.find((c) => c.nombre.trim().toLowerCase() === nombre.trim().toLowerCase())?.jornal ?? 0;
  const manoObraTotal = sumManoObra(
    subrubro.manoObra.map((mo) => ({ rendimiento: mo.rendimiento, jornalRef: precioConRespaldo(jornalPorNombre(mo.categoria), mo.jornalReferencia).precio })),
    []
  );

  let equiposTotal = 0;
  for (const eq of subrubro.equipos) {
    const precioEquipo = await resolverPrecioEquipo(eq.descripcion);
    equiposTotal += eq.rendimiento * precioConRespaldo(precioEquipo?.precioHora, eq.costoReferencia).precio;
  }

  return { materialesTotal, manoObraTotal, equiposTotal };
}

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
        `[${s.codigo}] ${s.fuente === "empresa" ? "(MI BIBLIOTECA) " : ""}${s.descripcion} — ${s.unidad} — $${s.precioUY} UY\n` +
        `  Materiales:\n${mats || "    (ninguno)"}\n` +
        `  Mano de obra:\n${mo || "    (ninguna)"}` +
        (eq ? `\n  Equipos:\n${eq}` : "")
      );
    })
    .join("\n\n");
}
