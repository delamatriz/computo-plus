import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requerirProyecto, hijoNoEncontrado } from "@/lib/sesion";
import { subirArchivoABlob, eliminarArchivosDeBlob } from "@/lib/blob";

// Fotos de una entrada de bitácora. Las nuevas se suben a Vercel Blob
// (privado) y en FotoEntradaBitacora.url queda la URL de Blob; las viejas
// (antes de nov-2026) siguen guardadas como data URL base64 en ese mismo
// campo. Al cliente nunca le llega la URL de Blob: recibe la ruta proxy
// .../fotos/[fotoId], que sirve cualquiera de los dos formatos.

type FotoDb = { id: string; url: string; createdAt: Date };

function paraCliente(proyectoId: string, entradaId: string, f: FotoDb) {
  return {
    id: f.id,
    url: `/api/proyectos/${proyectoId}/bitacora/${entradaId}/fotos/${f.id}`,
    createdAt: f.createdAt,
  };
}

async function listar(proyectoId: string, entradaId: string) {
  const fotos = await db.fotoEntradaBitacora.findMany({
    where: { entradaBitacoraId: entradaId },
    orderBy: { createdAt: "asc" },
  });
  return fotos.map((f) => paraCliente(proyectoId, entradaId, f));
}

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

    return NextResponse.json({ fotos: await listar(id, entradaId) });
  } catch (err) {
    console.error("[GET /api/proyectos/[id]/bitacora/[entradaId]/fotos]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST { fotos: string[] } — data URLs de imagen (el cliente ya las reduce,
// ver lib/reducirFotoObra.ts). Todas se suben a Blob antes de crear los
// registros; si una falla se borran las ya subidas y no se crea ninguna.
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
    const fotos = body.fotos as unknown[];
    if (fotos.some((f) => typeof f !== "string" || !/^data:image\/[a-z+.-]+;base64,/.test(f))) {
      return NextResponse.json({ error: "Solo se aceptan imágenes" }, { status: 400 });
    }

    const subidas: string[] = [];
    try {
      for (const foto of fotos as string[]) {
        const ext = foto.slice("data:image/".length, foto.indexOf(";")).replace("jpeg", "jpg");
        subidas.push(await subirArchivoABlob(`bitacora/${id}/${entradaId}/foto.${ext}`, foto));
      }
    } catch (err) {
      console.error("[POST /api/proyectos/[id]/bitacora/[entradaId]/fotos] subida a blob", err);
      await eliminarArchivosDeBlob(subidas);
      return NextResponse.json({ error: "No se pudo subir la foto" }, { status: 400 });
    }

    await db.$transaction(
      subidas.map((url) => db.fotoEntradaBitacora.create({ data: { entradaBitacoraId: entradaId, url } }))
    );

    return NextResponse.json({ fotos: await listar(id, entradaId) });
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

    const foto = await db.fotoEntradaBitacora.findFirst({
      where: { id: body.fotoId, entradaBitacoraId: entradaId },
      select: { id: true, url: true },
    });
    if (!foto) return hijoNoEncontrado("Foto no encontrada");

    await db.fotoEntradaBitacora.delete({ where: { id: foto.id } });
    // Las fotos viejas en base64 no tienen archivo en Blob que borrar.
    if (!foto.url.startsWith("data:")) await eliminarArchivosDeBlob([foto.url]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/proyectos/[id]/bitacora/[entradaId]/fotos]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
