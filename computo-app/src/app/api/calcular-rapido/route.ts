import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const TIPOS_LABEL: Record<string, string> = {
  reparaciones: "Reparaciones",
  reforma: "Reforma / Ampliación",
};

export async function POST(request: NextRequest) {
  try {
    const { descripcion, tipo, zona, calidad, moneda } = await request.json();

    if (!descripcion?.trim()) {
      return NextResponse.json({ error: "sin_descripcion" }, { status: 400 });
    }

    const tipoLabel = TIPOS_LABEL[tipo] ?? tipo;
    const monedaLabel = moneda === "UYU" ? "pesos uruguayos" : "dólares americanos";

    const prompt = `Sos un presupuestador experto en construcción uruguaya.
El usuario necesita un presupuesto estimativo para la siguiente tarea:

Tipo: ${tipoLabel}
Descripción: ${descripcion}
Zona: ${zona}
Calidad: ${calidad}
Moneda: ${moneda}

Analizá la descripción y devolvé un JSON con esta estructura exacta:
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
  "advertencia": string
}

Reglas:
- Solo incluí los capítulos relevantes para la tarea descripta (no pongas todos)
- Los montos en ${monedaLabel}
- Usá precios de referencia del mercado uruguayo 2025
- totalMateriales + totalManoObra = totalGeneral
- La advertencia debe decir: "Valores estimativos sin IVA ni aportes BPS. Para mayor exactitud, desarrollá un proyecto completo."
- Respondé SOLO con JSON válido, sin texto adicional`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
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
