import { NextRequest, NextResponse } from "next/server";
import { generarRubrosAutomaticos, type CapituloConMonto } from "@/lib/rubrosAutomaticos";

/**
 * Dispara en background la generación de rubros automáticos por capítulo
 * para un proyecto ya creado. Si se reciben capitulosConMontos (del
 * desglose de Cálculo Rápido), se usan como contexto de precios para la IA.
 * No bloquea: responde de inmediato y la generación sigue en background.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proyectoId } = await params;
    const body = await req.json().catch(() => ({}));
    const capitulosConMontos: CapituloConMonto[] | undefined = Array.isArray(
      body?.capitulosConMontos
    )
      ? body.capitulosConMontos
      : undefined;

    generarRubrosAutomaticos(proyectoId, capitulosConMontos).catch((err) =>
      console.error("[POST /api/proyectos/[id]/generar-rubros]", err)
    );

    return NextResponse.json({ ok: true }, { status: 202 });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/generar-rubros]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
