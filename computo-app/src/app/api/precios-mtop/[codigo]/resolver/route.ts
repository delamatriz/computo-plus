import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type AccionResolucion = "aceptar" | "mantener" | "manual";
const ACCIONES_VALIDAS: AccionResolucion[] = ["aceptar", "mantener", "manual"];

// Cola de Revisión (Etapa 4, FEAT-AI-006) — resuelve a mano un material con
// requiereVerificacion=true. Dos UX distintas bajo el mismo flag (ver
// relevamiento): "sin_precio_referencia" nunca tuvo precio (solo "manual"
// tiene sentido); cualquier otro motivo (ej. "variacion_alta") trae un
// precioSugeridoPendiente de la IA, con las tres acciones disponibles.
//
// fechaUltimaVerificacion se actualiza en las 3 acciones — crítico para
// que el ítem no vuelva a aparecer como elegible en el próximo "Buscar
// precios actualizados" apenas se resuelve (misma exclusión por recencia
// de GET /api/configuracion/precios-mercado/elegibles).
//
// detalleVerificacion/urlReferencia se conservan solo si "aceptar" (siguen
// describiendo por qué el precio activo es el que es); se limpian en
// "mantener"/"manual" porque el precio activo ya no tiene relación con lo
// que encontró la IA. Sin historial aparte — mismo criterio que
// verificarPrecioMTOP() al auto-aplicar, que tampoco deja rastro.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ codigo: string }> }
) {
  try {
    const { codigo } = await params;
    const body = await req.json().catch(() => ({}));
    const accion: unknown = body?.accion;

    if (typeof accion !== "string" || !ACCIONES_VALIDAS.includes(accion as AccionResolucion)) {
      return NextResponse.json(
        { error: "accion_invalida", mensaje: `accion debe ser una de: ${ACCIONES_VALIDAS.join(", ")}` },
        { status: 400 }
      );
    }

    const item = await db.precioMTOP.findUnique({ where: { codigo } });
    if (!item) {
      return NextResponse.json({ error: "no_encontrado", mensaje: "Código no encontrado" }, { status: 404 });
    }

    if (!item.requiereVerificacion) {
      return NextResponse.json(
        { error: "no_pendiente", mensaje: "Este material no está pendiente de revisión — nada que resolver." },
        { status: 400 }
      );
    }

    const base = {
      requiereVerificacion: false,
      motivoVerificacion: null,
      precioSugeridoPendiente: null,
      fechaUltimaVerificacion: new Date(),
    };

    if (accion === "aceptar") {
      if (item.precioSugeridoPendiente == null) {
        return NextResponse.json(
          { error: "sin_precio_sugerido", mensaje: "No hay precio sugerido para aceptar." },
          { status: 400 }
        );
      }
      const precio = item.precioSugeridoPendiente;
      const actualizado = await db.precioMTOP.update({
        where: { codigo },
        data: { ...base, precioUnitario: precio, precioConIva: precio },
      });
      return NextResponse.json(actualizado);
    }

    if (accion === "mantener") {
      if (item.motivoVerificacion === "sin_precio_referencia") {
        return NextResponse.json(
          {
            error: "sin_precio_para_mantener",
            mensaje: "Este material nunca tuvo precio — no hay nada que mantener, cargá uno con \"manual\".",
          },
          { status: 400 }
        );
      }
      const actualizado = await db.precioMTOP.update({
        where: { codigo },
        data: { ...base, detalleVerificacion: null, urlReferencia: null },
      });
      return NextResponse.json(actualizado);
    }

    // accion === "manual"
    const precioManual: unknown = body?.precioManual;
    if (typeof precioManual !== "number" || !Number.isFinite(precioManual) || precioManual <= 0) {
      return NextResponse.json(
        { error: "precio_manual_invalido", mensaje: "precioManual debe ser un número mayor a 0." },
        { status: 400 }
      );
    }
    const actualizado = await db.precioMTOP.update({
      where: { codigo },
      data: { ...base, precioUnitario: precioManual, precioConIva: precioManual, detalleVerificacion: null, urlReferencia: null },
    });
    return NextResponse.json(actualizado);
  } catch (err) {
    console.error("[POST /api/precios-mtop/[codigo]/resolver]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
