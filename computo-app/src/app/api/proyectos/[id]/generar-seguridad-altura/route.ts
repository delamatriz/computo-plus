import { NextRequest, NextResponse } from "next/server";
import { generarCapituloSeguridad } from "@/lib/seguridadAltura";
import { requerirProyecto } from "@/lib/sesion";

/**
 * Carga los 3 rubros del Plan y Estudio de Seguridad dentro de "Implantación y
 * Replanteo" de cada título con requierePlanSeguridad (creando ese capítulo si
 * falta). Idempotente. Es rápida y determinística (sin llamada a IA), por lo
 * que se resuelve antes de responder.
 *
 * Body opcional { tituloIds: string[] }: solo esos títulos (ver "Editar
 * proyecto"). Sin body, todos los títulos con el plan tildado (wizard).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proyectoId } = await params;
    const acceso = await requerirProyecto(proyectoId);
    if (acceso instanceof NextResponse) return acceso;
    const body = await req.json().catch(() => null);
    const tituloIds: string[] | undefined =
      Array.isArray(body?.tituloIds) && body.tituloIds.every((x: unknown) => typeof x === "string") ? body.tituloIds : undefined;
    await generarCapituloSeguridad(proyectoId, tituloIds);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/generar-seguridad-altura]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
