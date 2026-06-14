import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";

const client = new Anthropic();

function totalRubro(r: { cantidad: number; precioUnit: number }): number {
  return r.cantidad * r.precioUnit;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proyectoId } = await params;
    const { fechaBase } = await req.json();

    if (typeof fechaBase !== "string" || !fechaBase) {
      return NextResponse.json({ error: "Falta la fecha base" }, { status: 400 });
    }

    const proyecto = await db.proyecto.findUnique({
      where: { id: proyectoId },
      include: {
        capitulos: {
          include: { rubros: true },
        },
      },
    });

    if (!proyecto) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const totalActual = proyecto.capitulos.reduce(
      (s, cap) => s + cap.rubros.reduce((sr, r) => sr + totalRubro(r), 0),
      0
    );

    const prompt = `Buscá en ine.gub.uy (Índice de Costo de la Construcción de Vivienda - ICCV, base junio 2023=100) los siguientes valores:
1. El valor del ICCV correspondiente al mes de ${fechaBase}
2. El valor del ICCV más reciente publicado

Si la fecha base es anterior a junio 2023, indicá que no se puede calcular con la base actual y devolvé error.

Respondé SOLO con JSON:
{ "indiceBase": number, "indiceActual": number, "mesBase": string, "mesActual": string, "error": string | null }`;

    const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];
    let message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages,
    });

    let intentos = 0;
    while (message.stop_reason === "pause_turn" && intentos < 5) {
      messages.push({ role: "assistant", content: message.content });
      message = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages,
      });
      intentos++;
    }

    const textoCompleto = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n");

    const match = textoCompleto.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No se pudo interpretar la respuesta del modelo");

    const datos = JSON.parse(match[0]);

    if (datos.error) {
      return NextResponse.json({ error: datos.error });
    }

    const { indiceBase, indiceActual, mesBase, mesActual } = datos;
    const factor = indiceActual / indiceBase;
    const totalProyectado = totalActual * factor;

    await db.proyecto.update({
      where: { id: proyectoId },
      data: {
        fechaBaseIndice: new Date(`${fechaBase}-01`),
        indiceBaseValor: indiceBase,
      },
    });

    return NextResponse.json({
      factor,
      indiceBase,
      indiceActual,
      mesBase,
      mesActual,
      totalActual,
      totalProyectado,
    });
  } catch (err) {
    console.error("[actualizar-precios-indice POST]", err);
    return NextResponse.json(
      { error: "Error al consultar el índice ICCV" },
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
    const { factor } = await req.json();

    if (typeof factor !== "number" || !Number.isFinite(factor) || factor <= 0) {
      return NextResponse.json({ error: "Factor inválido" }, { status: 400 });
    }

    const capitulos = await db.capitulo.findMany({
      where: { proyectoId },
      include: { rubros: true },
    });

    for (const cap of capitulos) {
      for (const rubro of cap.rubros) {
        await db.rubro.update({
          where: { id: rubro.id },
          data: { precioUnit: rubro.precioUnit * factor },
        });
      }
    }

    await db.proyecto.update({
      where: { id: proyectoId },
      data: { ultimaActualizacionIndice: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[actualizar-precios-indice PUT]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
