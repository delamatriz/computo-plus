import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// Mismo criterio de dominio que extraer-jornales.ts ("preferí null antes
// que adivinar") — acá aplicado a listas de precios de proveedor en vez
// de escalas salariales. Formato de entrada libre a propósito: las listas
// de proveedores no siguen ningún estándar (tabla prolija, catálogo con
// texto corrido, PDF escaneado con OCR de fábrica, etc.).
const SYSTEM_PROMPT = `Eres un asistente especializado en leer listas de precios de materiales de la construcción de proveedores uruguayos. Analizás PDFs de listas de precios — pueden venir en formato tabla prolija, catálogo con texto corrido, o cualquier otro formato — y extraés cada ítem con su descripción, unidad y precio unitario.

Identificás cada ítem por su contenido real (descripción y precio impresos), nunca asumís una estructura fija — las listas de proveedores no siguen ningún estándar. Si un dato de un ítem no se puede determinar con certeza razonable, preferís marcarlo con confianza baja antes que adivinar — nunca inventás un valor que no está en el documento.`;

const USER_PROMPT = `Extraé todos los ítems de esta lista de precios de proveedor.

Para cada ítem, identificá:
- codigo: el código/SKU del producto, si el documento lo muestra (null si no hay código visible — no inventes uno).
- descripcion: el nombre/descripción del producto, tal como figura en el documento.
- unidad: la unidad de venta (ej: "unidad", "m2", "m3", "kg", "bolsa", "rollo", "caja"). Si no está explícita en el documento, devolvé null antes que adivinar.
- precioUnitario: el precio numérico, sin símbolo de moneda ni separadores de miles (ej: 1234.56).
- confianza: un número de 0 a 1 que indique qué tan seguro estás de haber leído ESTE ítem completo correctamente (descripción + unidad + precio) — 1 = totalmente seguro (texto impreso claro, sin ambigüedad), 0 = muy inseguro (texto borroso, cortado, ambiguo, o tuviste que inferir algo). Sé honesto y conservador: es mejor un número bajo cuando hay duda real que uno alto injustificado.

También fijate si el documento tiene un encabezado, membrete o pie de página que identifique el nombre del proveedor/comercio — devolvelo en "proveedor" (null si no aparece ningún nombre de proveedor identificable en el documento — nunca lo inventes ni lo asumas del nombre del archivo).

Devolvé SOLO un JSON con este formato, sin texto adicional:
{
  "proveedor": string | null,
  "items": [
    { "codigo": string | null, "descripcion": string, "unidad": string | null, "precioUnitario": number, "confianza": number }
  ]
}

Reglas:
- No te saltees ítems porque tengas dudas — devolvé el ítem igual, con confianza baja, para que un humano lo revise.
- Si un ítem no tiene precio numérico legible, no lo devuelvas (sin precio no hay nada que importar).
- No inventes descripciones, códigos ni unidades que no estén en el documento.`;

type Confianza = "alta" | "media" | "baja";

// Mismos baldes que se usan en el resto de la app para "qué tan seguro
// estoy de este dato" (ver UMBRAL_SIMILITUD_DEFAULT=0.85 en
// similitudDescripcion.ts) — el número crudo de Claude nunca llega al
// cliente, solo el balde.
function bucketizarConfianza(score: number): Confianza {
  if (score >= 0.85) return "alta";
  if (score >= 0.5) return "media";
  return "baja";
}

interface ItemExtraido {
  codigo: string | null;
  descripcion: string;
  unidad: string | null;
  precioUnitario: number;
  confianza: Confianza;
}

export async function POST(request: NextRequest) {
  try {
    const { archivo } = await request.json();

    if (!archivo || typeof archivo !== "string") {
      return NextResponse.json({ error: "sin_archivo" }, { status: 400 });
    }

    const match = archivo.match(/^data:([a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match || match[1] !== "application/pdf") {
      return NextResponse.json({ error: "no_es_pdf" }, { status: 400 });
    }
    const data = match[2];

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document" as const,
              source: { type: "base64" as const, media_type: "application/pdf" as const, data },
            },
            { type: "text" as const, text: USER_PROMPT },
          ],
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";

    console.log("[precios-mtop/extraer-pdf] respuesta de Claude:", text.slice(0, 500));

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "lectura_incierta" }, { status: 422 });
    }

    let resultado;
    try {
      resultado = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error("[precios-mtop/extraer-pdf] no se pudo parsear el JSON:", parseErr);
      return NextResponse.json({ error: "lectura_incierta" }, { status: 422 });
    }

    const itemsCrudos: unknown[] = Array.isArray(resultado.items) ? resultado.items : [];

    const items: ItemExtraido[] = itemsCrudos
      .filter(
        (it): it is Record<string, unknown> =>
          typeof it === "object" &&
          it !== null &&
          typeof (it as Record<string, unknown>).descripcion === "string" &&
          (it as Record<string, unknown>).descripcion !== "" &&
          typeof (it as Record<string, unknown>).precioUnitario === "number" &&
          Number.isFinite((it as Record<string, unknown>).precioUnitario as number)
      )
      .map((it) => ({
        codigo: typeof it.codigo === "string" && it.codigo.trim() ? it.codigo.trim() : null,
        descripcion: (it.descripcion as string).trim(),
        unidad: typeof it.unidad === "string" && it.unidad.trim() ? it.unidad.trim() : null,
        precioUnitario: it.precioUnitario as number,
        confianza: bucketizarConfianza(typeof it.confianza === "number" ? it.confianza : 0),
      }));

    if (items.length === 0) {
      return NextResponse.json({ error: "lectura_incierta" }, { status: 422 });
    }

    const proveedor = typeof resultado.proveedor === "string" && resultado.proveedor.trim() ? resultado.proveedor.trim() : null;

    return NextResponse.json({ proveedor, items });
  } catch (err) {
    console.error("[precios-mtop/extraer-pdf]", err);
    return NextResponse.json({ error: "lectura_incierta" }, { status: 422 });
  }
}
