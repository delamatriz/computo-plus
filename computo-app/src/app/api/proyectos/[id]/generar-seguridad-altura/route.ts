import { NextRequest, NextResponse } from "next/server";
import { generarCapituloSeguridad } from "@/lib/seguridadAltura";

/**
 * Carga los 3 rubros del Plan y Estudio de Seguridad dentro de "Implantación y
 * Replanteo" de cada título con requierePlanSeguridad (creando ese capítulo si
 * falta). Idempotente. Es rápida y determinística (sin llamada a IA), por lo
 * que se resuelve antes de responder.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proyectoId } = await params;
    await generarCapituloSeguridad(proyectoId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/generar-seguridad-altura]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
