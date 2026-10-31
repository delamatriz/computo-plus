import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requerirProyecto, hijoNoEncontrado } from "@/lib/sesion";

// PATCH { diasTrabajados?, jornal?, observaciones? } — edición inline de un
// renglón de la planilla. categoria y aportesPatronalesPct no se editan: son
// el snapshot del momento en que se registró.
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; registroId: string }> }
) {
  try {
    const { id, registroId } = await context.params;
    const acceso = await requerirProyecto(id);
    if (acceso instanceof NextResponse) return acceso;
    const existe = await db.jornalPagado.findFirst({ where: { id: registroId, proyectoId: id }, select: { id: true } });
    if (!existe) return hijoNoEncontrado("Registro no encontrado");

    const body = await req.json().catch(() => ({}));
    const { diasTrabajados, jornal, observaciones } = body as {
      diasTrabajados?: unknown;
      jornal?: unknown;
      observaciones?: unknown;
    };

    const data: { diasTrabajados?: number; jornal?: number; observaciones?: string | null } = {};
    if (diasTrabajados !== undefined) {
      if (typeof diasTrabajados !== "number" || !Number.isFinite(diasTrabajados) || diasTrabajados < 0 || diasTrabajados > 7) {
        return NextResponse.json({ error: "Días trabajados: entre 0 y 7" }, { status: 400 });
      }
      data.diasTrabajados = diasTrabajados;
    }
    if (jornal !== undefined) {
      if (typeof jornal !== "number" || !Number.isFinite(jornal) || jornal < 0) {
        return NextResponse.json({ error: "Jornal inválido" }, { status: 400 });
      }
      data.jornal = jornal;
    }
    if (observaciones !== undefined) {
      data.observaciones = typeof observaciones === "string" && observaciones.trim() ? observaciones.trim() : null;
    }

    const registro = await db.jornalPagado.update({
      where: { id: registroId },
      data,
      include: { personalObra: { select: { id: true, nombre: true, cuadrilla: true } } },
    });
    return NextResponse.json(registro);
  } catch (err) {
    console.error("[PATCH /api/proyectos/[id]/jornales/[registroId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE — quita a una persona de la planilla de una semana (carga por error).
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; registroId: string }> }
) {
  try {
    const { id, registroId } = await context.params;
    const acceso = await requerirProyecto(id);
    if (acceso instanceof NextResponse) return acceso;
    const { count } = await db.jornalPagado.deleteMany({ where: { id: registroId, proyectoId: id } });
    if (count === 0) return hijoNoEncontrado("Registro no encontrado");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/proyectos/[id]/jornales/[registroId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
