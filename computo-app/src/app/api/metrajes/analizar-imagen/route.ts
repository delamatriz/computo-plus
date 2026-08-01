import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const PROMPT = `Sos un arquitecto experto en cómputo métrico. Analizá esta imagen (puede ser un plano, un croquis a mano, o una foto de obra) e identificá todos los elementos medibles que puedas: muros, aberturas, superficies, longitudes, alturas, etc.

Para cada elemento que puedas medir o estimar, devolvé una fila de cómputo.
Si ves cotas escritas en el plano/croquis, usálas directamente.
Si no hay cotas pero podés estimar por contexto (una puerta estándar = 0.90m, altura de piso a techo típica = 2.60m, etc.), indicalo en la nota.
Si no podés determinar una dimensión, dejala en null.

Respondé SOLO con JSON:
{
  "elementos": [
    {
      "descripcion": string,
      "largo": number | null,
      "ancho": number | null,
      "alto": number | null,
      "cantidad": number,
      "subtotal": number,
      "unidad": "M2" | "M3" | "ML" | "U",
      "nota": string
    }
  ],
  "observaciones": string
}`;

interface ImageBlock {
  type: "image";
  source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp"; data: string };
}

// Las imágenes de Planos/Fotos complementarias vienen como URL de la ruta
// proxy .../archivo (ver PlanoProyecto/FotoComplementaria — el archivo real
// vive en un store privado de Vercel Blob, esa ruta lo baja autenticado y
// lo reenvía). No son necesariamente alcanzables desde afuera de nuestro
// servidor, así que en vez de mandarle la URL a Claude, se bajan los bytes
// acá mismo y se mandan en base64 — mismo criterio para las data URLs que
// pueda mandar el cliente directamente.
async function imageBlockDesdeFoto(foto: string, origin: string): Promise<ImageBlock> {
  const dataUrlMatch = foto.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (dataUrlMatch) {
    return {
      type: "image",
      source: {
        type: "base64",
        media_type: dataUrlMatch[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
        data: dataUrlMatch[2],
      },
    };
  }

  const url = foto.startsWith("http") ? foto : `${origin}${foto}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar la imagen (${res.status}): ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const mediaType = (res.headers.get("content-type") || "image/jpeg") as
    | "image/jpeg"
    | "image/png"
    | "image/gif"
    | "image/webp";
  return { type: "image", source: { type: "base64", media_type: mediaType, data: buffer.toString("base64") } };
}

export async function POST(request: NextRequest) {
  try {
    const { fotos, contexto } = await request.json();

    if (!Array.isArray(fotos) || fotos.length === 0) {
      return NextResponse.json({ error: "sin_fotos" }, { status: 400 });
    }

    const origin = new URL(request.url).origin;
    const imageBlocks = await Promise.all(fotos.map((foto: string) => imageBlockDesdeFoto(foto, origin)));

    const textoPrompt = contexto?.trim()
      ? `${PROMPT}\n\nContexto del espacio: ${contexto.trim()}`
      : PROMPT;

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: [...imageBlocks, { type: "text" as const, text: textoPrompt }],
        },
      ],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Respuesta inválida del modelo");

    const resultado = JSON.parse(match[0]);

    return NextResponse.json(resultado);
  } catch (err) {
    console.error("[metrajes/analizar-imagen]", err);
    return NextResponse.json(
      { error: "Error al analizar las imágenes" },
      { status: 500 }
    );
  }
}
