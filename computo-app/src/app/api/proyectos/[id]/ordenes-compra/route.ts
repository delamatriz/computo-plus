import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requerirProyecto, capitulosSonDelProyecto } from "@/lib/sesion";

const ESTADOS_VALIDOS = ["Pedido", "En camino", "Recibido", "Cancelado"];

// GET — lista las órdenes de compra del proyecto, con los capítulos
// vinculados.
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const acceso = await requerirProyecto(id);
    if (acceso instanceof NextResponse) return acceso;
    const ordenes = await db.ordenCompra.findMany({
      where: { proyectoId: id },
      include: {
        capitulos: { include: { capitulo: { select: { id: true, nombre: true, codigo: true } } } },
        items: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(ordenes);
  } catch (err) {
    console.error("[GET /api/proyectos/[id]/ordenes-compra]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST — crea una orden de compra.
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const acceso = await requerirProyecto(id);
    if (acceso instanceof NextResponse) return acceso;
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
    if (estado && !ESTADOS_VALIDOS.includes(estado)) {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    }

    const proyecto = await db.proyecto.findUnique({ where: { id }, select: { id: true } });
    if (!proyecto) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    if (!(await capitulosSonDelProyecto(capituloIds ?? [], id))) {
      return NextResponse.json({ error: "Hay capítulos que no son de este proyecto" }, { status: 400 });
    }

    const orden = await db.ordenCompra.create({
      data: {
        proyectoId: id,
        proveedor: proveedor.trim(),
        descripcion: descripcion?.trim() || "",
        monto: monto ?? null,
        moneda: moneda === "USD" ? "USD" : "UYU",
        fechaPedido: fechaPedido ? new Date(fechaPedido) : null,
        fechaEntregaPrevista: fechaEntregaPrevista ? new Date(fechaEntregaPrevista) : null,
        estado: estado ?? "Pedido",
        fechaRecepcion: fechaRecepcion ? new Date(fechaRecepcion) : null,
        completo: completo ?? null,
        observacionesRecepcion: observacionesRecepcion?.trim() || null,
        capitulos: {
          create: (capituloIds ?? []).map((capituloId) => ({ capituloId })),
        },
      },
      include: {
        capitulos: { include: { capitulo: { select: { id: true, nombre: true, codigo: true } } } },
        items: { orderBy: { createdAt: "asc" } },
      },
    });

    return NextResponse.json(orden, { status: 201 });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/ordenes-compra]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
