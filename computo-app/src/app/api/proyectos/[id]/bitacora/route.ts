import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET — lista las entradas de la bitácora del proyecto, más reciente
// primero (numero desc — no fecha, porque pueden convivir varias
// entradas con la misma fecha). Incluye los rubros vinculados (con
// capítulo, para el chip "capítulo + descripción" de la pantalla) y el
// conteo de fotos, sin traer las fotos en sí — se piden aparte cuando
// se expande una entrada.
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const entradas = await db.entradaBitacora.findMany({
      where: { proyectoId: id },
      include: {
        rubros: {
          include: {
            rubro: { include: { capitulo: { select: { nombre: true } } } },
          },
        },
        _count: { select: { fotos: true } },
      },
      orderBy: { numero: "desc" },
    });
    return NextResponse.json(entradas);
  } catch (err) {
    console.error("[GET /api/proyectos/[id]/bitacora]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST — crea una entrada nueva. numero correlativo por proyecto,
// mismo criterio que Certificacion.numero. Sin fotos en este request
// — se suben aparte, ver .../[entradaId]/fotos.
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const {
      fecha,
      clima,
      climaDetalle,
      personalPresente,
      trabajosRealizados,
      materialesRecibidos,
      incidentes,
      instruccionesDadas,
      visitas,
      rubroIds,
    } = body as {
      fecha?: string;
      clima?: string;
      climaDetalle?: string;
      personalPresente?: string;
      trabajosRealizados?: string;
      materialesRecibidos?: string;
      incidentes?: string;
      instruccionesDadas?: string;
      visitas?: string;
      rubroIds?: string[];
    };

    if (!clima?.trim()) {
      return NextResponse.json({ error: "Falta clima" }, { status: 400 });
    }

    const proyecto = await db.proyecto.findUnique({ where: { id }, select: { id: true } });
    if (!proyecto) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const ultima = await db.entradaBitacora.findFirst({
      where: { proyectoId: id },
      orderBy: { numero: "desc" },
    });
    const numero = (ultima?.numero ?? 0) + 1;

    const entrada = await db.entradaBitacora.create({
      data: {
        proyectoId: id,
        numero,
        fecha: fecha ? new Date(fecha) : new Date(),
        clima: clima.trim(),
        climaDetalle: climaDetalle?.trim() || null,
        personalPresente: personalPresente ?? "",
        trabajosRealizados: trabajosRealizados ?? "",
        materialesRecibidos: materialesRecibidos ?? "",
        incidentes: incidentes ?? "",
        instruccionesDadas: instruccionesDadas ?? "",
        visitas: visitas ?? "",
        rubros: {
          create: (rubroIds ?? []).map((rubroId) => ({ rubroId })),
        },
      },
      include: {
        rubros: {
          include: {
            rubro: { include: { capitulo: { select: { nombre: true } } } },
          },
        },
        _count: { select: { fotos: true } },
      },
    });

    return NextResponse.json(entrada, { status: 201 });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/bitacora]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
