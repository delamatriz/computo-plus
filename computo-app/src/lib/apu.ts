import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { resolverCapituloCatalogoId } from "@/lib/capituloCatalogoResolver";
import { buscarSubrubrosPorCapitulos, formatearSubrubrosParaPrompt, type SubrubroConApu } from "@/lib/bibliotecaApus";
import { sumManoObra, calcularPrecioUnitario } from "@/lib/apu-calc";

const client = new Anthropic();

interface ApuGenerado {
  materiales: { descripcion: string; unidad: string; rendimiento: number; precioUnit: number }[];
  manoObra: { categoria: string; rendimiento: number; jornal: number }[];
  // Calculado server-side con calcularPrecioUnitario() sobre el costo
  // directo real de materiales/mano de obra que la IA generó, más
  // gastosGeneralesPct/utilidadPct — nunca es un número que la IA
  // reporte directamente (ver bug histórico: le pedíamos un margen
  // plano de 25% que no coincidía con el 15%/10% que se guarda en el
  // APU, dando un ~1,2% de gap de origen en todo rubro generado por IA).
  precioUnitarioEstimado: number;
  // "biblioteca" si la IA tomó como base un subrubro real de SubrubroEstandar
  // (ver bibliotecaApus.ts); "estimado" si no había ninguno aplicable para
  // el capítulo de este rubro y generó todo con su criterio (MTOP/jornales,
  // comportamiento anterior). subrubroBaseId solo se llena si "biblioteca" —
  // trazabilidad al subrubro real usado, resuelta acá contra la lista
  // realmente consultada (nunca se confía en un id que devuelva la IA).
  origen: "biblioteca" | "estimado";
  subrubroBaseId: string | null;
}

/* ─── Genera y persiste el APU de un rubro vía IA ───────────── */
export async function generarApuParaRubro(
  rubroId: string,
  datos: { descripcion: string; unidad: string; capitulo: string; tipoObra: string }
): Promise<ApuGenerado> {
  const { descripcion, unidad, capitulo, tipoObra } = datos;

  const [rubro, apuExistente, categorias, preciosMTOP, capituloCatalogoId] = await Promise.all([
    db.rubro.findUnique({
      where: { id: rubroId },
      select: {
        trabajoEnAltura: true,
        // Default de GG%/Utilidad% del proyecto — solo se usa si este rubro
        // todavía no tiene un APU propio (ver apuExistente más abajo).
        capitulo: {
          select: {
            proyecto: {
              select: { gastosGeneralesPctDefault: true, utilidadPctDefault: true, modoGastosGenerales: true },
            },
          },
        },
      },
    }),
    db.aPU.findUnique({ where: { rubroId } }),
    db.categoriaLaboral.findMany({ orderBy: { nombre: "asc" } }),
    db.precioMTOP.findMany({ take: 50, orderBy: { descripcion: "asc" } }),
    // Mismo resolver ya usado al crear un capítulo real (Fase 2, Etapa 5) —
    // undefined si el nombre no matchea ningún CapituloCatalogo (alias
    // ambiguo o inexistente). Sin esto no hay dónde buscar subrubros reales
    // para este rubro — cae al comportamiento anterior (estimado).
    resolverCapituloCatalogoId(db, capitulo || ""),
  ]);

  // Subrubros reales de biblioteca para EL capítulo de este rubro (uno
  // solo, a diferencia de calcular-rapido que puede tocar varios) — vacío
  // si capitulo no resolvió a ningún CapituloCatalogo, o si ese capítulo
  // no tiene biblioteca propia (fallback esperado, no error).
  const subrubrosBiblioteca: SubrubroConApu[] = capituloCatalogoId
    ? await buscarSubrubrosPorCapitulos([capituloCatalogoId])
    : [];
  const tablaBiblioteca = formatearSubrubrosParaPrompt(subrubrosBiblioteca);

  const tablaJornales = categorias
    .map((c) => `${c.nombre}: $${c.jornal} UYU/jornada (8hs)`)
    .join("\n");

  const tablaMateriales = preciosMTOP
    .map((p) => `${p.descripcion}: ${p.precioUnitario} UYU/${p.unidad}`)
    .join("\n");

  const notaAltura = rubro?.trabajoEnAltura
    ? "\n\nEste rubro requiere trabajo en altura. Incluir en la mano de obra la categoría Oficial trabajo en altura con el recargo correspondiente."
    : "";

  const prompt = `Rubro: "${descripcion}"
Unidad de medida: ${unidad || "—"}
Capítulo: ${capitulo || "—"}
Tipo de obra: ${tipoObra || "—"}

JORNALES SUNCA VIGENTES (Uruguay 2025):
${tablaJornales}

PRECIOS DE REFERENCIA MTOP (Lista Nº599, Nov 2025, en UYU):
${tablaMateriales}
${
  tablaBiblioteca
    ? `\nSUBRUBROS REALES DE BIBLIOTECA para el capítulo "${capitulo}" (Sociedad de Arquitectos del Uruguay — composiciones y precios reales, preferí SIEMPRE éstos si alguno aplica a este rubro específico, aunque tengas que ajustar cantidades/rendimientos a la escala de "${descripcion}"):\n${tablaBiblioteca}\n`
    : ""
}${notaAltura}

Devolvé SOLO un JSON con esta estructura exacta:
{
  "materiales": [
    { "descripcion": string, "unidad": string, "rendimiento": number, "precioUnit": number }
  ],
  "manoObra": [
    { "categoria": string, "rendimiento": number, "jornal": number }
  ],
  "origen": "biblioteca" | "estimado",
  "subrubroCodigoBase": string | null
}

Reglas:
- "rendimiento" en materiales = cantidad de material por unidad de rubro (ej: 0.35 m³ de arena por m² de revoque).
- "rendimiento" en mano de obra = unidades de rubro producidas por jornada de 8hs (ej: 12 m² de revoque por jornada).
- No calcules ni devuelvas ningún precio unitario final — eso lo calcula el sistema a partir de los materiales y mano de obra que devuelvas.
- Usá precios MTOP cuando el material coincida. Para mano de obra, usá la categoría SUNCA más adecuada.
- Si usaste como base alguno de los SUBRUBROS REALES DE BIBLIOTECA de arriba (aunque hayas ajustado cantidades a la escala de este rubro), marcá "origen": "biblioteca" y poné en "subrubroCodigoBase" el código entre corchetes de ese subrubro (ej. "1.1"). Si no había ninguno aplicable y generaste todo con tu criterio, marcá "origen": "estimado" y "subrubroCodigoBase": null.
- Respondé SOLO con JSON válido, sin texto adicional ni markdown.`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: `Sos un presupuestador experto en construcción uruguaya con 20 años de experiencia.
Generás APU (Análisis de Precios Unitarios) detallados y precisos para cada rubro de obra.
Usás terminología local: ticholo, ladrillo, viga de arriostre, pilar, hormigón, encofrado, mortero común.
Tus APU son realistas, basados en rendimientos reales de obra uruguaya, usando precios MTOP y jornales SUNCA.`,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Respuesta inválida del modelo");

  const apuBruto = JSON.parse(match[0]) as {
    materiales: ApuGenerado["materiales"];
    manoObra: ApuGenerado["manoObra"];
    origen?: string;
    subrubroCodigoBase?: string | null;
  };

  // subrubroBaseId nunca sale directo de lo que devuelve la IA — se resuelve
  // acá contra subrubrosBiblioteca (la lista que REALMENTE se le pasó en el
  // prompt), así que un código inventado o mal copiado por la IA se
  // descarta solo en vez de quedar como una referencia falsa.
  const subrubroBase = apuBruto.subrubroCodigoBase
    ? subrubrosBiblioteca.find((s) => s.codigo === apuBruto.subrubroCodigoBase)
    : undefined;

  // Si el rubro YA tiene un APU guardado, su GG%/Utilidad% queda congelado
  // — regenerar por IA no debe pisarlo con el default vigente del proyecto
  // (ver Proyecto.gastosGeneralesPctDefault). Recién si es la primera vez
  // que este rubro tiene APU se usa el default (0% de GG si el proyecto
  // está en modo Detallado, ver SeccionGastosGeneralesUtilidades).
  const proyectoDefaults = rubro?.capitulo?.proyecto;
  const gastosGeneralesPct = apuExistente
    ? apuExistente.gastosGeneralesPct
    : proyectoDefaults?.modoGastosGenerales === "DETALLADO"
      ? 0
      : proyectoDefaults?.gastosGeneralesPctDefault ?? 15;
  const utilidadPct = apuExistente ? apuExistente.utilidadPct : proyectoDefaults?.utilidadPctDefault ?? 10;

  // precioUnitarioEstimado se calcula acá, NUNCA se toma de lo que reporte
  // la IA — mismo patrón que clonar-apu/route.ts. Este flujo no genera
  // equipos, así que el costo directo es solo materiales + mano de obra.
  const costoDirecto =
    apuBruto.materiales.reduce((s, m) => s + (m.rendimiento ?? 0) * (m.precioUnit ?? 0), 0) +
    sumManoObra(
      apuBruto.manoObra.map((mo) => ({ rendimiento: mo.rendimiento ?? 1, jornalRef: mo.jornal ?? 0 })),
      []
    );
  const precioUnitarioEstimado = calcularPrecioUnitario(costoDirecto, gastosGeneralesPct, utilidadPct);

  const apu: ApuGenerado = {
    materiales: apuBruto.materiales,
    manoObra: apuBruto.manoObra,
    precioUnitarioEstimado,
    origen: apuBruto.origen === "biblioteca" && subrubroBase ? "biblioteca" : "estimado",
    subrubroBaseId: subrubroBase?.id ?? null,
  };

  const apuRecord = apuExistente
    ? await db.aPU.update({ where: { rubroId }, data: { gastosGeneralesPct, utilidadPct } })
    : await db.aPU.create({ data: { rubroId, gastosGeneralesPct, utilidadPct } });

  const apuId = apuRecord.id;

  await db.materialAPU.deleteMany({ where: { apuId } });
  for (let i = 0; i < apu.materiales.length; i++) {
    const m = apu.materiales[i];
    await db.materialAPU.create({
      data: {
        apuId,
        descripcion: m.descripcion ?? "",
        unidad: m.unidad ?? "",
        rendimiento: m.rendimiento ?? 0,
        precioUnit: m.precioUnit ?? 0,
        orden: i,
      },
    });
  }

  await db.manoObraAPU.deleteMany({ where: { apuId } });
  for (let i = 0; i < apu.manoObra.length; i++) {
    const mo = apu.manoObra[i];
    await db.manoObraAPU.create({
      data: {
        apuId,
        categoria: mo.categoria ?? "",
        jornadaHs: 8,
        rendimiento: mo.rendimiento ?? 1,
        jornalRef: mo.jornal ?? 0,
        orden: i,
      },
    });
  }

  await db.rubro.update({
    where: { id: rubroId },
    data: { precioUnit: apu.precioUnitarioEstimado },
  });

  return apu;
}
