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
              select: { codigo: true, descripcion: true, unidad: true, cantidad: true },
            },
          },
        },
      },
    });

    if (!proyecto) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const [categorias, preciosMTOP] = await Promise.all([
      db.categoriaLaboral.findMany({ orderBy: { nombre: "asc" } }),
      db.precioMTOP.findMany({ take: 30, orderBy: { descripcion: "asc" } }),
    ]);

    const tablaJornales = categorias
      .map((c) => `${c.nombre}: $${c.jornal} UYU/jornada (8hs)`)
      .join("\n");

    const tablaMateriales = preciosMTOP
      .map((p) => `${p.descripcion}: ${p.precioUnitario} UYU/${p.unidad}`)
      .join("\n");

    const tipoLabel = TIPOS_LABEL[proyecto.tipo] ?? proyecto.tipo;

    const presupuestoTexto = proyecto.capitulos
      .map((cap) => {
        const rubrosTexto = cap.rubros.length
          ? cap.rubros
              .map((r) => `  - ${r.codigo} | ${r.descripcion || "(sin descripción)"} | ${r.unidad || "—"} | cant: ${r.cantidad}`)
              .join("\n")
          : "  (sin rubros)";
        return `Capítulo "${cap.nombre}" (${cap.codigo}):\n${rubrosTexto}`;
      })
      .join("\n\n");

    const prompt = `Tipo de obra: ${tipoLabel}

PRESUPUESTO ACTUAL:
${presupuestoTexto || "(sin capítulos)"}

JORNALES SUNCA VIGENTES (Uruguay 2025):
${tablaJornales}

PRECIOS DE REFERENCIA MTOP (Lista Nº599, Nov 2025, en UYU):
${tablaMateriales}

Devolvé SOLO un JSON con esta estructura exacta:
{
  "faltantes": [
    {
      "capitulo": string,
      "codigo": string,
      "descripcion": string,
      "unidad": string,
      "cantidadEstimada": number,
      "justificacion": string,
      "apu": {
        "materiales": [{ "descripcion": string, "unidad": string, "rendimiento": number, "precioUnit": number }],
        "manoObra": [{ "categoria": string, "rendimiento": number, "jornal": number }],
        "precioUnitarioEstimado": number
      }
    }
  ]
}

Reglas:
- Detectá como máximo 5 partidas faltantes, priorizando las más relevantes.
- "capitulo" debe coincidir con el nombre de un capítulo existente cuando corresponda, o proponer uno nuevo si es necesario.
- "rendimiento" en materiales = cantidad de material por unidad de rubro. "rendimiento" en mano de obra = unidades de rubro producidas por jornada de 8hs.
- "precioUnitarioEstimado" debe ser coherente con la suma de materiales (rendimiento × precioUnit) + mano de obra (jornal / rendimiento), con un margen razonable de gastos generales y utilidad.
- Respondé SOLO con JSON válido, sin texto adicional ni markdown.`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: `Eres un arquitecto senior y presupuestador experto en construcción uruguaya.
Analiza el siguiente presupuesto de obra y detecta partidas que probablemente faltan,
basándote en las que sí están y en el tipo de obra (por ejemplo: si hay mampostería pero
no revoques, si hay instalación sanitaria pero faltan desagües, si hay estructura pero
falta su correspondiente encofrado o armadura, etc.).
Para cada partida faltante proponé un capítulo, código, descripción, unidad, cantidad
estimada, una breve justificación de obra, y un APU (análisis de precios unitarios)
estimado con materiales y mano de obra, usando los precios MTOP y jornales SUNCA
provistos como referencia.`,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Respuesta inválida del modelo");

    const resultado = JSON.parse(match[0]);

    return NextResponse.json(resultado);
  } catch (err) {
    console.error("[detectar-faltantes]", err);
    return NextResponse.json(
      { error: "Error al analizar el presupuesto" },
      { status: 500 }
    );
  }
}
