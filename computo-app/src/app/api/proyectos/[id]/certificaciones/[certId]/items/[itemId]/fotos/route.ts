import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; certId: string; itemId: string }> }
) {
  try {
    const { itemId } = await context.params;

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
    const { itemId } = await context.params;
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
    const body = await req.json().catch(() => null);

    if (!body?.fotoId) {
      return NextResponse.json({ error: "Se esperaba { fotoId: string }" }, { status: 400 });
    }

    await db.fotoCertificacionItem.delete({ where: { id: body.fotoId } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/proyectos/[id]/certificaciones/[certId]/items/[itemId]/fotos]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
