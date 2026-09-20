import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; entradaId: string }> }
) {
  try {
    const { entradaId } = await context.params;

    const fotos = await db.fotoEntradaBitacora.findMany({
      where: { entradaBitacoraId: entradaId },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ fotos });
  } catch (err) {
    console.error("[GET /api/proyectos/[id]/bitacora/[entradaId]/fotos]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; entradaId: string }> }
) {
  try {
    const { entradaId } = await context.params;
    const body = await req.json().catch(() => null);

    if (!body || !Array.isArray(body.fotos)) {
      return NextResponse.json({ error: "Se esperaba { fotos: string[] }" }, { status: 400 });
    }

    const fotos = body.fotos as string[];

    await db.$transaction(
      fotos.map((url) =>
        db.fotoEntradaBitacora.create({
          data: { entradaBitacoraId: entradaId, url },
        })
      )
    );

    const todasLasFotos = await db.fotoEntradaBitacora.findMany({
      where: { entradaBitacoraId: entradaId },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ fotos: todasLasFotos });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/bitacora/[entradaId]/fotos]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; entradaId: string }> }
) {
  try {
    const body = await req.json().catch(() => null);

    if (!body?.fotoId) {
      return NextResponse.json({ error: "Se esperaba { fotoId: string }" }, { status: 400 });
    }

    await db.fotoEntradaBitacora.delete({ where: { id: body.fotoId } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/proyectos/[id]/bitacora/[entradaId]/fotos]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
