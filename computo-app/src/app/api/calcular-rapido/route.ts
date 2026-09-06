import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { clasificarCapitulosBiblioteca, buscarSubrubrosPorCapitulos, formatearSubrubrosParaPrompt } from "@/lib/bibliotecaApus";

const client = new Anthropic();

const TIPOS_LABEL: Record<string, string> = {
  reparaciones: "Reparaciones",
  reforma: "Reforma / Ampliación",
};

export async function POST(request: NextRequest) {
  try {
    const { descripcion, tipo, zona, calidad, moneda, fotos } = await request.json();

    if (!descripcion?.trim()) {
      return NextResponse.json({ error: "sin_descripcion" }, { status: 400 });
    }

    const tipoLabel = TIPOS_LABEL[tipo] ?? tipo;
    const monedaLabel = moneda === "UYU" ? "pesos uruguayos" : "dólares americanos (usar TC 42.5)";

    const [categorias, preciosMTOP, capitulosBiblioteca] = await Promise.all([
      db.categoriaLaboral.findMany({ orderBy: { nombre: "asc" } }),
      db.precioMTOP.findMany({ take: 50, orderBy: { descripcion: "asc" } }),
      clasificarCapitulosBiblioteca(descripcion),
    ]);

    // Subrubros reales de la biblioteca SAU para los capítulos que matchean
    // la descripción — acotado (nunca la biblioteca completa), con su APU
    // real (materiales + mano de obra + equipos), no solo el precio final.
    // Vacío si la descripción no matchea ningún capítulo con biblioteca —
    // ese es el fallback esperado (obra atípica), no un error.
    const subrubrosBiblioteca = await buscarSubrubrosPorCapitulos(capitulosBiblioteca.map((c) => c.id));
    const tablaBiblioteca = formatearSubrubrosParaPrompt(subrubrosBiblioteca);

    const tablaJornales = categorias
      .map((c) => `${c.nombre}: $${c.jornal} UYU/jornada (8hs)`)
      .join("\n");

    const tablaMateriales = preciosMTOP
      .slice(0, 30)
      .map((p) => `${p.descripcion}: ${p.precioUnitario} UYU/${p.unidad}`)
      .join("\n");

    const prompt = `Sos un presupuestador experto en construcción uruguaya con 20 años de experiencia.

JORNALES SUNCA VIGENTES (Uruguay 2025):
${tablaJornales}

PRECIOS DE REFERENCIA MTOP (Lista Nº599, Nov 2025, en UYU):
${tablaMateriales}
${
  tablaBiblioteca
    ? `\nSUBRUBROS REALES DE BIBLIOTECA (Sociedad de Arquitectos del Uruguay — precios y composiciones reales, no estimados). Para cada capítulo que generes, si alguno de estos aplica al trabajo descripto, USALO como base (podés ajustar cantidades/escala a lo que describe la tarea, pero no inventes una composición nueva si ya hay una real que cubre el trabajo):\n${tablaBiblioteca}\n`
    : ""
}
TAREA A PRESUPUESTAR:
Tipo: ${tipoLabel}
Descripción: ${descripcion}
Zona: ${zona} (Interior del país tiene ~10% menos costo de MO)
Calidad: ${calidad}
Moneda solicitada: ${moneda}

Calculá el presupuesto usando los jornales y precios de referencia provistos.
Para mano de obra: usá rendimientos reales uruguayos (ej: colocación de aberturas = 2-3hs/unidad oficial carpintero).
Para materiales: usá los precios MTOP como referencia base.

Devolvé un JSON con esta estructura exacta:
{
  "totalGeneral": number,
  "totalMateriales": number,
  "totalManoObra": number,
  "capitulos": [
    {
      "nombre": string,
      "monto": number,
      "materiales": number,
      "manoObra": number,
      "origen": "biblioteca" | "estimado"
    }
  ],
  "advertencia": "Materiales y mano de obra: estimación de la IA según tu descripción. Gastos Generales, Beneficio e IVA se calculan de forma simple sobre esa estimación, no son una cotización. Para mayor exactitud desarrollá un proyecto completo."
}

${
  fotos?.length
    ? "\nSe adjuntan fotos del lugar/obra. Analizalas para ajustar la estimación (estado actual, materiales existentes, dimensiones aproximadas, complejidad de los trabajos)."
    : ""
}

Reglas:
- Solo incluí los capítulos relevantes para la tarea descripta
- Los montos en ${monedaLabel}
- totalMateriales + totalManoObra debe ser igual a totalGeneral
- Los capítulos son SOLO rubros constructivos reales (materiales + mano de obra de la obra en sí, ej. "Pintura interior", "Reparación de cañería"). NUNCA generes un capítulo llamado "Gastos Generales", "Beneficio", "Utilidad", "IVA" o similar — esos conceptos no van en este JSON, se calculan aparte en la aplicación
- Para cada capítulo: si usaste (aunque sea parcialmente, ajustando cantidades) alguno de los SUBRUBROS REALES DE BIBLIOTECA de arriba, marcá "origen": "biblioteca". Si no había ninguno aplicable para ese capítulo y estimaste con tu criterio usando MTOP/jornales, marcá "origen": "estimado"
- Respondé SOLO con JSON válido, sin texto adicional ni markdown`;

    const content: Anthropic.Messages.ContentBlockParam[] = [
      { type: "text", text: prompt },
    ];

    const MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
    type ImageMediaType = (typeof MEDIA_TYPES)[number];

    if (Array.isArray(fotos)) {
      for (const foto of fotos.slice(0, 5)) {
        if (!foto?.data || !MEDIA_TYPES.includes(foto?.mediaType)) continue;
        content.push({
          type: "image",
          source: {
            type: "base64",
            media_type: foto.mediaType as ImageMediaType,
            data: foto.data,
          },
        });
      }
    }

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      // 4096, no 1024: con la biblioteca real inyectada, la IA tiende a
      // devolver más capítulos (uno por subrubro real que aplica, en vez
      // de agrupar en 3-4 genéricos) — 1024 (y hasta 2048, en una prueba
      // con una tarea multi-dominio real: piscina + invernadero) se
      // quedaban cortos y cortaban el JSON a mitad de un capítulo,
      // rompiendo el parseo.
      max_tokens: 4096,
      messages: [{ role: "user", content }],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Respuesta inválida del modelo");

    const resultado = JSON.parse(match[0]);

    // totalGeneral/totalMateriales/totalManoObra que devuelve la IA son un
    // número "de conjunto" que arma ANTES de haber detallado el desglose
    // (el schema del JSON pide esos campos antes que "capitulos") — cuando
    // hay buena cobertura de biblioteca, el detalle bottom-up (capítulo por
    // capítulo, con precios reales) suele reflejar más ítems de los que ese
    // número de conjunto contempló, y como la generación es secuencial la
    // IA nunca vuelve a corregirlo. Confirmado con repros reales: la brecha
    // varía de corrida en corrida (1.61x, 2.01x, 2.03x con la misma
    // descripción) — no es un valor contado dos veces, es que las dos
    // cifras nunca se cruzan. Fix: la suma real de "capitulos" pasa a ser
    // la única fuente de verdad — nunca se muestra al usuario un total que
    // no coincida con su propio desglose. totalMateriales/totalManoObra se
    // recalculan igual (sumando cada capítulo), no proporcionalmente: en
    // los repros, materiales+manoObra de cada capítulo ya coincide exacto
    // con su propio monto, así que sumarlos da, por construcción, el mismo
    // total recalculado — sin necesidad de prorratear nada.
    if (Array.isArray(resultado.capitulos) && resultado.capitulos.length > 0) {
      const capitulos = resultado.capitulos as { monto?: number; materiales?: number; manoObra?: number; origen?: string }[];
      const num = (v: number | undefined) => (typeof v === "number" ? v : 0);

      const totalRecalculado = capitulos.reduce((s, c) => s + num(c.monto), 0);
      const totalMaterialesRecalculado = capitulos.reduce((s, c) => s + num(c.materiales), 0);
      const totalManoObraRecalculado = capitulos.reduce((s, c) => s + num(c.manoObra), 0);
      const totalBiblioteca = capitulos
        .filter((c) => c.origen === "biblioteca")
        .reduce((s, c) => s + num(c.monto), 0);

      // El totalGeneral crudo de la IA no se descarta silenciosamente — se
      // loguea junto al recalculado para poder monitorear en el futuro qué
      // tan seguido y cuánto difieren, sin tener que reproducir el bug a
      // mano cada vez.
      if (typeof resultado.totalGeneral === "number") {
        const diffPct = resultado.totalGeneral > 0
          ? ((totalRecalculado - resultado.totalGeneral) / resultado.totalGeneral) * 100
          : null;
        console.log(
          "[calcular-rapido] totalGeneral IA vs. recalculado:",
          JSON.stringify({
            totalGeneralIA: resultado.totalGeneral,
            totalRecalculado: Math.round(totalRecalculado * 100) / 100,
            diffPct: diffPct != null ? Math.round(diffPct * 10) / 10 : null,
          })
        );
      }

      resultado.totalGeneral = totalRecalculado;
      resultado.totalMateriales = totalMaterialesRecalculado;
      resultado.totalManoObra = totalManoObraRecalculado;
      resultado.proporcionBiblioteca = totalRecalculado > 0 ? totalBiblioteca / totalRecalculado : 0;
    } else {
      resultado.proporcionBiblioteca = 0;
    }

    return NextResponse.json(resultado);
  } catch (err) {
    console.error("[calcular-rapido]", err);
    return NextResponse.json(
      { error: "Error al calcular la estimación" },
      { status: 500 }
    );
  }
}
