import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generarRubrosAutomaticos, type CapituloConMonto } from "@/lib/rubrosAutomaticos";

const MENSAJE_PROYECTO_FINALIZADO =
  "Este presupuesto fue entregado y los precios están congelados. Habilitá la edición desde el proyecto para poder modificarlo.";

/**
 * Dispara en background la generación de rubros automáticos por capítulo
 * para un proyecto ya creado. Si se reciben capitulosConMontos (del
 * desglose de Cálculo Rápido), se usan como contexto de precios para la IA.
 * No bloquea: responde de inmediato y la generación sigue en background.
 *
 * Mismo guard que el resto de las escrituras de rubro (ver
 * api/rubros/[id]/apu/route.ts) — un proyecto FINALIZADO no debería
 * poder generar rubros nuevos. Se chequea ACÁ, síncrono, ANTES de
 * disparar generarRubrosAutomaticos() en background: como esa función
 * corre sin esperar su resolución, un guard adentro del loop dejaría
 * capítulos/rubros ya creados a mitad de camino si el chequeo fallara
 * recién en el primer clonarApuAlRubro() — rechazar acá evita
 * generar nada en absoluto.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proyectoId } = await params;

    const proyecto = await db.proyecto.findUnique({ where: { id: proyectoId }, select: { estado: true } });
    if (!proyecto) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }
    if (proyecto.estado === "FINALIZADO") {
      return NextResponse.json(
        { error: "proyecto_finalizado", mensaje: MENSAJE_PROYECTO_FINALIZADO },
        { status: 403 }
      );
    }

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
