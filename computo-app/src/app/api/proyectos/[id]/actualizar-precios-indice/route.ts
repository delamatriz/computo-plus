import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";

const client = new Anthropic();

function totalRubro(r: { cantidad: number; precioUnit: number }): number {
  return r.cantidad * r.precioUnit;
}

// Log de consumo de la Consulta ICCV (ver LogConsultaICCV en
// schema.prisma) — invisible para el usuario a propósito: nunca se
// espera desde el flujo principal (ver el `.catch()` en el llamador) y
// acá adentro también se atrapa el error en vez de dejarlo propagar,
// como defensa extra por si alguna vez se llama con `await` desde otro
// lado. Un fallo acá NUNCA debe romper la respuesta real al usuario.
async function registrarLogICCV(datos: {
  proyectoId: string;
  inputTokens: number;
  outputTokens: number;
  pasos: number;
}): Promise<void> {
  try {
    await db.logConsultaICCV.create({ data: datos });
  } catch (err) {
    console.error("[registrarLogICCV] error al guardar el log", err);
  }
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

    const varianteEsperada =
      proyecto.tipoContratacion === "PUBLICA" ? "ICCV con participación pública" : "ICCV privado";

    const prompt = `Buscá en ine.gub.uy (Índice de Costo de la Construcción de Vivienda - ICCV, base junio 2023=100) los siguientes valores, usando SIEMPRE la variante "${varianteEsperada}" (el INE publica dos series distintas cada mes — pública y privada — no uses la otra):
1. El valor del ICCV (variante "${varianteEsperada}") correspondiente al mes de ${fechaBase}
2. El valor del ICCV (misma variante) más reciente publicado

Si la fecha base es anterior a junio 2023, indicá que no se puede calcular con la base actual y devolvé error.

Si el mes de ${fechaBase} (o el mes más reciente que correspondería usar) todavía no tiene dato publicado por el INE — recordá que el INE publica con un rezago de hasta 30 días — devolvé un error específico con este formato exacto: "El ICCV de {mes} todavía no fue publicado por el INE. El último dato disponible es {mesMasReciente}." (reemplazando {mes} y {mesMasReciente} por los meses reales en español, ej. "agosto de 2026" y "junio de 2026"). No caigas en un error genérico ni inventes un valor.

Respondé SOLO con JSON:
{ "indiceBase": number, "indiceActual": number, "mesBase": string, "mesActual": string, "variante": string, "error": string | null }`;

    const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];
    let message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages,
    });

    // Acumulado de tokens de TODOS los pasos de esta tarea agéntica (el
    // llamado inicial + cada reintento por "pause_turn" de abajo) — para
    // FEAT logging de costo real, ver registrarLogICCV al final. pasos
    // arranca en 1 porque el llamado de arriba ya cuenta como el primero.
    let inputTokensAcumulado = message.usage.input_tokens ?? 0;
    let outputTokensAcumulado = message.usage.output_tokens ?? 0;
    let pasos = 1;

    let intentos = 0;
    while (message.stop_reason === "pause_turn" && intentos < 5) {
      messages.push({ role: "assistant", content: message.content });
      message = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages,
      });
      inputTokensAcumulado += message.usage.input_tokens ?? 0;
      outputTokensAcumulado += message.usage.output_tokens ?? 0;
      pasos++;
      intentos++;
    }

    // Fire-and-forget — nunca debe afectar la respuesta real al usuario.
    // No se hace `await`: si la escritura del log tarda o falla, el
    // endpoint sigue su curso normal. El .catch() evita que un rechazo
    // no manejado tire abajo el proceso o quede como unhandled rejection.
    registrarLogICCV({
      proyectoId,
      inputTokens: inputTokensAcumulado,
      outputTokens: outputTokensAcumulado,
      pasos,
    }).catch((err) => {
      console.error("[actualizar-precios-indice] no se pudo registrar el log de consumo ICCV", err);
    });

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

    const { indiceBase, indiceActual, mesBase, mesActual, variante } = datos;
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
      variante: variante ?? varianteEsperada,
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
