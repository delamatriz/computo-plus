import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { renderToBuffer } from "@react-pdf/renderer";
import { OrdenCompraPDF } from "@/components/OrdenCompraPDF";
import React from "react";

type Membrete = "empresa" | "proyecto";
const MEMBRETES_VALIDOS: Membrete[] = ["empresa", "proyecto"];

// GET — genera el PDF imprimible de una orden de compra, sin precios
// (documento para el proveedor externo). `membrete` elige el
// encabezado en el momento de generar, no se guarda en el modelo.
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; ordenId: string }> }
) {
  try {
    const { id, ordenId } = await context.params;
    const membreteParam = req.nextUrl.searchParams.get("membrete");
    const membrete: Membrete = MEMBRETES_VALIDOS.includes(membreteParam as Membrete)
      ? (membreteParam as Membrete)
      : "empresa";

    const [orden, proyecto, empresa, ordenesDelProyecto] = await Promise.all([
      db.ordenCompra.findUnique({
        where: { id: ordenId },
        include: { items: { orderBy: { createdAt: "asc" } } },
      }),
      db.proyecto.findUnique({
        where: { id },
        select: { nombre: true, cliente: true, clienteRazonSocial: true },
      }),
      db.empresa.findFirst({ select: { nombre: true } }),
      db.ordenCompra.findMany({
        where: { proyectoId: id },
        select: { id: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    if (!orden || orden.proyectoId !== id) {
      return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
    }
    if (!proyecto) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const numeroOrden = ordenesDelProyecto.findIndex((o) => o.id === ordenId) + 1;

    const membreteTitulo =
      membrete === "empresa"
        ? empresa?.nombre || "Mi Empresa"
        : proyecto.clienteRazonSocial || proyecto.cliente || proyecto.nombre;

    const elemento = React.createElement(OrdenCompraPDF, {
      membreteTitulo,
      numeroOrden,
      fecha: (orden.fechaPedido ?? orden.createdAt).toISOString(),
      fechaEsDePedido: orden.fechaPedido != null,
      proveedor: orden.proveedor,
      proyectoNombre: proyecto.nombre,
      estado: orden.estado,
      nota: orden.descripcion,
      items: orden.items.map((it) => ({
        descripcion: it.descripcion,
        unidad: it.unidad,
        cantidad: it.cantidad,
      })),
    }) as Parameters<typeof renderToBuffer>[0];
    const buffer = await renderToBuffer(elemento);

    const nombreBase = `Orden-Compra-N${numeroOrden}-${orden.proveedor}`.replace(/\s+/g, "-");
    const nombreAscii = nombreBase.replace(/[^\x20-\x7E]/g, "").replace(/-+/g, "-") || "orden-compra";
    const nombreArchivoAscii = `${nombreAscii}.pdf`;
    const nombreArchivoUtf8 = encodeURIComponent(`${nombreBase}.pdf`);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${nombreArchivoAscii}"; filename*=UTF-8''${nombreArchivoUtf8}`,
      },
    });
  } catch (err) {
    console.error("[GET /api/proyectos/[id]/ordenes-compra/[ordenId]/pdf]", err);
    return NextResponse.json({ error: "Error interno generando el PDF" }, { status: 500 });
  }
}
