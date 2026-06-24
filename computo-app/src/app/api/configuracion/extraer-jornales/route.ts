import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const SYSTEM_PROMPT = `Eres un asistente especializado en convenios laborales de la construcción de Uruguay. Analizás imágenes de escalas salariales del SUNCA y extraés los valores de jornal por categoría.`;

const USER_PROMPT = `Extraé los jornales de esta escala salarial del SUNCA.
Devolvé SOLO un JSON con este formato, sin texto adicional:
{
  "categorias": [
    { "nombre": string, "jornal": number }
  ],
  "fechaVigencia": string (ej: "2025-04-01"),
  "porcentajeAjuste": number (ej: 5.95)
}
Mapear las categorías al nomenclador uruguayo estándar:
- Cat III Peón común/canchero → "Peón"
- Cat V Guinchero/½ Oficial → "Medio oficial"
- Cat VIII Oficial albañil → "Oficial albañil"
- Cat IX Oficial madera/finalista → "Oficial especializado"
- Cat X Oficial escalerista → "Oficial escalerista"
- Cat XI Oficial maquinista → "Oficial maquinista"
- Cat XII Mecánico → "Capataz"
- SUPL.BALANCIN sumado a Cat VIII → "Oficial trabajo en altura"
Si no podés identificar una categoría con certeza, omitila.`;

interface ImagenBase64 {
  data: string;
  mediaType: string;
}

function parseDataUrl(imagen: string): ImagenBase64 {
  const match = imagen.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (match) {
    return { data: match[2], mediaType: match[1] };
  }
  return { data: imagen, mediaType: "image/jpeg" };
}

export async function POST(request: NextRequest) {
  try {
    const { imagen } = await request.json();

    if (!imagen || typeof imagen !== "string") {
      return NextResponse.json({ error: "sin_imagen" }, { status: 400 });
    }

    const { data, mediaType } = parseDataUrl(imagen);

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image" as const,
              source: {
                type: "base64" as const,
                media_type: mediaType as
                  | "image/jpeg"
                  | "image/png"
                  | "image/gif"
                  | "image/webp",
                data,
              },
            },
            { type: "text" as const, text: USER_PROMPT },
          ],
        },
      ],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";

    console.log("[configuracion/extraer-jornales] respuesta de Claude:", text);

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return NextResponse.json(
        { error: "lectura_incierta" },
        { status: 422 }
      );
    }

    let resultado;
    try {
      resultado = JSON.parse(match[0]);
    } catch (parseErr) {
      console.error(
        "[configuracion/extraer-jornales] no se pudo parsear el JSON:",
        parseErr
      );
      return NextResponse.json(
        { error: "lectura_incierta" },
        { status: 422 }
      );
    }

    console.log(
      "[configuracion/extraer-jornales] resultado parseado:",
      JSON.stringify(resultado)
    );

    const categoriasValidas = Array.isArray(resultado.categorias)
      ? resultado.categorias.filter(
          (c: { nombre?: unknown; jornal?: unknown }) =>
            typeof c?.nombre === "string" && typeof c?.jornal === "number"
        )
      : [];

    if (categoriasValidas.length < 3) {
      return NextResponse.json(
        { error: "lectura_incierta" },
        { status: 422 }
      );
    }

    return NextResponse.json({ ...resultado, categorias: categoriasValidas });
  } catch (err) {
    console.error("[configuracion/extraer-jornales]", err);
    return NextResponse.json(
      { error: "lectura_incierta" },
      { status: 422 }
    );
  }
}
