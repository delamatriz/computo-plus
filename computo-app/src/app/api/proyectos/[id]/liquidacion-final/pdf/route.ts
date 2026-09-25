import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { renderToBuffer } from "@react-pdf/renderer";
import { LiquidacionFinalPDF } from "@/components/LiquidacionFinalPDF";
import { calcularTotalCertificadoAgregado, calcularCruceCertificacion } from "@/lib/totalCertificadoAgregado";
import { INCLUDE_VINCULO_AJUSTE } from "@/lib/vinculoAjusteLiquidacion";
import React from "react";

function calcularTotalLiquidado(presupuestoOriginal: number, ajustes: { monto: number; tipo: string }[]): number {
  const sumaAdicionales = ajustes.filter((a) => a.tipo === "Adicional").reduce((s, a) => s + a.monto, 0);
  const sumaDescuentos = ajustes.filter((a) => a.tipo === "Descuento").reduce((s, a) => s + a.monto, 0);
  return presupuestoOriginal + sumaAdicionales - sumaDescuentos;
}

// GET — genera el PDF imprimible de la Liquidación Final. Usa el
// Presupuesto Original ya congelado (presupuestoOriginalSnapshot) —
// nunca lo recalcula, mismo criterio que el GET normal del módulo.
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const [proyecto, liquidacion, certificaciones] = await Promise.all([
      db.proyecto.findUnique({
        where: { id },
        include: { empresa: true },
      }),
      db.liquidacionFinal.findUnique({
        where: { proyectoId: id },
        include: { ajustes: { orderBy: { createdAt: "asc" }, include: INCLUDE_VINCULO_AJUSTE } },
      }),
      db.certificacion.findMany({
        where: { proyectoId: id },
        include: { items: { include: { rubro: { select: { cantidad: true, precioUnit: true } } } } },
      }),
    ]);

    if (!proyecto) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }
    if (!liquidacion) {
      return NextResponse.json({ error: "Este proyecto todavía no tiene liquidación final" }, { status: 404 });
    }

    const totalLiquidado = calcularTotalLiquidado(liquidacion.presupuestoOriginalSnapshot, liquidacion.ajustes);
    const cruceCertificacion = calcularCruceCertificacion(
      calcularTotalCertificadoAgregado(certificaciones),
      totalLiquidado
    );

    const elemento = React.createElement(LiquidacionFinalPDF, {
      empresaNombreHeader: proyecto.empresa?.nombre || "Mi Empresa",
      proyectoNombre: proyecto.nombre,
      fechaLiquidacion: liquidacion.fechaLiquidacion ? liquidacion.fechaLiquidacion.toISOString() : null,
      presupuestoOriginal: liquidacion.presupuestoOriginalSnapshot,
      ajustes: liquidacion.ajustes.map((a) => ({
        concepto: a.concepto,
        monto: a.monto,
        tipo: a.tipo,
        referenciaVinculo: a.ordenCompra
          ? `Vinculado a Orden de Compra — ${a.ordenCompra.proveedor}`
          : a.subcontratista
          ? `Vinculado a Subcontratista — ${a.subcontratista.empresa}`
          : null,
      })),
      totalLiquidado,
      cruceCertificacion,
      observaciones: liquidacion.observaciones,
      moneda: proyecto.moneda,
    }) as Parameters<typeof renderToBuffer>[0];
    const buffer = await renderToBuffer(elemento);

    const nombreBase = `Liquidacion-Final-${proyecto.nombre}`.replace(/\s+/g, "-");
    const nombreAscii = nombreBase.replace(/[^\x20-\x7E]/g, "").replace(/-+/g, "-") || "liquidacion-final";
    const nombreArchivoAscii = `${nombreAscii}.pdf`;
    const nombreArchivoUtf8 = encodeURIComponent(`${nombreBase}.pdf`);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${nombreArchivoAscii}"; filename*=UTF-8''${nombreArchivoUtf8}`,
      },
    });
  } catch (err) {
    console.error("[GET /api/proyectos/[id]/liquidacion-final/pdf]", err);
    return NextResponse.json({ error: "Error interno generando el PDF" }, { status: 500 });
  }
}
