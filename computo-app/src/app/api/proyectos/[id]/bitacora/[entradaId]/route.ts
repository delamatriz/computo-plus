import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// PATCH — edita una entrada existente: reemplaza los campos de texto y
// el set completo de rubros vinculados. Sin DELETE de entrada completa
// a propósito (la bitácora se corrige, no se borra) — editadoEn se
// setea acá siempre, nunca lo manda el cliente: todo PATCH llega
// necesariamente después de la creación (no hay otro momento posible
// en que se llame a esta ruta).
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; entradaId: string }> }
) {
  try {
    const { entradaId } = await context.params;
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

    const existente = await db.entradaBitacora.findUnique({ where: { id: entradaId } });
    if (!existente) {
      return NextResponse.json({ error: "Entrada no encontrada" }, { status: 404 });
    }

    // deleteMany + create anidados en el mismo update — reemplazo atómico
    // del set de rubros vinculados, sin dejar una ventana inconsistente
    // entre borrar los viejos y crear los nuevos.
    const entrada = await db.entradaBitacora.update({
      where: { id: entradaId },
      data: {
        fecha: fecha ? new Date(fecha) : existente.fecha,
        clima: clima.trim(),
        climaDetalle: climaDetalle?.trim() || null,
        personalPresente: personalPresente ?? "",
        trabajosRealizados: trabajosRealizados ?? "",
        materialesRecibidos: materialesRecibidos ?? "",
        incidentes: incidentes ?? "",
        instruccionesDadas: instruccionesDadas ?? "",
        visitas: visitas ?? "",
        editadoEn: new Date(),
        rubros: {
          deleteMany: {},
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

    return NextResponse.json(entrada);
  } catch (err) {
    console.error("[PATCH /api/proyectos/[id]/bitacora/[entradaId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
