import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";

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

    const [categorias, preciosMTOP] = await Promise.all([
      db.categoriaLaboral.findMany({ orderBy: { nombre: "asc" } }),
      db.precioMTOP.findMany({ take: 50, orderBy: { descripcion: "asc" } }),
    ]);

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
      "manoObra": number
    }
  ],
  "advertencia": "Valores estimativos sin IVA, sin gastos generales ni beneficio del contratista. Para mayor exactitud desarrollá un proyecto completo."
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
      max_tokens: 1024,
      messages: [{ role: "user", content }],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Respuesta inválida del modelo");

    const resultado = JSON.parse(match[0]);

    return NextResponse.json(resultado);
  } catch (err) {
    console.error("[calcular-rapido]", err);
    return NextResponse.json(
      { error: "Error al calcular la estimación" },
      { status: 500 }
    );
  }
}
