import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { renderToBuffer } from "@react-pdf/renderer";
import { PresupuestoPDF, ProyectoConCapitulos } from "@/components/PresupuestoPDF";
import React from "react";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    const proyecto = await db.proyecto.findUnique({
      where: { id },
      include: {
        empresa: true,
        leyesSociales: true,
        capitulos: {
          orderBy: { orden: "asc" },
          include: {
            rubros: {
              orderBy: { codigo: "asc" },
            },
          },
        },
      },
    });

    if (!proyecto) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    // El AUC propietario NO va en Gastos Generales — se muestra aparte en
    // la línea "Leyes Sociales — Aporte Propietario" para evitar duplicarlo.
    const itemsExtras = Array.isArray(proyecto.gastosGeneralesItems)
      ? (proyecto.gastosGeneralesItems as { id: string; descripcion: string; monto: number }[])
      : [];
    const sumaItemsExtras = itemsExtras.reduce((s, item) => s + (item.monto || 0), 0);
    const gastosGenerales = proyecto.timbresCJP + sumaItemsExtras;

    const datos: ProyectoConCapitulos = {
      id: proyecto.id,
      nombre: proyecto.nombre,
      cliente: proyecto.cliente,
      tipo: proyecto.tipo,
      area: proyecto.area,
      direccion: proyecto.direccion,
      moneda: proyecto.moneda,
      empresa: proyecto.empresa ? { nombre: proyecto.empresa.nombre } : null,
      gastosGenerales,
      incluyeIVA: proyecto.incluyeIVA,
      montoImponibleMO: proyecto.leyesSociales?.montoImponibleMO ?? null,
      capitulos: proyecto.capitulos.map((cap) => ({
        id: cap.id,
        nombre: cap.nombre,
        codigo: cap.codigo,
        rubros: cap.rubros.map((r) => ({
          id: r.id,
          codigo: r.codigo,
          descripcion: r.descripcion,
          unidad: r.unidad,
          cantidad: r.cantidad,
          precioUnit: r.precioUnit,
        })),
      })),
    };

    const elemento = React.createElement(PresupuestoPDF, { proyecto: datos }) as Parameters<typeof renderToBuffer>[0];
    const buffer = await renderToBuffer(elemento);

    // Nombre de archivo seguro para el header (ASCII) + versión UTF-8 (RFC 5987) para nombres con tildes/símbolos
    const nombreBase = proyecto.nombre.replace(/\s+/g, "-");
    const nombreAscii = nombreBase.replace(/[^\x20-\x7E]/g, "").replace(/-+/g, "-") || "presupuesto";
    const nombreArchivoAscii = `Presupuesto-${nombreAscii}.pdf`;
    const nombreArchivoUtf8 = encodeURIComponent(`Presupuesto-${nombreBase}.pdf`);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${nombreArchivoAscii}"; filename*=UTF-8''${nombreArchivoUtf8}`,
      },
    });
  } catch (err) {
    console.error("[GET /api/proyectos/[id]/pdf]", err);
    return NextResponse.json({ error: "Error interno generando el PDF" }, { status: 500 });
  }
}
