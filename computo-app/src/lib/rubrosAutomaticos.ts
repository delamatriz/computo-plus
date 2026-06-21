import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { generarApuParaRubro } from "@/lib/apu";

const client = new Anthropic();

interface RubroSugerido {
  capitulo: string;
  descripcion: string;
  unidad: string;
}

export interface CapituloConMonto {
  nombre: string;
  monto: number;
}

/* ─── Genera rubros principales por capítulo a partir de la descripción
   de trabajos del Cálculo Rápido, y dispara el APU de cada uno.
   Pensada para ejecutarse en background (no se espera su resolución).
   Si se pasan capitulosConMontos (del desglose de Cálculo Rápido), se
   incluyen como contexto de precios para que la IA los use de referencia. ── */
export async function generarRubrosAutomaticos(
  proyectoId: string,
  capitulosConMontos?: CapituloConMonto[]
): Promise<void> {
  try {
    await generarRubrosAutomaticosInterno(proyectoId, capitulosConMontos);
  } finally {
    await db.proyecto.update({
      where: { id: proyectoId },
      data: { generandoRubros: false },
    }).catch((err) => console.error("[rubrosAutomaticos] no se pudo limpiar generandoRubros", err));
  }
}

async function generarRubrosAutomaticosInterno(
  proyectoId: string,
  capitulosConMontos?: CapituloConMonto[]
): Promise<void> {
  const proyecto = await db.proyecto.findUnique({
    where: { id: proyectoId },
    include: { capitulos: true },
  });

  if (!proyecto || !proyecto.descripcion?.trim() || proyecto.capitulos.length === 0) return;

  const listaCapitulos = proyecto.capitulos.map((c) => c.nombre).join(", ");

  const contextoMontos =
    capitulosConMontos && capitulosConMontos.length > 0
      ? `\n\nLos montos estimados por capítulo son:\n${capitulosConMontos
          .map((c) => `- ${c.nombre}: $${Math.round(c.monto).toLocaleString("es-UY")}`)
          .join("\n")}\nUsá estos montos como referencia: el precio unitario × cantidad de los rubros que generes para cada capítulo debería aproximarse al monto indicado para ese capítulo.`
      : "";

  const prompt = `Dado este presupuesto de obra tipo ${proyecto.tipo} con la siguiente descripción de trabajos: '${proyecto.descripcion}', y estos capítulos: ${listaCapitulos}, sugerí los 2-3 rubros más importantes para cada capítulo, con descripción y unidad de medida. Basate en prácticas constructivas uruguayas.${contextoMontos}
Para la unidad: si el rubro es de estimación global usá unidad "gl", si tiene medida clara (superficie, volumen, longitud) usá m², m³ o ml.
Respondé SOLO con JSON:
{ "rubros": [{ "capitulo": string, "descripcion": string, "unidad": string }] }`;

  let sugerencias: RubroSugerido[] = [];
  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });
    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Respuesta inválida del modelo");
    const data = JSON.parse(match[0]) as { rubros: RubroSugerido[] };
    sugerencias = data.rubros ?? [];
  } catch (err) {
    console.error("[rubrosAutomaticos] sugerencia de rubros", err);
    return;
  }

  for (const sugerido of sugerencias) {
    const capitulo = proyecto.capitulos.find(
      (c) => c.nombre.toLowerCase() === sugerido.capitulo?.toLowerCase()
    ) ?? proyecto.capitulos.find((c) =>
      c.nombre.toLowerCase().includes(sugerido.capitulo?.toLowerCase() ?? "__") ||
      (sugerido.capitulo ?? "").toLowerCase().includes(c.nombre.toLowerCase())
    );
    if (!capitulo || !sugerido.descripcion?.trim()) continue;

    try {
      const ultimo = await db.rubro.findFirst({
        where: { capituloId: capitulo.id },
        orderBy: { createdAt: "desc" },
        select: { codigo: true },
      });
      const n = ultimo ? parseInt(ultimo.codigo.replace(/\D/g, "") || "0") + 1 : 1;

      const rubro = await db.rubro.create({
        data: {
          capituloId: capitulo.id,
          codigo: `R${String(n).padStart(3, "0")}`,
          descripcion: sugerido.descripcion.trim(),
          unidad: sugerido.unidad?.trim() || "gl",
          cantidad: 1,
          precioUnit: 0,
        },
      });

      await generarApuParaRubro(rubro.id, {
        descripcion: rubro.descripcion,
        unidad: rubro.unidad,
        capitulo: capitulo.nombre,
        tipoObra: proyecto.tipo,
      });
    } catch (err) {
      console.error("[rubrosAutomaticos] error generando rubro", sugerido, err);
    }
  }
}
