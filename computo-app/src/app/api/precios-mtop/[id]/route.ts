import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { datosCorreccionPrecio } from "@/lib/resolverPrecioMTOP";

// PATCH — corrige el precio de un material del catálogo por id exacto.
// A diferencia del PATCH por descripción en ../route.ts (necesario desde
// un APU, donde solo se tiene el texto), acá el caller (/materiales) ya
// conoce el id exacto de la fila — sin ambigüedad que resolver, un
// update directo por clave primaria. Misma resolución de "limpiar estado
// pendiente" que el resto del sistema (ver lib/resolverPrecioMTOP.ts).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);

    if (!Number.isFinite(body?.precioUnitario) || body.precioUnitario <= 0) {
      return NextResponse.json(
        { error: "precioUnitario debe ser un número mayor a 0" },
        { status: 400 }
      );
    }

    let actualizado;
    try {
      actualizado = await db.precioMTOP.update({
        where: { id },
        data: datosCorreccionPrecio(body.precioUnitario),
      });
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && err.code === "P2025") {
        return NextResponse.json({ error: "Material no encontrado" }, { status: 404 });
      }
      throw err;
    }

    return NextResponse.json({
      ok: true,
      id: actualizado.id,
      precioUnitario: actualizado.precioUnitario,
      precioConIva: actualizado.precioConIva,
      fechaUltimaVerificacion: actualizado.fechaUltimaVerificacion,
      requiereVerificacion: actualizado.requiereVerificacion,
      motivoVerificacion: actualizado.motivoVerificacion,
    });
  } catch (err) {
    console.error("[PATCH /api/precios-mtop/[id]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
