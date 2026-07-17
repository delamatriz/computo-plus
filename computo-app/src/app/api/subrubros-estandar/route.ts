import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolverCapituloCatalogoId } from "@/lib/capituloCatalogoResolver";

export async function GET(req: NextRequest) {
  const capituloId = req.nextUrl.searchParams.get("capituloId")?.trim();
  const subcapituloId = req.nextUrl.searchParams.get("subcapituloId")?.trim();
  // Fallback de compatibilidad — se mantiene mientras existan llamadores
  // que todavía resuelvan por nombre en vez de capituloId (ver
  // FASE2-DISENO-UNIFICACION-TAXONOMIAS.md, Etapa 3).
  const capitulo = req.nextUrl.searchParams.get("capitulo")?.trim();

  try {
    const subrubros = await db.subrubroEstandar.findMany({
      where: {
        activo: true,
        ...(capituloId
          ? { capituloId, ...(subcapituloId ? { subcapituloId } : {}) }
          : capitulo
            ? { capitulo }
            : {}),
      },
      include: {
        apuEstandar: { select: { id: true } },
        // Fase 2, Etapa 6a — nombre del subcapítulo vía relación, para que
        // el cliente ya no dependa de SubrubroEstandar.subcapitulo (string).
        subcapituloCatalogo: { select: { nombre: true } },
      },
      orderBy: { codigo: "asc" },
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

// Capítulo fijo para rubros cuyo capítulo de proyecto no coincide con ningún
// capítulo activo real de biblioteca — evita crear capítulos fantasma nuevos
// (ver caso "Demoliciones y Picados", auditoría 12/07/2026).
const CAPITULO_SIN_CLASIFICAR = "Sin clasificar";

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

    // Fase 2, Etapa 6a — la validación/dedup ya no compara el string a mano
    // contra la biblioteca: se resuelve capituloId con el mismo criterio
    // que usa la creación de capítulos reales (Etapa 5, mismo
    // resolverCapituloCatalogoId — alias de CAPITULOS_SAU + CapituloCatalogo).
    // El string "capitulo" se sigue persistiendo (Etapa 6b lo elimina), pero
    // ya no es la fuente de verdad para decidir a qué capítulo pertenece ni
    // para el dedup. Si no matchea, capituloId queda null — mismo bucket
    // para el dedup que el viejo "Sin clasificar" (dos rubros sin match
    // siguen dedupeando entre sí si coinciden en descripcion+unidad, igual
    // que hacía el string compartido antes).
    const capituloId = await resolverCapituloCatalogoId(db, capituloTipeado);
    let capituloFinal = CAPITULO_SIN_CLASIFICAR;
    if (capituloId) {
      const capituloCatalogo = await db.capituloCatalogo.findUnique({
        where: { id: capituloId },
        select: { nombre: true },
      });
      capituloFinal = capituloCatalogo?.nombre ?? CAPITULO_SIN_CLASIFICAR;
    }

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

    const nuevo = await db.subrubroEstandar.create({
      data: {
        codigo: `manual-${randomUUID()}`,
        capitulo: capituloFinal,
        descripcion: descripcionLimpia,
        unidad: unidadLimpia,
        precioUY,
        fechaBase: new Date().toISOString().slice(0, 7),
        origen: "manual",
        capituloId,
      },
    });
    return NextResponse.json(nuevo);
  } catch (err) {
    console.error("[POST /api/subrubros-estandar]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
