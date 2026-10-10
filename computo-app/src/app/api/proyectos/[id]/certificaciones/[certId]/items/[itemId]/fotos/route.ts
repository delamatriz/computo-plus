import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requerirProyecto, hijoNoEncontrado } from "@/lib/sesion";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; certId: string; itemId: string }> }
) {
  try {
    const { id, certId, itemId } = await context.params;
    const acceso = await requerirProyecto(id);
    if (acceso instanceof NextResponse) return acceso;
    const itemOk = await db.certificacionItem.findFirst({
      where: { id: itemId, certificacionId: certId, certificacion: { proyectoId: id } },
      select: { id: true },
    });
    if (!itemOk) return hijoNoEncontrado("Ítem no encontrado");

    const fotos = await db.fotoCertificacionItem.findMany({
      where: { certificacionItemId: itemId },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ fotos });
  } catch (err) {
    console.error("[GET /api/proyectos/[id]/certificaciones/[certId]/items/[itemId]/fotos]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; certId: string; itemId: string }> }
) {
  try {
    const { id, certId, itemId } = await context.params;
    const acceso = await requerirProyecto(id);
    if (acceso instanceof NextResponse) return acceso;
    const itemOk = await db.certificacionItem.findFirst({
      where: { id: itemId, certificacionId: certId, certificacion: { proyectoId: id } },
      select: { id: true },
    });
    if (!itemOk) return hijoNoEncontrado("Ítem no encontrado");
    const body = await req.json().catch(() => null);

    if (!body || !Array.isArray(body.fotos)) {
      return NextResponse.json({ error: "Se esperaba { fotos: string[] }" }, { status: 400 });
    }

    const fotos = body.fotos as string[];

    await db.$transaction(
      fotos.map((url) =>
        db.fotoCertificacionItem.create({
          data: { certificacionItemId: itemId, url },
        })
      )
    );

    const todasLasFotos = await db.fotoCertificacionItem.findMany({
      where: { certificacionItemId: itemId },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ fotos: todasLasFotos });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/certificaciones/[certId]/items/[itemId]/fotos]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; certId: string; itemId: string }> }
) {
  try {
    const { id, certId, itemId } = await context.params;
    const acceso = await requerirProyecto(id);
    if (acceso instanceof NextResponse) return acceso;
    const itemOk = await db.certificacionItem.findFirst({
      where: { id: itemId, certificacionId: certId, certificacion: { proyectoId: id } },
      select: { id: true },
    });
    if (!itemOk) return hijoNoEncontrado("Ítem no encontrado");
    const body = await req.json().catch(() => null);

    if (!body?.fotoId) {
      return NextResponse.json({ error: "Se esperaba { fotoId: string }" }, { status: 400 });
    }

    const borradas = await db.fotoCertificacionItem.deleteMany({ where: { id: body.fotoId, certificacionItemId: itemId } });
    if (borradas.count === 0) return hijoNoEncontrado("Foto no encontrada");

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/proyectos/[id]/certificaciones/[certId]/items/[itemId]/fotos]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
