import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { datosCorreccionPrecio } from "@/lib/resolverPrecioMTOP";

// PATCH — corrige el precio de un material del catálogo por id exacto.
// A diferencia del PATCH por descripción en ../route.ts (necesario desde
// un APU, donde solo se tiene el texto), acá el caller (/materiales) ya
// conoce el id exacto de la fila — sin ambigüedad que resolver, un
// update directo por clave primaria. Misma resolución de "limpiar estado
// pendiente" que el resto del sistema (ver lib/resolverPrecioMTOP.ts).
//
// Vive en la carpeta [codigo] (no [id]) a propósito — Next.js exige que
// todos los segmentos dinámicos hermanos bajo el mismo padre usen el
// MISMO nombre de parámetro; esta carpeta ya tenía a [codigo]/resolver
// como hermana. Tener [id] y [codigo] como hermanos rompía el árbol de
// rutas completo al arrancar con "next start" (rompió producción en
// Render — ni "next dev" ni "next build" lo detectan, solo un servidor
// real). El nombre de la carpeta es solo de Next.js — el valor que
// recibe sigue siendo el id real de PrecioMTOP, no un código.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ codigo: string }> }
) {
  try {
    const { codigo: id } = await params;
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
    console.error("[PATCH /api/precios-mtop/[codigo] (id real)]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
