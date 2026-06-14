import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const TIPOS_LABEL: Record<string, string> = {
  REPARACIONES: "Reparaciones",
  REFORMA: "Reforma / Ampliación",
  VIVIENDA: "Vivienda unifamiliar",
  PH: "Propiedad Horizontal",
  COMERCIAL: "Local comercial",
  INDUSTRIAL: "Industrial",
};

const MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type ImageMediaType = (typeof MEDIA_TYPES)[number];

export async function POST(request: NextRequest) {
  try {
    const { tipo, descripcion, fotos } = await request.json();

    if (!descripcion?.trim()) {
      return NextResponse.json({ error: "sin_descripcion" }, { status: 400 });
    }

    const tipoLabel = TIPOS_LABEL[tipo] ?? tipo;

    const fotosTexto = Array.isArray(fotos) && fotos.length
      ? "\nSe adjuntan fotos del lugar/obra. Analizalas junto con la descripción de texto para sugerir capítulos más precisos (estado actual, alcance de los trabajos, complejidad)."
      : "";

    const content: Anthropic.Messages.ContentBlockParam[] = [
      {
        type: "text",
        text: `Tipo de obra: ${tipoLabel}. Trabajos: ${descripcion}${fotosTexto}`,
      },
    ];

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

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: `Sos un experto en construcción uruguaya. El usuario te da el tipo de obra y una descripción de los trabajos a realizar. Devolvés SOLO un JSON con la lista de capítulos recomendados en orden lógico de ejecución, seleccionados de esta lista disponible:
Trabajos preliminares, Movimiento de tierra y fundaciones, Estructura, Mampostería y muros, Cubierta, Revoques y enlucidos, Revestimientos y pisos, Carpintería, Instalación sanitaria, Instalación eléctrica, Instalación de gas, Instalaciones embutidas, Calefacción, Pintura, Vidriería, Herrería y metálica, Obras exteriores y paisajismo, Honorarios profesionales, Imprevistos.
Responde SOLO con JSON válido, sin texto adicional: { "capitulos": ["nombre1", "nombre2", ...] }`,
      messages: [
        {
          role: "user",
          content,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "{}";

    // Extraer JSON aunque venga con texto extra
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Respuesta inválida de la IA");

    const data = JSON.parse(match[0]);

    return NextResponse.json(data);
  } catch (err) {
    console.error("[sugerir-capitulos]", err);
    return NextResponse.json(
      { error: "Error al consultar la IA" },
      { status: 500 }
    );
  }
}
