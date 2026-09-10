import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolverCapituloCatalogoId } from "@/lib/capituloCatalogoResolver";

export async function GET(req: NextRequest) {
  const capituloId = req.nextUrl.searchParams.get("capituloId")?.trim();
  const subcapituloId = req.nextUrl.searchParams.get("subcapituloId")?.trim();

  try {
    const subrubros = await db.subrubroEstandar.findMany({
      where: {
        activo: true,
        ...(capituloId ? { capituloId, ...(subcapituloId ? { subcapituloId } : {}) } : {}),
      },
      include: {
        apuEstandar: { select: { id: true } },
        // Fase 2, Etapa 6a — nombre del subcapítulo vía relación, para que
        // el cliente ya no dependa de SubrubroEstandar.subcapitulo (string).
        subcapituloCatalogo: { select: { nombre: true } },
      },
      orderBy: { orden: { sort: "asc", nulls: "last" } },
    });

    const resultado = subrubros.map(({ apuEstandar, subcapituloCatalogo, ...sub }) => ({
      ...sub,
      tieneApuEstandar: apuEstandar != null,
      subcapituloNombre: subcapituloCatalogo?.nombre ?? null,
    }));

    return NextResponse.json(resultado);
  } catch (err) {
    console.error("[GET /api/subrubros-estandar]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * Guarda un nuevo rubro creado por el usuario en la biblioteca global de subrubros
 * típicos, para que esté disponible como sugerencia en futuros proyectos.
 * No sobreescribe si ya existe uno con la misma descripción en el mismo capítulo.
 */
export async function POST(req: NextRequest) {
  try {
    const { descripcion, unidad, capitulo, precioUY } = await req.json();

    if (!descripcion?.trim() || !unidad?.trim() || !capitulo?.trim() || precioUY == null) {
      return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
    }

    const descripcionLimpia = descripcion.trim();
    const capituloTipeado = capitulo.trim();
    const unidadLimpia = unidad.trim();

    // Fase 2, Etapa 6a/6b — la validación/dedup se basa en capituloId
    // (resuelto con el mismo criterio que la creación de capítulos reales,
    // Etapa 5), no en comparar strings a mano. Si no matchea, capituloId
    // queda null — mismo bucket para el dedup (dos rubros sin match siguen
    // dedupeando entre sí si coinciden en descripcion+unidad).
    const capituloId = await resolverCapituloCatalogoId(db, capituloTipeado);

    const existente = await db.subrubroEstandar.findFirst({
      where: {
        activo: true,
        capituloId: capituloId ?? null,
        descripcion: { equals: descripcionLimpia, mode: "insensitive" },
        unidad: { equals: unidadLimpia, mode: "insensitive" },
      },
    });
    if (existente) {
      if (precioUY > 0 && Math.abs(existente.precioUY - precioUY) > 1) {
        await db.subrubroEstandar.update({
          where: { id: existente.id },
          data: { precioUY, fechaBase: new Date().toISOString().slice(0, 7) },
        });
      }
      return NextResponse.json(existente);
    }

    // Placeholder de posición — cae al final de su capítulo (siempre
    // subcapituloId: null acá, este mecanismo nunca resuelve subcapítulo),
    // en vez de en una posición aleatoria por comparación de texto contra
    // "manual-<uuid>" (lo que pasaba antes de que `orden` existiera). No
    // intenta adivinar dónde "debería" ir por similitud — eso es la
    // curación de contenido de otra sesión.
    const maxOrden = await db.subrubroEstandar.aggregate({
      where: { activo: true, capituloId: capituloId ?? null, subcapituloId: null },
      _max: { orden: true },
    });
    const ordenNuevo = (maxOrden._max.orden ?? -1) + 1;

    const nuevo = await db.subrubroEstandar.create({
      data: {
        codigo: `manual-${randomUUID()}`,
        descripcion: descripcionLimpia,
        unidad: unidadLimpia,
        precioUY,
        fechaBase: new Date().toISOString().slice(0, 7),
        origen: "manual",
        capituloId,
        orden: ordenNuevo,
      },
    });
    return NextResponse.json(nuevo);
  } catch (err) {
    console.error("[POST /api/subrubros-estandar]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
