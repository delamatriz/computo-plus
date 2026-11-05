import { NextRequest, NextResponse } from "next/server";
import { crearMensaje } from "@/lib/anthropic-client";
import { registrarLogConsumoIA } from "@/lib/logConsumoIA";
import { requerirSesion } from "@/lib/sesion";
import { bloquearSiEsPrueba, respuestaFuncionNoDisponible } from "@/lib/acceso";
import { consumirLimiteDiarioIA } from "@/lib/limiteDiarioIA";
import { descargarImagenExterna } from "@/lib/urlExternaSegura";


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

// Fotos por pedido: se procesan las primeras y el resto se descarta.
const MAX_FOTOS_POR_PEDIDO = 10;
const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type TipoImagen = (typeof TIPOS_IMAGEN)[number];
const esTipoImagen = (t: string): t is TipoImagen => (TIPOS_IMAGEN as readonly string[]).includes(t);

// Cada foto llega como data URL (base64) o como URL https externa. La URL se
// baja acá y se manda en base64, pero solo si es https a un host público
// (lib/urlExternaSegura.ts: sin IPs internas ni redirecciones). Lo que no
// pasa se ignora (null) y el resto del pedido sigue. Antes también se
// aceptaban rutas relativas pegadas al origen: se podían torcer a otro host
// ("@otro-host/x") y además nunca funcionaban, porque el pedido salía sin la
// sesión del usuario.
async function imageBlockDesdeFoto(foto: unknown): Promise<ImageBlock | null> {
  if (typeof foto !== "string") return null;
  const dataUrlMatch = foto.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (dataUrlMatch) {
    if (!esTipoImagen(dataUrlMatch[1])) return null;
    return { type: "image", source: { type: "base64", media_type: dataUrlMatch[1], data: dataUrlMatch[2] } };
  }

  const imagen = await descargarImagenExterna(foto);
  if (!imagen || !esTipoImagen(imagen.contentType)) return null;
  return { type: "image", source: { type: "base64", media_type: imagen.contentType, data: imagen.buffer.toString("base64") } };
}

export async function POST(request: NextRequest) {
  const sesion = await requerirSesion();
  if (sesion instanceof NextResponse) return sesion;
  // No disponible en la prueba gratis (no descuenta cupo: directamente no se ofrece).
  const bloqueo = await bloquearSiEsPrueba(sesion);
  if (bloqueo) return bloqueo;
  // Tope diario por empresa para esta ruta (lib/limiteDiarioIA.ts): 429 al pasarlo.
  const tope = consumirLimiteDiarioIA("metrajes/analizar-imagen", sesion);
  if (tope) return tope;

  try {
    const { fotos, contexto } = await request.json();

    if (!Array.isArray(fotos) || fotos.length === 0) {
      return NextResponse.json({ error: "sin_fotos" }, { status: 400 });
    }

    const imageBlocks = (await Promise.all(fotos.slice(0, MAX_FOTOS_POR_PEDIDO).map(imageBlockDesdeFoto))).filter(
      (b): b is ImageBlock => b !== null
    );
    if (imageBlocks.length === 0) {
      return NextResponse.json({ error: "sin_fotos_validas" }, { status: 400 });
    }

    const textoPrompt = contexto?.trim()
      ? `${PROMPT}\n\nContexto del espacio: ${contexto.trim()}`
      : PROMPT;

    const message = await crearMensaje({ empresaId: sesion.empresaId, funcion: "metrajes-analizar-imagen" }, {
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: [...imageBlocks, { type: "text" as const, text: textoPrompt }],
        },
      ],
    });

    void registrarLogConsumoIA({
      funcion: "metrajes-analizar-imagen",
      empresaId: sesion.empresaId,
      inputTokens: message.usage.input_tokens ?? 0,
      outputTokens: message.usage.output_tokens ?? 0,
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Respuesta inválida del modelo");

    const resultado = JSON.parse(match[0]);

    return NextResponse.json(resultado);
  } catch (err) {
    console.error("[metrajes/analizar-imagen]", err);
    const noDisponible = respuestaFuncionNoDisponible(err, sesion.email);
    if (noDisponible) return noDisponible;
    return NextResponse.json(
      { error: "Error al analizar las imágenes" },
      { status: 500 }
    );
  }
}
