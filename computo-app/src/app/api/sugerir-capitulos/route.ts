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
      // Fase 2, Etapa 7 — nombres canónicos exactos del catálogo
      // (CapituloCatalogo), para que el capítulo que arma el usuario ya
      // resuelva capituloCatalogoId al crearse (POST /api/proyectos, Etapa
      // 5), sin pasar por el fallback de alias de CAPITULOS_SAU. Se
      // colapsaron variantes que apuntaban al mismo capítulo real
      // ("Mampostería y muros"/"Revoques y enlucidos"/"Revestimientos y
      // pisos" → "Albañilería"; "Carpintería"/"Herrería y metálica" →
      // "Subcontratos - Carpinterías") para que la IA no sugiera el mismo
      // capítulo repetido. "Movimiento de tierra y fundaciones" (ambiguo,
      // apuntaba a 2 capítulos) se separó en sus 2 capítulos reales.
      // Instalación de gas / Instalaciones embutidas / Calefacción /
      // Honorarios profesionales / Imprevistos no tienen biblioteca de
      // subrubros propia — quedan igual, siempre resuelven
      // capituloCatalogoId: null (correcto, son categorías administrativas
      // o sin biblioteca clasificable).
      system: `Sos un experto en construcción uruguaya. El usuario te da el tipo de obra y una descripción de los trabajos a realizar. Devolvés SOLO un JSON con la lista de capítulos recomendados en orden lógico de ejecución, seleccionados de esta lista disponible:
Implantación y Replanteo, Excavaciones y Movimientos de Tierra, Cimentaciones, Estructura, Albañilería, Cubierta / Techos, Subcontratos - Carpinterías, Instalación Sanitaria, Instalación Eléctrica, Instalación de gas, Instalaciones embutidas, Calefacción, Subcontratos - Pinturas, Subcontratos - Vidrios, Subcontratos - Acondicionamientos, Honorarios profesionales, Imprevistos.
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
