import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const ESTADOS_VALIDOS = ["En negociación", "Contratado", "En obra", "Finalizado", "Cancelado"];

// GET — lista los subcontratistas del proyecto, con los capítulos
// vinculados (para el chip en la pantalla).
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const subcontratistas = await db.subcontratista.findMany({
      where: { proyectoId: id },
      include: { capitulos: { include: { capitulo: { select: { id: true, nombre: true, codigo: true } } } } },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(subcontratistas);
  } catch (err) {
    console.error("[GET /api/proyectos/[id]/subcontratistas]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST — crea un subcontratista.
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const {
      empresa,
      rut,
      rubro,
      personaContacto,
      telefono,
      email,
      montoContratado,
      moneda,
      fechaInicio,
      fechaFin,
      estado,
      capituloIds,
    } = body as {
      empresa?: string;
      rut?: string;
      rubro?: string;
      personaContacto?: string;
      telefono?: string;
      email?: string;
      montoContratado?: number | null;
      moneda?: string;
      fechaInicio?: string;
      fechaFin?: string;
      estado?: string;
      capituloIds?: string[];
    };

    if (!empresa?.trim()) {
      return NextResponse.json({ error: "Falta empresa" }, { status: 400 });
    }
    if (!rubro?.trim()) {
      return NextResponse.json({ error: "Falta rubro" }, { status: 400 });
    }
    if (estado && !ESTADOS_VALIDOS.includes(estado)) {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    }

    const proyecto = await db.proyecto.findUnique({ where: { id }, select: { id: true } });
    if (!proyecto) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const subcontratista = await db.subcontratista.create({
      data: {
        proyectoId: id,
        empresa: empresa.trim(),
        rut: rut?.trim() || null,
        rubro: rubro.trim(),
        personaContacto: personaContacto?.trim() || null,
        telefono: telefono?.trim() || null,
        email: email?.trim() || null,
        montoContratado: montoContratado ?? null,
        moneda: moneda === "USD" ? "USD" : "UYU",
        fechaInicio: fechaInicio ? new Date(fechaInicio) : null,
        fechaFin: fechaFin ? new Date(fechaFin) : null,
        estado: estado ?? "En negociación",
        capitulos: {
          create: (capituloIds ?? []).map((capituloId) => ({ capituloId })),
        },
      },
      include: { capitulos: { include: { capitulo: { select: { id: true, nombre: true, codigo: true } } } } },
    });

    return NextResponse.json(subcontratista, { status: 201 });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/subcontratistas]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
