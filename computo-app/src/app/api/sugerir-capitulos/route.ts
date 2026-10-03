import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { registrarLogConsumoIA } from "@/lib/logConsumoIA";

// Sugiere, desde el paso 3 del asistente de Nuevo proyecto, qué capítulos de la
// Lista estándar conviene prender según lo que se cargó en el paso 1: tipo de
// obra, área, "Descripción / Trabajos", "Otros datos" y hasta 5 fotos (ya
// reducidas en el navegador). NO recibe PDF ni DWG: no se usan como base.
//
// Una llamada por pedido, sin reintentos: si falla, el asistente sigue
// funcionando con la Lista estándar a mano.
//
// Los nombres permitidos salen de la propia Lista estándar (CapituloEstandar,
// origen "estandar") — así cada nombre devuelto coincide con uno que el
// selector del paso 3 ya muestra, y no hay que traducir nada.

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

const MAX_FOTOS = 5;

export async function POST(request: NextRequest) {
  try {
    const { tipo, area, trabajos, otrosDatos, fotos } = await request.json();

    const areaNum = typeof area === "number" ? area : parseFloat(String(area ?? "").replace(",", "."));
    const tieneArea = Number.isFinite(areaNum) && areaNum > 0;
    const textoTrabajos = typeof trabajos === "string" ? trabajos.trim() : "";
    const textoOtros = typeof otrosDatos === "string" ? otrosDatos.trim() : "";
    const imagenes = (Array.isArray(fotos) ? fotos : [])
      .filter((f) => f?.data && MEDIA_TYPES.includes(f?.mediaType))
      .slice(0, MAX_FOTOS) as { data: string; mediaType: ImageMediaType }[];

    if (!tieneArea && !textoTrabajos && !textoOtros && imagenes.length === 0) {
      return NextResponse.json({ error: "sin_datos" }, { status: 400 });
    }

    const lista = await db.capituloEstandar.findMany({
      where: { origen: "estandar" },
      orderBy: { orden: "asc" },
      select: { nombre: true },
    });
    const permitidos = lista.map((c) => c.nombre);
    if (permitidos.length === 0) {
      return NextResponse.json({ error: "sin_lista" }, { status: 500 });
    }

    const tipoLabel = TIPOS_LABEL[String(tipo)] ?? String(tipo ?? "");
    const lineas = [`Tipo de obra: ${tipoLabel}.`];
    if (tieneArea) lineas.push(`Área: ${areaNum} m².`);
    if (textoTrabajos) lineas.push(`Descripción / Trabajos: ${textoTrabajos}`);
    if (textoOtros) lineas.push(`Otros datos (pueden traer contacto u observaciones; usá solo lo que sirva para entender la obra): ${textoOtros}`);
    if (imagenes.length > 0) {
      lineas.push(
        `Se adjuntan ${imagenes.length} foto${imagenes.length === 1 ? "" : "s"} del lugar. Analizalas junto con el texto (estado actual, alcance de los trabajos, complejidad).`
      );
    }

    const content: Anthropic.Messages.ContentBlockParam[] = [
      { type: "text", text: lineas.join("\n") },
      ...imagenes.map(
        (img): Anthropic.Messages.ContentBlockParam => ({
          type: "image",
          source: { type: "base64", media_type: img.mediaType, data: img.data },
        })
      ),
    ];

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: `Sos un experto en construcción uruguaya. Te dan el tipo de obra y lo que se sabe de ella (área, descripción de los trabajos, otros datos y fotos). Elegí qué capítulos del presupuesto hacen falta, en orden lógico de ejecución de obra, usando SOLO nombres de esta lista (copiados exactamente):
${permitidos.join("\n")}

Criterio:
- Sugerí únicamente los capítulos que los datos justifican; no rellenes con capítulos "por las dudas".
- Usá el área como referencia de la escala de la obra (por ejemplo, una obra chica no suele necesitar Ascensor ni Movimiento de tierra importante).
- Terminología uruguaya de obra: rubro, capítulo, ticholo, pilar, encofrado, hormigón.

Respondé SOLO con JSON válido, sin texto adicional: { "capitulos": ["nombre1", "nombre2", ...] }`,
      messages: [{ role: "user", content }],
    });

    void registrarLogConsumoIA({
      funcion: "sugerir-capitulos",
      inputTokens: response.usage.input_tokens ?? 0,
      outputTokens: response.usage.output_tokens ?? 0,
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text : "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Respuesta inválida del modelo");

    const bruto: unknown = JSON.parse(match[0])?.capitulos;
    const porNombre = new Map(permitidos.map((n) => [n.trim().toLowerCase(), n]));
    const vistos = new Set<string>();
    const capitulos: string[] = [];
    for (const n of Array.isArray(bruto) ? bruto : []) {
      const canonico = typeof n === "string" ? porNombre.get(n.trim().toLowerCase()) : undefined;
      if (canonico && !vistos.has(canonico)) {
        vistos.add(canonico);
        capitulos.push(canonico);
      }
    }

    if (capitulos.length === 0) {
      return NextResponse.json({ error: "sin_sugerencias" }, { status: 502 });
    }

    return NextResponse.json({ capitulos });
  } catch (err) {
    console.error("[sugerir-capitulos]", err);
    return NextResponse.json({ error: "No se pudo generar la sugerencia" }, { status: 500 });
  }
}
