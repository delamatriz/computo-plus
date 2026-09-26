import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const ROMANOS_VALIDOS = [
  "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII",
] as const;
type Romano = (typeof ROMANOS_VALIDOS)[number];

const SYSTEM_PROMPT = `Eres un asistente especializado en el convenio colectivo de la construcción de Uruguay (SUNCA, Grupo 9 - Subgrupo 01). Analizás fotos de escalas salariales o del convenio y extraés jornales por categoría.

Identificás cada fila por su NOMBRE/NÚMERO DE CATEGORÍA impreso en la imagen, nunca por la posición que ocupa la fila en la tabla. Las tablas publicadas no siempre están ordenadas igual, pueden tener filas de más o de menos, o venir recortadas — por eso nunca asumís que "la primera fila es la Categoría I" ni nada equivalente. Si una fila no te permite identificar con certeza a cuál de las 12 categorías oficiales corresponde, la marcás como no identificada en vez de adivinar por su posición.`;

const USER_PROMPT = `Extraé los jornales de esta escala salarial del SUNCA.

Las 12 categorías oficiales del laudo (Grupo 9.01), de menor a mayor jornal, son:
  I    — Peón común
  II   — Peón práctico
  III  — Ayudante
  IV   — Medio oficial (inferior)
  V    — Medio oficial albañil
  VI   — Oficial (inferior)
  VII  — Oficial albañil
  VIII — Oficial especializado
  IX   — Capataz
  X    — Capataz general
  XI   — Capataz general superior
  XII  — Maestro mayor de obra

Para cada fila que veas en la imagen, identificá a cuál de estas 12 categorías corresponde usando el nombre/número de categoría que figura en la imagen (no la posición de la fila). Si la imagen usa otra nomenclatura o abreviaturas, mapeala por significado (ej: "Peón" sin calificativo suele ser Cat. I; "1/2 Oficial" u "Oficial de 2da" suele ser Cat. V; "Oficial" a secas suele ser Cat. VII — pero si hay ambigüedad, preferí "categoriaRomano": null antes que adivinar).

También fijate si la imagen menciona el porcentaje de compensación/recargo por trabajo en altura (puede aparecer como "trabajo en altura", "balancín", "andamio", etc.). Ese recargo aplica solo a categorías de Oficial y Medio Oficial — nunca a Peón.

Devolvé SOLO un JSON con este formato, sin texto adicional:
{
  "categorias": [
    { "categoriaRomano": "I" | "II" | "III" | "IV" | "V" | "VI" | "VII" | "VIII" | "IX" | "X" | "XI" | "XII" | null, "nombreEnImagen": string, "jornal": number }
  ],
  "recargoAlturaPct": number | null,
  "fechaVigencia": string (ej: "2025-04-01") | null,
  "porcentajeAjuste": number (ej: 5.95) | null
}

Reglas:
- "categoriaRomano" es null solo cuando no podés determinar con certeza razonable a cuál de las 12 categorías corresponde la fila — en ese caso igual devolvé la fila (con su nombreEnImagen y jornal) para que un humano la revise.
- "recargoAlturaPct" es null si el porcentaje de compensación por altura no aparece visible en la imagen — no lo inventes ni lo asumas.
- No devuelvas más de una fila con el mismo "categoriaRomano".`;

type MediaTypeImagen = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

// El convenio SUNCA circula tanto como foto (imagen suelta o escaneada a
// mano) como PDF oficial — mismo endpoint para los dos, el content block
// que se le manda a Claude cambia según lo que vino en el data URL
// (nunca en la extensión del archivo, que el cliente no manda). PDF entra
// como bloque "document" (soporta multi-página nativo, sin necesidad de
// separar en imágenes por página — ver relevamiento previo), todo lo
// demás sigue como bloque "image", igual que antes de este cambio.
type ArchivoParaClaude =
  | { tipo: "document"; data: string; mediaType: "application/pdf" }
  | { tipo: "image"; data: string; mediaType: MediaTypeImagen };

function parseDataUrl(archivo: string): ArchivoParaClaude {
  const match = archivo.match(/^data:([a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    return { tipo: "image", data: archivo, mediaType: "image/jpeg" };
  }
  const [, mediaType, data] = match;
  if (mediaType === "application/pdf") {
    return { tipo: "document", data, mediaType };
  }
  const tiposImagenValidos: MediaTypeImagen[] = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  return {
    tipo: "image",
    data,
    mediaType: (tiposImagenValidos as string[]).includes(mediaType) ? (mediaType as MediaTypeImagen) : "image/jpeg",
  };
}

function esRomanoValido(valor: unknown): valor is Romano {
  return typeof valor === "string" && (ROMANOS_VALIDOS as readonly string[]).includes(valor);
}

export async function POST(request: NextRequest) {
  try {
    // "archivo" en vez de "imagen" (nombre viejo del campo) — ahora puede
    // ser también un PDF, ver parseDataUrl. Único caller es
    // SeccionCategoriasLaborales.tsx, actualizado junto con esto.
    const { archivo } = await request.json();

    if (!archivo || typeof archivo !== "string") {
      return NextResponse.json({ error: "sin_imagen" }, { status: 400 });
    }

    const parseado = parseDataUrl(archivo);

    const bloqueArchivo =
      parseado.tipo === "document"
        ? {
            type: "document" as const,
            source: {
              type: "base64" as const,
              media_type: "application/pdf" as const,
              data: parseado.data,
            },
          }
        : {
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: parseado.mediaType,
              data: parseado.data,
            },
          };

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [bloqueArchivo, { type: "text" as const, text: USER_PROMPT }],
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

    const filasCrudas: unknown[] = Array.isArray(resultado.categorias)
      ? resultado.categorias
      : [];

    const categoriasExtraidas = filasCrudas
      .filter(
        (c): c is { categoriaRomano: unknown; nombreEnImagen: unknown; jornal: unknown } =>
          typeof c === "object" && c !== null &&
          typeof (c as Record<string, unknown>).nombreEnImagen === "string" &&
          typeof (c as Record<string, unknown>).jornal === "number"
      )
      .map((c) => ({
        categoriaRomano: esRomanoValido(c.categoriaRomano) ? c.categoriaRomano : null,
        nombreEnImagen: c.nombreEnImagen as string,
        jornal: c.jornal as number,
      }));

    const categoriasIdentificadas = categoriasExtraidas.filter(
      (c) => c.categoriaRomano !== null
    );

    if (categoriasIdentificadas.length < 3) {
      return NextResponse.json(
        { error: "lectura_incierta" },
        { status: 422 }
      );
    }

    const recargoAlturaPct =
      typeof resultado.recargoAlturaPct === "number" ? resultado.recargoAlturaPct : null;
    const fechaVigencia =
      typeof resultado.fechaVigencia === "string" ? resultado.fechaVigencia : undefined;
    const porcentajeAjuste =
      typeof resultado.porcentajeAjuste === "number" ? resultado.porcentajeAjuste : undefined;

    return NextResponse.json({
      categorias: categoriasExtraidas,
      recargoAlturaPct,
      fechaVigencia,
      porcentajeAjuste,
    });
  } catch (err) {
    console.error("[configuracion/extraer-jornales]", err);
    return NextResponse.json(
      { error: "lectura_incierta" },
      { status: 422 }
    );
  }
}
