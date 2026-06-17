import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";

const client = new Anthropic();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rubroId } = await params;
    const body = await req.json();
    const { descripcion, unidad, capitulo, tipoObra } = body as {
      descripcion: string;
      unidad: string;
      capitulo: string;
      tipoObra: string;
    };

    if (!descripcion?.trim()) {
      return NextResponse.json({ error: "Descripción requerida" }, { status: 400 });
    }

    const [categorias, preciosMTOP] = await Promise.all([
      db.categoriaLaboral.findMany({ orderBy: { nombre: "asc" } }),
      db.precioMTOP.findMany({ take: 50, orderBy: { descripcion: "asc" } }),
    ]);

    const tablaJornales = categorias
      .map((c) => `${c.nombre}: $${c.jornal} UYU/jornada (8hs)`)
      .join("\n");

    const tablaMateriales = preciosMTOP
      .map((p) => `${p.descripcion}: ${p.precioUnitario} UYU/${p.unidad}`)
      .join("\n");

    const prompt = `Rubro: "${descripcion}"
Unidad de medida: ${unidad || "—"}
Capítulo: ${capitulo || "—"}
Tipo de obra: ${tipoObra || "—"}

JORNALES SUNCA VIGENTES (Uruguay 2025):
${tablaJornales}

PRECIOS DE REFERENCIA MTOP (Lista Nº599, Nov 2025, en UYU):
${tablaMateriales}

Devolvé SOLO un JSON con esta estructura exacta:
{
  "materiales": [
    { "descripcion": string, "unidad": string, "rendimiento": number, "precioUnit": number }
  ],
  "manoObra": [
    { "categoria": string, "rendimiento": number, "jornal": number }
  ],
  "precioUnitarioEstimado": number
}

Reglas:
- "rendimiento" en materiales = cantidad de material por unidad de rubro (ej: 0.35 m³ de arena por m² de revoque).
- "rendimiento" en mano de obra = unidades de rubro producidas por jornada de 8hs (ej: 12 m² de revoque por jornada).
- "precioUnitarioEstimado" = suma(rendimiento × precioUnit para materiales) + suma(jornal / rendimiento para mano de obra), con un margen de 25% de gastos generales y utilidad.
- Usá precios MTOP cuando el material coincida. Para mano de obra, usá la categoría SUNCA más adecuada.
- Respondé SOLO con JSON válido, sin texto adicional ni markdown.`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: `Sos un presupuestador experto en construcción uruguaya con 20 años de experiencia.
Generás APU (Análisis de Precios Unitarios) detallados y precisos para cada rubro de obra.
Usás terminología local: ticholo, ladrillo, viga de arriostre, pilar, hormigón, encofrado, mortero común.
Tus APU son realistas, basados en rendimientos reales de obra uruguaya, usando precios MTOP y jornales SUNCA.`,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Respuesta inválida del modelo");

    const apu = JSON.parse(match[0]) as {
      materiales: { descripcion: string; unidad: string; rendimiento: number; precioUnit: number }[];
      manoObra: { categoria: string; rendimiento: number; jornal: number }[];
      precioUnitarioEstimado: number;
    };

    // Persistir APU en DB
    const apuExistente = await db.aPU.findUnique({ where: { rubroId } });
    const gastosGeneralesPct = 15;
    const utilidadPct = 10;

    const apuRecord = apuExistente
      ? await db.aPU.update({ where: { rubroId }, data: { gastosGeneralesPct, utilidadPct } })
      : await db.aPU.create({ data: { rubroId, gastosGeneralesPct, utilidadPct } });

    const apuId = apuRecord.id;

    await db.materialAPU.deleteMany({ where: { apuId } });
    for (let i = 0; i < apu.materiales.length; i++) {
      const m = apu.materiales[i];
      await db.materialAPU.create({
        data: {
          apuId,
          descripcion: m.descripcion ?? "",
          unidad: m.unidad ?? "",
          rendimiento: m.rendimiento ?? 0,
          precioUnit: m.precioUnit ?? 0,
          orden: i,
        },
      });
    }

    await db.manoObraAPU.deleteMany({ where: { apuId } });
    for (let i = 0; i < apu.manoObra.length; i++) {
      const mo = apu.manoObra[i];
      await db.manoObraAPU.create({
        data: {
          apuId,
          categoria: mo.categoria ?? "",
          jornadaHs: 8,
          rendimiento: mo.rendimiento ?? 1,
          jornalRef: mo.jornal ?? 0,
          orden: i,
        },
      });
    }

    // Actualizar precioUnit del rubro
    await db.rubro.update({
      where: { id: rubroId },
      data: { precioUnit: apu.precioUnitarioEstimado },
    });

    return NextResponse.json({
      materiales: apu.materiales,
      manoObra: apu.manoObra,
      precioUnitarioEstimado: apu.precioUnitarioEstimado,
    });
  } catch (err) {
    console.error("[sugerir-apu]", err);
    return NextResponse.json({ error: "Error al generar APU" }, { status: 500 });
  }
}
