import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requerirProyecto, hijoNoEncontrado } from "@/lib/sesion";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; entradaId: string }> }
) {
  try {
    const { id, entradaId } = await context.params;
    const acceso = await requerirProyecto(id);
    if (acceso instanceof NextResponse) return acceso;
    const entradaOk = await db.entradaBitacora.findFirst({ where: { id: entradaId, proyectoId: id }, select: { id: true } });
    if (!entradaOk) return hijoNoEncontrado("Entrada no encontrada");

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
    const { id, entradaId } = await context.params;
    const acceso = await requerirProyecto(id);
    if (acceso instanceof NextResponse) return acceso;
    const entradaOk = await db.entradaBitacora.findFirst({ where: { id: entradaId, proyectoId: id }, select: { id: true } });
    if (!entradaOk) return hijoNoEncontrado("Entrada no encontrada");
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
    const { id, entradaId } = await context.params;
    const acceso = await requerirProyecto(id);
    if (acceso instanceof NextResponse) return acceso;
    const entradaOk = await db.entradaBitacora.findFirst({ where: { id: entradaId, proyectoId: id }, select: { id: true } });
    if (!entradaOk) return hijoNoEncontrado("Entrada no encontrada");
    const body = await req.json().catch(() => null);

    if (!body?.fotoId) {
      return NextResponse.json({ error: "Se esperaba { fotoId: string }" }, { status: 400 });
    }

    const borradas = await db.fotoEntradaBitacora.deleteMany({ where: { id: body.fotoId, entradaBitacoraId: entradaId } });
    if (borradas.count === 0) return hijoNoEncontrado("Foto no encontrada");

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/proyectos/[id]/bitacora/[entradaId]/fotos]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
