import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const capitulo = req.nextUrl.searchParams.get("capitulo")?.trim();

  try {
    const subrubros = await db.subrubroEstandar.findMany({
      where: {
        activo: true,
        ...(capitulo ? { capitulo } : {}),
      },
      orderBy: { codigo: "asc" },
    });

    return NextResponse.json(subrubros);
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
    const capituloLimpio = capitulo.trim();

    const existente = await db.subrubroEstandar.findFirst({
      where: {
        capitulo: capituloLimpio,
        descripcion: { equals: descripcionLimpia, mode: "insensitive" },
      },
    });
    if (existente) {
      return NextResponse.json(existente);
    }

    const nuevo = await db.subrubroEstandar.create({
      data: {
        codigo: `manual-${randomUUID()}`,
        capitulo: capituloLimpio,
        descripcion: descripcionLimpia,
        unidad: unidad.trim(),
        precioUY,
        fechaBase: new Date().toISOString().slice(0, 7),
        origen: "manual",
      },
    });
    return NextResponse.json(nuevo);
  } catch (err) {
    console.error("[POST /api/subrubros-estandar]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
