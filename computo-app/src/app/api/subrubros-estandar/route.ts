import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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
      include: { apuEstandar: { select: { id: true } } },
      orderBy: { codigo: "asc" },
    });

    const resultado = subrubros.map(({ apuEstandar, ...sub }) => ({
      ...sub,
      tieneApuEstandar: apuEstandar != null,
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

    // El capítulo llega como texto libre desde el nombre de capítulo del
    // proyecto — nunca se valida contra la biblioteca real. Así nació
    // "Demoliciones y Picados": un capítulo de proyecto que no coincidía con
    // ningún capítulo de SubrubroEstandar terminó creando uno nuevo con datos
    // duplicados y sin control de calidad. Mapeamos contra los capítulos
    // activos que YA organizan la biblioteca (no contra CapituloEstandar: esa
    // tabla es un catálogo de nombres para crear proyectos nuevos, con
    // nombres que en su mayoría no coinciden textualmente con
    // SubrubroEstandar.capitulo — usarla acá mandaría la mayoría de los
    // guardados legítimos a "Sin clasificar". Ver auditoría 12/07/2026).
    const capitulosActivos = await db.subrubroEstandar.findMany({
      where: { activo: true },
      distinct: ["capitulo"],
      select: { capitulo: true },
    });
    const capituloValido = capitulosActivos.find(
      (c) => c.capitulo.toLowerCase() === capituloTipeado.toLowerCase()
    )?.capitulo;
    const capituloFinal = capituloValido ?? CAPITULO_SIN_CLASIFICAR;

    const existente = await db.subrubroEstandar.findFirst({
      where: {
        activo: true,
        capitulo: capituloFinal,
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

    // Fase 2, Etapa 3 — resolver capituloId contra el catálogo canónico
    // para que el subrubro nuevo no quede huérfano de FK. Si el capítulo
    // no está dado de alta ahí (caso borde — hoy no debería pasar, ya que
    // capituloFinal viene de capitulosActivos ya validado contra la
    // biblioteca real, salvo el fallback "Sin clasificar", que nunca
    // tiene entrada de catálogo), no bloquea la creación: se guarda igual
    // con capitulo (string) y capituloId nulo, y queda pendiente de alta
    // manual en el catálogo.
    const capituloCatalogo = await db.capituloCatalogo.findUnique({
      where: { nombre: capituloFinal },
    });
    if (!capituloCatalogo) {
      console.warn(`[POST /api/subrubros-estandar] Sin CapituloCatalogo para "${capituloFinal}" — se guarda sin capituloId`);
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
        capituloId: capituloCatalogo?.id,
      },
    });
    return NextResponse.json(nuevo);
  } catch (err) {
    console.error("[POST /api/subrubros-estandar]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
