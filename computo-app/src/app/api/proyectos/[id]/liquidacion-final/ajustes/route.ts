import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolverVinculoAjuste, INCLUDE_VINCULO_AJUSTE } from "@/lib/vinculoAjusteLiquidacion";

const TIPOS_VALIDOS = ["Adicional", "Descuento"];

// POST — agrega un ajuste a la liquidación final.
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const { concepto, monto, tipo, ordenCompraId, subcontratistaId } = body as {
      concepto?: string;
      monto?: number;
      tipo?: string;
      ordenCompraId?: string | null;
      subcontratistaId?: string | null;
    };

    if (!concepto?.trim()) {
      return NextResponse.json({ error: "Falta concepto" }, { status: 400 });
    }
    if (monto == null || monto <= 0) {
      return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
    }
    if (!tipo || !TIPOS_VALIDOS.includes(tipo)) {
      return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
    }

    const liquidacion = await db.liquidacionFinal.findUnique({ where: { proyectoId: id } });
    if (!liquidacion) {
      return NextResponse.json({ error: "Este proyecto todavía no tiene liquidación final" }, { status: 404 });
    }

    const vinculo = await resolverVinculoAjuste(id, ordenCompraId, subcontratistaId);
    if ("error" in vinculo) {
      return NextResponse.json({ error: vinculo.error }, { status: 400 });
    }

    const ajuste = await db.ajusteLiquidacion.create({
      data: {
        liquidacionFinalId: liquidacion.id,
        concepto: concepto.trim(),
        monto,
        tipo,
        ordenCompraId: vinculo.ordenCompraId,
        subcontratistaId: vinculo.subcontratistaId,
      },
      include: INCLUDE_VINCULO_AJUSTE,
    });

    return NextResponse.json(ajuste, { status: 201 });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/liquidacion-final/ajustes]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
