import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";

const client = new Anthropic();

const TIPOS_LABEL: Record<string, string> = {
  REPARACIONES: "Reparaciones",
  REFORMA: "Reforma / Ampliación",
  VIVIENDA: "Vivienda unifamiliar",
  PH: "Propiedad Horizontal",
  COMERCIAL: "Local comercial",
  INDUSTRIAL: "Industrial",
};

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proyectoId } = await params;

    const proyecto = await db.proyecto.findUnique({
      where: { id: proyectoId },
      include: {
        capitulos: {
          orderBy: { orden: "asc" },
          include: {
            rubros: {
              orderBy: { createdAt: "asc" },
              include: {
                apu: {
                  include: {
                    materiales: { orderBy: { orden: "asc" } },
                    manoObra: { orderBy: { orden: "asc" } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!proyecto) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const tipoLabel = TIPOS_LABEL[proyecto.tipo] ?? proyecto.tipo;

    const presupuestoTexto = proyecto.capitulos
      .map((cap) => {
        const rubrosTexto = cap.rubros.length
          ? cap.rubros
              .map((r) => {
                const base = `  - ${r.descripcion || "(sin descripción)"} | unidad: ${r.unidad || "—"} | cantidad: ${r.cantidad}` +
                  (r.apu?.dosificacion ? ` | dosificación: ${r.apu.dosificacion}` : "");
                const materiales = r.apu?.materiales.length
                  ? "\n    Materiales: " +
                    r.apu.materiales.map((m) => `${m.descripcion} (${m.rendimiento} ${m.unidad})`).join(", ")
                  : "";
                const manoObra = r.apu?.manoObra.length
                  ? "\n    Mano de obra: " + r.apu.manoObra.map((mo) => mo.categoria).join(", ")
                  : "";
                return base + materiales + manoObra;
              })
              .join("\n")
          : "  (sin rubros)";
        return `Capítulo "${cap.nombre}":\n${rubrosTexto}`;
      })
      .join("\n\n");

    const prompt = `Datos del proyecto:
- Nombre: ${proyecto.nombre}
- Tipo de obra: ${tipoLabel}
- Dirección: ${proyecto.direccion || "(no especificada)"}
- Área: ${proyecto.area ? `${proyecto.area} m²` : "(no especificada)"}

PRESUPUESTO:
${presupuestoTexto || "(sin capítulos)"}

Redactá la memoria descriptiva de este proyecto siguiendo el system prompt indicado.`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system: `Eres un arquitecto uruguayo redactando la memoria descriptiva de un
proyecto de construcción. A partir del presupuesto que te proveo, redactá una
memoria descriptiva formal en español, describiendo los materiales y técnicas
constructivas rubro por rubro. El tono debe ser técnico pero claro. Usá
terminología de la construcción uruguaya (rubro, capítulo, pilar, hormigón,
ticholo, etc., nunca términos españoles equivalentes). No inventes
especificaciones que no surjan del presupuesto. Extensión aproximada
500-1500 palabras según la complejidad del proyecto.

Formato: texto plano, sin sintaxis Markdown. No uses #, ##, ** ni guiones
de lista (-). Los títulos de sección van en mayúsculas, en su propia línea,
con una línea en blanco antes y después. Los párrafos se separan con una
línea en blanco. Si necesitás enumerar ítems, escribilos como párrafos u
oraciones corridas, no como listas con viñetas.`,
      messages: [{ role: "user", content: prompt }],
    });

    const texto = message.content[0].type === "text" ? message.content[0].text : "";

    if (!texto.trim()) throw new Error("Respuesta vacía del modelo");

    await db.proyecto.update({
      where: { id: proyectoId },
      data: { memoriaDescriptiva: texto },
    });

    return NextResponse.json({ memoriaDescriptiva: texto });
  } catch (err) {
    console.error("[memoria-descriptiva POST]", err);
    return NextResponse.json(
      { error: "Error al generar la memoria descriptiva" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proyectoId } = await params;
    const { texto } = await req.json();

    if (typeof texto !== "string") {
      return NextResponse.json({ error: "Falta el texto" }, { status: 400 });
    }

    await db.proyecto.update({
      where: { id: proyectoId },
      data: { memoriaDescriptiva: texto },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[memoria-descriptiva PUT]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
