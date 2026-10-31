import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { PedidoCotizacionPDF, type ItemPedidoCotizacionPDF } from "@/components/PedidoCotizacionPDF";
import { requerirProyecto } from "@/lib/sesion";
import { nombreProyectoParaMostrar } from "@/lib/resumenProyecto";

const MAX_ITEMS = 500;

// POST { proveedor, fechaLimite?, nota?, items: [{ descripcion, unidad, cantidad }] }
// → PDF del pedido de cotización. Los ítems vienen de la selección en el
// Cómputo Global (calculado en el cliente, ver lib/materialesGlobales.ts);
// no se guarda nada — es un documento para mandar al proveedor.
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const acceso = await requerirProyecto(id);
    if (acceso instanceof NextResponse) return acceso;

    const body = await req.json().catch(() => ({}));
    const { proveedor, fechaLimite, nota, items } = body as {
      proveedor?: unknown;
      fechaLimite?: unknown;
      nota?: unknown;
      items?: unknown;
    };

    if (typeof proveedor !== "string" || !proveedor.trim()) {
      return NextResponse.json({ error: "Falta el proveedor" }, { status: 400 });
    }
    if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS) {
      return NextResponse.json({ error: "Seleccioná al menos un material" }, { status: 400 });
    }
    const itemsValidos: ItemPedidoCotizacionPDF[] = [];
    for (const it of items as Record<string, unknown>[]) {
      if (
        typeof it?.descripcion !== "string" ||
        typeof it?.unidad !== "string" ||
        typeof it?.cantidad !== "number" ||
        !Number.isFinite(it.cantidad)
      ) {
        return NextResponse.json({ error: "Material inválido" }, { status: 400 });
      }
      itemsValidos.push({ descripcion: it.descripcion, unidad: it.unidad, cantidad: it.cantidad });
    }
    const fecha =
      typeof fechaLimite === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fechaLimite) ? fechaLimite : null;

    const proyecto = await db.proyecto.findUnique({
      where: { id },
      select: {
        nombre: true,
        direccion: true,
        empresa: { select: { nombre: true, rut: true, telefono: true, email: true, direccion: true } },
      },
    });
    if (!proyecto) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const elemento = React.createElement(PedidoCotizacionPDF, {
      empresa: {
        nombre: proyecto.empresa?.nombre || "Mi Empresa",
        rut: proyecto.empresa?.rut || null,
        telefono: proyecto.empresa?.telefono ?? null,
        email: proyecto.empresa?.email ?? null,
        direccion: proyecto.empresa?.direccion ?? null,
      },
      proyectoNombre: nombreProyectoParaMostrar(proyecto.nombre),
      direccionObra: proyecto.direccion,
      proveedor: proveedor.trim(),
      fechaLimite: fecha,
      nota: typeof nota === "string" && nota.trim() ? nota.trim() : null,
      items: itemsValidos,
    }) as Parameters<typeof renderToBuffer>[0];
    const buffer = await renderToBuffer(elemento);

    const nombreBase = `Pedido-Cotizacion-${proveedor.trim()}`.replace(/\s+/g, "-");
    const nombreAscii = nombreBase.replace(/[^\x20-\x7E]/g, "").replace(/["\\]/g, "").replace(/-+/g, "-") || "pedido-cotizacion";
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${nombreAscii}.pdf"; filename*=UTF-8''${encodeURIComponent(`${nombreBase}.pdf`)}`,
      },
    });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/pedido-cotizacion]", err);
    return NextResponse.json({ error: "Error interno generando el PDF" }, { status: 500 });
  }
}
