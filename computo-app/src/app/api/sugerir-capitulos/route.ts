import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { crearMensaje } from "@/lib/anthropic-client";
import { db } from "@/lib/db";
import { registrarLogConsumoIA } from "@/lib/logConsumoIA";
import { requerirSesion } from "@/lib/sesion";
import { bloquearSiEsPrueba, respuestaFuncionNoDisponible } from "@/lib/acceso";
import { rubrosPorCapituloEstandar } from "@/lib/rubrosPorCapitulo";

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
//
// Además de los capítulos, para cada uno devuelve entre 2 y 5 rubros representativos, elegidos
// de los rubros reales del catálogo (SubrubroEstandar, solo nombre y unidad) agrupados por
// capítulo — la IA no los inventa y lo que devuelve se valida contra esa lista. Son solo un
// adelanto informativo en el paso 3: el usuario acepta o quita capítulos completos.


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
  const sesion = await requerirSesion();
  if (sesion instanceof NextResponse) return sesion;
  // No disponible en la prueba gratis (no descuenta cupo: directamente no se ofrece).
  const bloqueo = await bloquearSiEsPrueba(sesion);
  if (bloqueo) return bloqueo;

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
    const rubrosCatalogo = await rubrosPorCapituloEstandar(permitidos);
    // Capítulo → (nombre normalizado del rubro → nombre canónico), para validar lo que devuelve la IA.
    const rubrosValidos = new Map(
      permitidos.map((n) => [n, new Map((rubrosCatalogo.get(n) ?? []).map((r) => [r.descripcion.trim().toLowerCase(), r.descripcion]))])
    );
    const catalogoParaPrompt = permitidos
      .map((n) => {
        const rubros = rubrosCatalogo.get(n) ?? [];
        return `## ${n}\n${rubros.length > 0 ? rubros.map((r) => `- ${r.descripcion} (${r.unidad})`).join("\n") : "(sin rubros en el catálogo)"}`;
      })
      .join("\n\n");

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

    const response = await crearMensaje({ empresaId: sesion.empresaId, funcion: "sugerir-capitulos" }, {
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: `Sos un experto en construcción uruguaya. Te dan el tipo de obra y lo que se sabe de ella (área, descripción de los trabajos, otros datos y fotos). Elegí qué capítulos del presupuesto hacen falta, en orden lógico de ejecución de obra, y para cada uno sugerí entre 2 y 5 rubros representativos.

Los capítulos y sus rubros salen SOLO de este catálogo real (cada "## " es un capítulo; los "- " son sus rubros, con la unidad entre paréntesis). Copiá los nombres de capítulo y de rubro exactamente, sin la unidad. No inventes ni modifiques nombres:

${catalogoParaPrompt}

Criterio:
- Sugerí únicamente los capítulos que los datos justifican; no rellenes con capítulos "por las dudas".
- Usá el área como referencia de la escala de la obra (por ejemplo, una obra chica no suele necesitar Ascensor ni Movimiento de tierra importante).
- Rubros de cada capítulo: elegí de 2 a 5 de la lista de ESE capítulo, los más representativos de lo que la obra necesita. Si el capítulo no tiene rubros en el catálogo, devolvé "rubros": [].
- Si la descripción o los otros datos mencionan trabajos específicos (por ejemplo "abrir fisuras en borde de pretil"), buscá en el catálogo los rubros que correspondan a esos trabajos, incluilos primero en el capítulo apropiado (agregando ese capítulo si hace falta) y completá con los rubros representativos del capítulo. No te limites a los rubros genéricos.
- Terminología uruguaya de obra: rubro, capítulo, ticholo, pilar, encofrado, hormigón.

Respondé SOLO con JSON válido, sin texto adicional: { "capitulos": [ { "nombre": "capítulo", "rubros": ["rubro 1", "rubro 2"] } ] }`,
      messages: [{ role: "user", content }],
    });

    void registrarLogConsumoIA({
      funcion: "sugerir-capitulos",
      empresaId: sesion.empresaId,
      inputTokens: response.usage.input_tokens ?? 0,
      outputTokens: response.usage.output_tokens ?? 0,
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text : "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Respuesta inválida del modelo");

    const bruto: unknown = JSON.parse(match[0])?.capitulos;
    const porNombre = new Map(permitidos.map((n) => [n.trim().toLowerCase(), n]));
    // El rubro puede venir con la unidad pegada ("Nombre (m2)" o "Nombre | m2"): se prueba también sin ella.
    const rubroCanonico = (validos: Map<string, string>, texto: string) =>
      validos.get(texto.trim().toLowerCase()) ?? validos.get(texto.replace(/\s*[|(].*$/, "").trim().toLowerCase());
    const vistos = new Set<string>();
    const capitulos: { nombre: string; rubros: string[] }[] = [];
    for (const item of Array.isArray(bruto) ? bruto : []) {
      // Se acepta también el formato viejo (solo el nombre) por si el modelo lo devuelve.
      const nombreCrudo = typeof item === "string" ? item : typeof item?.nombre === "string" ? item.nombre : "";
      const canonico = porNombre.get(nombreCrudo.trim().toLowerCase());
      if (!canonico || vistos.has(canonico)) continue;
      vistos.add(canonico);

      const validos = rubrosValidos.get(canonico) ?? new Map<string, string>();
      const rubros: string[] = [];
      for (const r of Array.isArray(item?.rubros) ? item.rubros : []) {
        const rubro = typeof r === "string" ? rubroCanonico(validos, r) : undefined;
        if (rubro && !rubros.includes(rubro)) rubros.push(rubro);
      }
      capitulos.push({ nombre: canonico, rubros: rubros.slice(0, 5) });
    }

    if (capitulos.length === 0) {
      return NextResponse.json({ error: "sin_sugerencias" }, { status: 502 });
    }

    return NextResponse.json({ capitulos });
  } catch (err) {
    console.error("[sugerir-capitulos]", err);
    const noDisponible = respuestaFuncionNoDisponible(err, sesion.email);
    if (noDisponible) return noDisponible;
    return NextResponse.json({ error: "No se pudo generar la sugerencia" }, { status: 500 });
  }
}
