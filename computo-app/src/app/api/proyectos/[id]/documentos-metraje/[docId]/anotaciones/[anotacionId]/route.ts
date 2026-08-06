import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// DELETE — borra una anotación (corrección de un trazo/texto mal
// puesto), mismo criterio que .../mediciones/[medicionId].
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string; docId: string; anotacionId: string }> }
) {
  try {
    const { docId, anotacionId } = await context.params;

    const anotacion = await db.anotacion.findUnique({
      where: { id: anotacionId },
      select: { documentoId: true },
    });
    if (!anotacion || anotacion.documentoId !== docId) {
      return NextResponse.json({ error: "Anotación no encontrada" }, { status: 404 });
    }

    await db.anotacion.delete({ where: { id: anotacionId } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/proyectos/[id]/documentos-metraje/[docId]/anotaciones/[anotacionId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// PATCH — mueve y/o redimensiona un Texto ya guardado (arrastrar el
// texto o su handle de tamaño directo sobre el plano — ver
// iniciarMoverTextoGuardado/iniciarRedimensionarTextoGuardado en
// Visor.tsx). Solo aplica a tipo=TEXTO — Trazo libre no tiene x/y/tamano
// propios (su geometría es el array `puntos`, que no se edita acá).
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; docId: string; anotacionId: string }> }
) {
  try {
    const { docId, anotacionId } = await context.params;
    const body = await req.json().catch(() => null);

    const anotacion = await db.anotacion.findUnique({
      where: { id: anotacionId },
      select: { documentoId: true, tipo: true },
    });
    if (!anotacion || anotacion.documentoId !== docId) {
      return NextResponse.json({ error: "Anotación no encontrada" }, { status: 404 });
    }
    if (anotacion.tipo !== "TEXTO") {
      return NextResponse.json({ error: "Solo se puede mover/redimensionar una anotación de tipo TEXTO" }, { status: 400 });
    }

    const data: { x?: number; y?: number; tamano?: number } = {};
    if (body?.x !== undefined) {
      if (typeof body.x !== "number" || !isFinite(body.x) || body.x < 0 || body.x > 100) {
        return NextResponse.json({ error: "x tiene que ser 0-100" }, { status: 400 });
      }
      data.x = body.x;
    }
    if (body?.y !== undefined) {
      if (typeof body.y !== "number" || !isFinite(body.y) || body.y < 0 || body.y > 100) {
        return NextResponse.json({ error: "y tiene que ser 0-100" }, { status: 400 });
      }
      data.y = body.y;
    }
    if (body?.tamano !== undefined) {
      if (typeof body.tamano !== "number" || !isFinite(body.tamano) || body.tamano < 4 || body.tamano > 72) {
        return NextResponse.json({ error: "tamano tiene que ser 4-72" }, { status: 400 });
      }
      data.tamano = body.tamano;
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nada para actualizar — se esperaba x, y y/o tamano" }, { status: 400 });
    }

    const actualizada = await db.anotacion.update({ where: { id: anotacionId }, data });
    return NextResponse.json({ anotacion: actualizada });
  } catch (err) {
    console.error("[PATCH /api/proyectos/[id]/documentos-metraje/[docId]/anotaciones/[anotacionId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
