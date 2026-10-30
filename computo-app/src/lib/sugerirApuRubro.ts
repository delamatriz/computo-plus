import { crearMensaje } from "@/lib/anthropic-client";
import { db } from "@/lib/db";
import { registrarLogConsumoIA } from "@/lib/logConsumoIA";
import { materialesParaPrompt } from "@/lib/materialesParaPrompt";
import type { ApuSugerido } from "@/lib/rubroCatalogoNuevo";

const normalizar = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
const texto = (v: unknown) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "");
const positivo = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);

/**
 * APU sugerido por IA para un rubro que todavía no existe — lo usa el botón
 * "Sugerir APU" de los formularios de alta (catálogo global en /rubros y Mis
 * rubros). A diferencia de generarApuParaRubro (lib/apu.ts) no guarda nada:
 * devuelve las líneas para llenar el editor, y el usuario las revisa antes
 * de crear el rubro.
 *
 * No devuelve precios: al crear el rubro, cada línea se resuelve contra el
 * catálogo por su descripción, por eso se le pide a la IA que copie la
 * descripción EXACTA de los materiales del catálogo. La categoría de mano de
 * obra se valida contra CategoriaLaboral: una que no exista se descarta.
 */
export async function sugerirApuRubro(
  empresaId: string,
  datos: { nombre: string; descripcion: string; unidad: string }
): Promise<ApuSugerido> {
  const { nombre, descripcion, unidad } = datos;
  const textoRubro = [nombre, descripcion].filter(Boolean).join(". ");

  const [categorias, materiales, equiposCatalogo] = await Promise.all([
    db.categoriaLaboral.findMany({ select: { nombre: true, jornal: true }, orderBy: { nombre: "asc" } }),
    // Materiales base + los relevantes para el rubro — mismo criterio que calcular-rapido.
    materialesParaPrompt(textoRubro),
    // El catálogo de equipos es chico (unas decenas): va entero.
    db.precioEquipo.findMany({ select: { descripcion: true, unidad: true, precioHora: true }, orderBy: { descripcion: "asc" } }),
  ]);
  // La tabla repite nombres (ej. "Oficial albañil" como oficial y como sunca_cat_vii).
  const unicas = [...new Map(categorias.map((c) => [normalizar(c.nombre), c])).values()];

  // Mismo formato que calcular-rapido ("descripción: precio UYU/unidad"): con
  // la unidad entre paréntesis la IA la copiaba como parte de la descripción
  // y el material ya no coincidía con el catálogo.
  const tablaJornales = unicas.map((c) => `- ${c.nombre}: $${c.jornal} UYU/jornada (8 h)`).join("\n");
  const tablaMateriales = materiales.map((m) => `- ${m.descripcion}: ${m.precioUnitario} UYU/${m.unidad}`).join("\n");
  const tablaEquipos = equiposCatalogo.map((e) => `- ${e.descripcion}: ${e.precioHora} UYU/${e.unidad}`).join("\n");

  const prompt = `Rubro: "${nombre}"
Unidad del rubro: ${unidad || "— (elegí la más usual para este rubro)"}
${descripcion ? `Descripción: ${descripcion}\n` : ""}
CATEGORÍAS SUNCA DISPONIBLES (jornales vigentes):
${tablaJornales}

MATERIALES DEL CATÁLOGO (Lista MTOP y proveedores, precios de referencia en UYU):
${tablaMateriales}

EQUIPOS DEL CATÁLOGO (costo de referencia en UYU por unidad):
${tablaEquipos}

Devolvé SOLO un JSON con esta estructura exacta:
{
  "materiales": [{ "descripcion": string, "unidad": string, "cantidad": number }],
  "manoObra": [{ "categoria": string, "rendimiento": number }],
  "equipos": [{ "descripcion": string, "unidad": string, "cantidad": number }]
}

Reglas:
- "cantidad" en materiales y equipos = cantidad por UNA unidad de rubro (ej: 0,035 m³ de arena por m² de revoque; 0,1 día de hormigonera por m³).
- "rendimiento" en mano de obra = unidades de rubro producidas por jornada de 8 h (ej: 12 m² de revoque por jornada).
- "categoria": copiá EXACTAMENTE uno de los nombres de las categorías SUNCA de arriba. No inventes categorías.
- Materiales: si uno del catálogo sirve, copiá su descripción EXACTA, letra por letra (todo lo que está antes de los dos puntos), y usá su unidad. Solo si ninguno sirve, describí uno propio.
- Equipos: solo si el rubro realmente los necesita (hormigonera, andamio, vibrador...); si no, "equipos": []. Mismo criterio que los materiales: preferí los del catálogo, con su descripción exacta y su unidad.
- No devuelvas precios: el sistema los calcula.
- Terminología uruguaya de obra: ticholo, ladrillo, mortero común, hormigón, pilar, viga de arriostre, encofrado.
- Respondé SOLO con JSON válido, sin texto adicional ni markdown.`;

  const message = await crearMensaje({ empresaId, funcion: "sugerir-apu-rubro" }, {
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    // Bajo: el mismo rubro tiene que dar un APU parecido en cada pedido.
    temperature: 0.2,
    system: `Sos un presupuestador experto en construcción uruguaya con 20 años de experiencia.
Generás APU (Análisis de Precios Unitarios) realistas, con rendimientos reales de obra uruguaya, materiales de la Lista MTOP y categorías SUNCA.`,
    messages: [{ role: "user", content: prompt }],
  });

  void registrarLogConsumoIA({
    funcion: "sugerir-apu-rubro",
    empresaId,
    inputTokens: message.usage.input_tokens ?? 0,
    outputTokens: message.usage.output_tokens ?? 0,
  });

  const salida = message.content.find((b) => b.type === "text");
  const match = salida?.type === "text" ? salida.text.match(/\{[\s\S]*\}/) : null;
  if (!match) throw new Error(`Respuesta inválida del modelo (stop_reason: ${message.stop_reason})`);
  const bruto = JSON.parse(match[0]) as Record<string, unknown>;
  const lista = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);

  const categoriaCanonica = new Map(unicas.map((c) => [normalizar(c.nombre), c.nombre]));
  // Descripción tal cual está en el catálogo, para que al crear el rubro la
  // línea resuelva su precio. Si la IA igual le pegó la unidad al final
  // ("Cal hidratada (kg)"), se prueba sin ese paréntesis.
  const canonica = (catalogo: { descripcion: string }[]) => {
    const porNombre = new Map(catalogo.map((c) => [normalizar(c.descripcion), c.descripcion]));
    return (descripcion: string) =>
      porNombre.get(normalizar(descripcion)) ?? porNombre.get(normalizar(descripcion.replace(/\s*\([^()]*\)\s*$/, ""))) ?? descripcion;
  };
  const insumos = (v: unknown, aCatalogo: (d: string) => string) =>
    lista(v)
      .map((l) => ({ descripcion: aCatalogo(texto(l?.descripcion)), unidad: texto(l?.unidad), cantidad: positivo(l?.cantidad) }))
      .filter((l): l is { descripcion: string; unidad: string; cantidad: number } => !!l.descripcion && !!l.unidad && l.cantidad != null);

  return {
    materiales: insumos(bruto.materiales, canonica(materiales)),
    manoObra: lista(bruto.manoObra)
      .map((l) => ({ categoria: categoriaCanonica.get(normalizar(texto(l?.categoria))), rendimiento: positivo(l?.rendimiento) }))
      .filter((l): l is { categoria: string; rendimiento: number } => !!l.categoria && l.rendimiento != null),
    equipos: insumos(bruto.equipos, canonica(equiposCatalogo)),
  };
}
