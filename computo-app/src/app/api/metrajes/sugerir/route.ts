import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const SYSTEM_PROMPT = `Eres un asistente experto en cómputo métrico de construcción para Uruguay. El usuario te describe un elemento a medir. Extraé las dimensiones, calculá la cantidad (subtotal = largo × ancho × alto × cantidad, omitiendo las dimensiones que no apliquen), y devolvé JSON estructurado. Si el input es ambiguo, poné el campo 'nota' con una aclaración breve. Responde SOLO con JSON, sin texto adicional ni markdown.`;

export async function POST(request: NextRequest) {
  try {
    const { descripcion } = await request.json();

    if (!descripcion?.trim()) {
      return NextResponse.json({ error: "sin_descripcion" }, { status: 400 });
    }

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Elemento a medir: ${descripcion}

Devolvé un JSON con esta estructura exacta:
{
  "descripcion": string,
  "largo": number | null,
  "ancho": number | null,
  "alto": number | null,
  "cantidad": number,
  "subtotal": number,
  "unidad": "m2" | "m3" | "ml" | "u",
  "nota": string
}`,
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
    console.error("[metrajes/sugerir]", err);
    return NextResponse.json(
      { error: "Error al generar la fila" },
      { status: 500 }
    );
  }
}
