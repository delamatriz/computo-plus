import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { eliminarArchivosDeBlob, urlProxyPlano, urlProxyFoto } from "@/lib/blob";

// El campo `archivo` en la base guarda la URL real (privada) de Vercel
// Blob — no servible directo por el browser. Antes de responder al cliente
// se reemplaza por la ruta proxy de nuestro servidor (ver urlProxyPlano/
// urlProxyFoto en @/lib/blob), que sí puede ir directo en <img src>/
// <Document file>.
function conUrlsProxy<T extends { id: string; archivo: string; fotos: { id: string; archivo: string }[] }>(
  proyectoId: string,
  plano: T
) {
  return {
    ...plano,
    archivo: urlProxyPlano(proyectoId, plano.id),
    fotos: plano.fotos.map((f) => ({ ...f, archivo: urlProxyFoto(proyectoId, plano.id, f.id) })),
  };
}

// GET — detalle completo de un plano (incluye `archivo`, para el visor) más
// sus fotos complementarias.
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string; planoId: string }> }
) {
  try {
    const { id: proyectoId, planoId } = await context.params;

    const plano = await db.planoProyecto.findUnique({
      where: { id: planoId },
      include: { fotos: { orderBy: { createdAt: "asc" } } },
    });

    if (!plano) {
      return NextResponse.json({ error: "Plano no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ plano: conUrlsProxy(proyectoId, plano) });
  } catch (err) {
    console.error("[GET /api/proyectos/[id]/planos/[planoId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// PATCH — actualiza las notas del plano (observaciones del relevamiento,
// absorbido de la vieja card "Documentación"). Único campo editable por
// ahora; nombre/archivo no se editan en esta etapa.
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; planoId: string }> }
) {
  try {
    const { id: proyectoId, planoId } = await context.params;
    const body = await req.json().catch(() => null);

    if (typeof body?.notas !== "string" && body?.notas !== null) {
      return NextResponse.json({ error: "Se esperaba { notas: string | null }" }, { status: 400 });
    }

    const plano = await db.planoProyecto.update({
      where: { id: planoId },
      data: { notas: body.notas?.trim() || null },
      include: { fotos: { orderBy: { createdAt: "asc" } } },
    });

    return NextResponse.json({ plano: conUrlsProxy(proyectoId, plano) });
  } catch (err) {
    console.error("[PATCH /api/proyectos/[id]/planos/[planoId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE — elimina el plano; las fotos complementarias se borran en cascada
// (onDelete: Cascade en el schema). Los archivos en Vercel Blob no se borran
// solos con el cascade de Postgres, así que se buscan antes y se eliminan
// aparte para no dejar huérfanos.
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string; planoId: string }> }
) {
  try {
    const { planoId } = await context.params;

    const plano = await db.planoProyecto.findUnique({
      where: { id: planoId },
      select: { archivo: true, fotos: { select: { archivo: true } } },
    });
    if (!plano) {
      return NextResponse.json({ error: "Plano no encontrado" }, { status: 404 });
    }

    await db.planoProyecto.delete({ where: { id: planoId } });

    await eliminarArchivosDeBlob([plano.archivo, ...plano.fotos.map((f) => f.archivo)]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/proyectos/[id]/planos/[planoId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
