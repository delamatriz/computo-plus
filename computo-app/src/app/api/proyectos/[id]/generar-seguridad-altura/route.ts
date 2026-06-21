import { NextRequest, NextResponse } from "next/server";
import { generarCapituloSeguridad } from "@/lib/seguridadAltura";

/**
 * Crea el capítulo "Seguridad y Trabajos en Altura" con sus rubros
 * predefinidos según la modalidad declarada en el proyecto. Es rápida y
 * determinística (sin llamada a IA), por lo que se resuelve antes de responder.
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
