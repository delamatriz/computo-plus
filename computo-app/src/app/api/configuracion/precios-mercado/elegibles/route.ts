import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Lista liviana (sin IA) de los códigos elegibles para "Buscar precios
// actualizados" — proveedor conocido, sin marcador de fuente derivada, sin
// verificación pendiente. Se pide una sola vez al abrir la sección; el
// cliente arma las tandas localmente a partir de esta lista (ver
// SeccionActualizacionDatos.tsx).
//
// Excluye también los verificados en las últimas 24hs aunque
// requiereVerificacion sea false — un ítem "actualizado" (dentro del
// umbral) NO pone ningún marcador que lo saque de la elegibilidad por sí
// solo (motivoVerificacion queda null, igual que uno nunca verificado);
// sin este filtro de recencia, cerrar la pestaña a mitad de una corrida y
// volver a apretar el botón re-verificaría (gastando IA de nuevo) los que
// ya se habían auto-aplicado hace un rato, rompiendo la resumabilidad
// (hallazgo de la verificación con datos simulados, ver reporte).
export async function GET() {
  try {
    const haceUnDia = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const elegibles = await db.precioMTOP.findMany({
      where: {
        proveedor: { not: null },
        motivoVerificacion: null,
        requiereVerificacion: false,
        OR: [{ fechaUltimaVerificacion: null }, { fechaUltimaVerificacion: { lt: haceUnDia } }],
      },
      select: { codigo: true, descripcion: true, proveedor: true, precioUnitario: true, unidad: true },
      orderBy: { codigo: "asc" },
    });
    return NextResponse.json({ elegibles });
  } catch (err) {
    console.error("[GET /api/configuracion/precios-mercado/elegibles]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
