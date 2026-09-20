import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const ESTADOS_VALIDOS = ["En negociación", "Contratado", "En obra", "Finalizado", "Cancelado"];

// PATCH — edita un subcontratista, incluido cambiar estado. Sin
// DELETE a propósito: "Cancelado" es el estado que reemplaza el
// borrado, mismo criterio que Bitácora/PersonalObra.
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; subId: string }> }
) {
  try {
    const { subId } = await context.params;
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

    const existente = await db.subcontratista.findUnique({ where: { id: subId } });
    if (!existente) {
      return NextResponse.json({ error: "Subcontratista no encontrado" }, { status: 404 });
    }

    const subcontratista = await db.subcontratista.update({
      where: { id: subId },
      data: {
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
        estado: estado ?? existente.estado,
        capitulos: {
          deleteMany: {},
          create: (capituloIds ?? []).map((capituloId) => ({ capituloId })),
        },
      },
      include: { capitulos: { include: { capitulo: { select: { id: true, nombre: true, codigo: true } } } } },
    });

    return NextResponse.json(subcontratista);
  } catch (err) {
    console.error("[PATCH /api/proyectos/[id]/subcontratistas/[subId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
