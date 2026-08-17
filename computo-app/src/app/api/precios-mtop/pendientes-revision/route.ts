import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Cola de Revisión (Etapa 4, FEAT-AI-006) — separa los requiereVerificacion=true
// en las dos UX distintas que no se mezclan (ver diseño): "sin_precio_referencia"
// nunca tuvo precio (solo se puede cargar a mano); cualquier otro motivo trae
// contexto de una verificación real (o simulada) para revisar con las 3 acciones
// de POST /api/precios-mtop/[codigo]/resolver.
export async function GET() {
  try {
    const pendientes = await db.precioMTOP.findMany({
      where: { requiereVerificacion: true },
      select: {
        codigo: true,
        descripcion: true,
        unidad: true,
        precioUnitario: true,
        precioSugeridoPendiente: true,
        motivoVerificacion: true,
        detalleVerificacion: true,
        urlReferencia: true,
      },
      orderBy: { descripcion: "asc" },
    });

    const sinPrecio = pendientes
      .filter((p) => p.motivoVerificacion === "sin_precio_referencia")
      .map((p) => ({ codigo: p.codigo, descripcion: p.descripcion, unidad: p.unidad }));

    const aRevisar = pendientes
      .filter((p) => p.motivoVerificacion !== "sin_precio_referencia")
      .map((p) => ({
        codigo: p.codigo,
        descripcion: p.descripcion,
        unidad: p.unidad,
        precioActual: p.precioUnitario,
        precioSugerido: p.precioSugeridoPendiente,
        motivo: p.motivoVerificacion,
        detalle: p.detalleVerificacion,
        url: p.urlReferencia,
      }));

    return NextResponse.json({ sinPrecio, aRevisar });
  } catch (err) {
    console.error("[GET /api/precios-mtop/pendientes-revision]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
