import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const ESTADOS_VALIDOS = ["Pedido", "En camino", "Recibido", "Cancelado"];

// PATCH — edita una orden de compra, incluido cambiar estado y
// completar los datos de recepción. Sin DELETE a propósito:
// "Cancelado" reemplaza el borrado, mismo criterio que los 3 módulos
// anteriores de Gestión de Obra.
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; ordenId: string }> }
) {
  try {
    const { ordenId } = await context.params;
    const body = await req.json().catch(() => ({}));
    const {
      proveedor,
      descripcion,
      monto,
      moneda,
      fechaPedido,
      fechaEntregaPrevista,
      estado,
      fechaRecepcion,
      completo,
      observacionesRecepcion,
      capituloIds,
    } = body as {
      proveedor?: string;
      descripcion?: string;
      monto?: number | null;
      moneda?: string;
      fechaPedido?: string;
      fechaEntregaPrevista?: string;
      estado?: string;
      fechaRecepcion?: string;
      completo?: boolean | null;
      observacionesRecepcion?: string;
      capituloIds?: string[];
    };

    if (!proveedor?.trim()) {
      return NextResponse.json({ error: "Falta proveedor" }, { status: 400 });
    }
    if (!descripcion?.trim()) {
      return NextResponse.json({ error: "Falta descripción" }, { status: 400 });
    }
    if (estado && !ESTADOS_VALIDOS.includes(estado)) {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    }

    const existente = await db.ordenCompra.findUnique({ where: { id: ordenId } });
    if (!existente) {
      return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
    }

    const orden = await db.ordenCompra.update({
      where: { id: ordenId },
      data: {
        proveedor: proveedor.trim(),
        descripcion: descripcion.trim(),
        monto: monto ?? null,
        moneda: moneda === "USD" ? "USD" : "UYU",
        fechaPedido: fechaPedido ? new Date(fechaPedido) : null,
        fechaEntregaPrevista: fechaEntregaPrevista ? new Date(fechaEntregaPrevista) : null,
        estado: estado ?? existente.estado,
        fechaRecepcion: fechaRecepcion ? new Date(fechaRecepcion) : null,
        completo: completo ?? null,
        observacionesRecepcion: observacionesRecepcion?.trim() || null,
        capitulos: {
          deleteMany: {},
          create: (capituloIds ?? []).map((capituloId) => ({ capituloId })),
        },
      },
      include: { capitulos: { include: { capitulo: { select: { id: true, nombre: true, codigo: true } } } } },
    });

    return NextResponse.json(orden);
  } catch (err) {
    console.error("[PATCH /api/proyectos/[id]/ordenes-compra/[ordenId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
