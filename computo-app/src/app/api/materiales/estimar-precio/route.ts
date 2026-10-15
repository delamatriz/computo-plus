import { NextRequest, NextResponse } from "next/server";
import { crearMensaje } from "@/lib/anthropic-client";
import { registrarLogConsumoIA } from "@/lib/logConsumoIA";
import { requerirSesion } from "@/lib/sesion";
import { bloquearSiEsPrueba, respuestaFuncionNoDisponible } from "@/lib/acceso";


// POST — estima con IA el precio unitario (UYU) de un material de obra
// que no tiene precio cargado ni match en PrecioMTOP. Usado por el botón
// "Estimar" en la columna P. unit. de la tabla de Materiales del APU.
export async function POST(req: NextRequest) {
  const sesion = await requerirSesion();
  if (sesion instanceof NextResponse) return sesion;
  // No disponible en la prueba gratis (no descuenta cupo: directamente no se ofrece).
  const bloqueo = await bloquearSiEsPrueba(sesion);
  if (bloqueo) return bloqueo;

  try {
    const { descripcion, unidad } = await req.json();

    if (!descripcion?.trim()) {
      return NextResponse.json({ error: "Falta descripcion" }, { status: 400 });
    }

    const message = await crearMensaje({ empresaId: sesion.empresaId, funcion: "estimar-precio-material" }, {
      model: "claude-sonnet-4-6",
      max_tokens: 20,
      messages: [{
        role: "user",
        content: `Estimá el precio unitario en pesos uruguayos (julio 2026) de este material de construcción para Uruguay: ${descripcion} en unidad ${unidad || "u"}. Respondé SOLO con un número entero, sin texto adicional.`,
      }],
    });

    void registrarLogConsumoIA({
      funcion: "estimar-precio-material",
      empresaId: sesion.empresaId,
      inputTokens: message.usage.input_tokens ?? 0,
      outputTokens: message.usage.output_tokens ?? 0,
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const match = text.match(/\d+/);
    if (!match) throw new Error("Respuesta inválida del modelo");

    return NextResponse.json({ precio: parseInt(match[0], 10) });
  } catch (err) {
    console.error("[POST /api/materiales/estimar-precio]", err);
    const noDisponible = respuestaFuncionNoDisponible(err, sesion.email);
    if (noDisponible) return noDisponible;
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
